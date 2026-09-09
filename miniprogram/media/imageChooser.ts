import { Err } from '../constant/error';
import { Media, Resource } from '../server/resource';
import { Logger } from '../utils/logger';
import { WxUtils } from '../utils/wxUtils';

/**
 * 图片选择 + 压缩。
 *
 * 后台限制（超过会失败），故超限的图要先压到阈值内：
 *   · 大小   ≤ sMaxSize
 *   · 长边   ≤ sMaxLongEdge
 *   · 格式   仅 jpg（wx.compressImage 的 quality 仅对 jpg 生效）
 * 以上阈值均可通过静态变量调整。
 */
export class ImageChooser {
  /** 大小上限（字节），后台限制 5M */
  public static sMaxSize = 5 * 1024 * 1024;
  /** 长边上限（px） */
  public static sMaxLongEdge = 6000;
  /** 压缩质量阶梯：从高到低尝试，直到满足大小限制 */
  public static sQualities = [80, 70, 60, 50, 40, 30];
  /** 支持的图片格式（后台仅支持 jpg） */
  public static sSupportedTypes = ['jpg', 'jpeg'];

  // 选择与处理的结果，都保存在media结构里。
  public medias: Media[] = [];

  /**
   * @param count 可以选择图片数量
   * @param delay 是否延迟计算hash以及压缩 (如果不需要唯一标识，似乎可以留到上传时再计算。)
   * @param sourceType 支持类型。
   * @returns
   */
  public async choose(count = 9, delay: boolean = false, sourceType?: string[]): Promise<number> {
    const files = await ImageChooser.chooseFiles(count, sourceType);
    // 用户取消（fail 且非真正错误）时，不视为失败。
    if (!files) return Err.Code.OK;
    if (!files.length) return Err.Code.Unknown;

    for (const file of files) {
      const media = Resource.defaultMedia();
      media.type = Resource.Type.Image;
      media.path = file.tempFilePath;
      media.name = WxUtils.getFileName(file.tempFilePath);
      media.size = file.size;
      media.width = file.width;
      media.height = file.height;

      // 基础数据：宽高与大小。chooseMedia 返回的宽高在部分机型可能为 0，故失败时再读一次。
      if (!media.width || !media.height) {
        const info = await WxUtils.readImageInfo(media.path);
        if (info) {
          media.width = info.width;
          media.height = info.height;
        }
      }
      if (!media.size) {
        media.size = await WxUtils.getFileSize(media.path);
      }

      if (!delay) {
        // 压缩后文件变更，故 hash 必须基于最终文件计算。
        await ImageChooser.compress(media);
        media.hash = await WxUtils.getFileMd5(media.path);
      }

      this.medias.push(media);
    }
    return Err.Code.OK;
  }

  /**
   * 调用 wx.chooseMedia 选择图片。
   * @returns 用户取消时返回 undefined；真正失败返回空数组。
   */
  protected static async chooseFiles(
    count: number,
    sourceType?: string[]
  ): Promise<WechatMiniprogram.MediaFile[] | undefined> {
    return new Promise((resolve) => {
      wx.chooseMedia({
        count: count,
        // 只选图片：视频暂不支持。
        mediaType: ['image'],
        sizeType: ['compressed'],
        sourceType: (sourceType as Array<'album' | 'camera'>) || ['album', 'camera'],
        success: (res) => {
          resolve(res?.tempFiles || []);
        },
        fail: (err) => {
          // errMsg 形如 "chooseMedia:fail cancel"
          const msg = err?.errMsg || '';
          if (msg.includes('cancel')) {
            Logger.info('Choose image canceled.');
            resolve(undefined);
          } else {
            Logger.warn('Choose image failed.', err);
            resolve([]);
          }
        },
      });
    });
  }

  /**
   * 若超过大小或长边限制，使用 wx.compressImage 压缩，直到满足限制或质量降到最低。
   * 会就地更新 media 的 path / width / height / size。
   *
   * 注意：quality 仅对 jpg 有效；非 jpg（如 png）只能靠缩放尺寸减小体积，
   * 且 compressImage 不保证转换格式 —— 若后台严格拒绝非 jpg，需额外做一次 canvas 转码。
   */
  protected static async compress(media: Media): Promise<number> {
    if (!media.path) return Err.Code.InvalidParam;
    if (!ImageChooser.needCompress(media)) return Err.Code.OK;

    // ① 长边超限：先按长边等比缩一次（另一个维度留空，由微信等比处理）
    if (ImageChooser.longEdge(media) > ImageChooser.sMaxLongEdge) {
      const scaled = await ImageChooser.scale(media);
      if (scaled && scaled !== media.path) {
        media.path = scaled;
        await ImageChooser.refresh(media);
      }
    }

    // ② 仍超大小：按质量阶梯继续压。
    // 注意：quality 仅对 jpg 有效，非 jpg 压了也不会变小，故跳过（直接走③的缩放）。
    if (media.size > ImageChooser.sMaxSize && ImageChooser.isJpg(media)) {
      for (const quality of ImageChooser.sQualities) {
        const path = await ImageChooser.compressOnce(media.path, quality);
        if (path) {
          media.path = path;
          await ImageChooser.refresh(media);
        }
        if (media.size <= ImageChooser.sMaxSize) break;
      }
    }

    // ③ 兜底：仍超限则按长边再缩一次（有些图质量压不下去）
    if (ImageChooser.needCompress(media)) {
      const scaled = await ImageChooser.scale(media, Math.floor(ImageChooser.sMaxLongEdge / 2));
      if (scaled && scaled !== media.path) {
        media.path = scaled;
        await ImageChooser.refresh(media);
      }
    }

    if (ImageChooser.needCompress(media)) {
      Logger.warn('Image still oversized after compress.', media);
      return Err.Code.OverLimited;
    }
    return Err.Code.OK;
  }

  /** 是否需要压缩 */
  protected static needCompress(media: Media): boolean {
    return (
      media.size > ImageChooser.sMaxSize || ImageChooser.longEdge(media) > ImageChooser.sMaxLongEdge
    );
  }

  /**
   * 取后缀（小写，不含点）。
   * 后台仅支持 jpg；compressImage 的 quality 也仅对 jpg 生效，
   * 故非 jpg（如 png）只能靠缩放尺寸减小体积，且不能保证转成 jpg。
   */
  protected static postfix(media: Media): string {
    const name = media.name || '';
    const index = name.lastIndexOf('.');
    return index >= 0 ? name.substring(index + 1).toLowerCase() : '';
  }

  protected static isJpg(media: Media): boolean {
    return ImageChooser.sSupportedTypes.indexOf(ImageChooser.postfix(media)) >= 0;
  }

  protected static longEdge(media: Media): number {
    return Math.max(media.width || 0, media.height || 0);
  }

  /** 按 quality 压缩一次，返回新路径（失败返回空） */
  protected static async compressOnce(path: string, quality: number): Promise<string> {
    return new Promise((resolve) => {
      wx.compressImage({
        src: path,
        quality: quality,
        success: (res) => {
          resolve(res?.tempFilePath || '');
        },
        fail: (err) => {
          Logger.warn('Compress image failed.', path, quality, err);
          resolve('');
        },
      });
    });
  }

  /** 按长边缩放到指定值（默认 sMaxLongEdge），返回新路径 */
  protected static async scale(media: Media, longEdge?: number): Promise<string> {
    const target = longEdge || ImageChooser.sMaxLongEdge;
    const width = media.width || 0;
    const height = media.height || 0;
    if (!width || !height) return '';

    const ratio = target / ImageChooser.longEdge(media);
    const option: WechatMiniprogram.CompressImageOption = {
      src: media.path,
      quality: ImageChooser.sQualities[0],
    };
    if (width >= height) {
      option.compressedWidth = Math.floor(width * ratio);
    } else {
      option.compressedHeight = Math.floor(height * ratio);
    }
    return new Promise((resolve) => {
      wx.compressImage({
        ...option,
        success: (res) => resolve(res?.tempFilePath || ''),
        fail: (err) => {
          Logger.warn('Scale image failed.', media.path, err);
          resolve('');
        },
      });
    });
  }

  /** 压缩后重新读取宽高与大小 */
  protected static async refresh(media: Media): Promise<void> {
    media.size = await WxUtils.getFileSize(media.path);
    const info = await WxUtils.readImageInfo(media.path);
    if (info) {
      media.width = info.width;
      media.height = info.height;
    }
  }
}

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

  /**
   * 转 jpg 用的隐藏 canvas 的 canvas-id。
   * ★ 使用方必须在页面 wxml 中放置该 canvas（否则转码会失败）：
   *   <canvas canvas-id="imageChooserCanvas" class="image-chooser-canvas" />
   *   .image-chooser-canvas {
   *     position: absolute; left: -9999px; top: 0;
   *     width: 2048px; height: 2048px;   // 必须 ≥ sCanvasMaxSize
   *   }
   * 注意：不要用 display:none —— 部分基础库不会绘制未参与布局的 canvas。
   */
  public static sCanvasId = 'snapCanvas';
  /**
   * canvas 转 jpg 时的最大边长。
   * 受 canvas 内存限制（约 w×h×4 字节）：2048² ≈ 16MB 较安全，
   * 4096² ≈ 67MB 低端机有风险。非 jpg 图转码时会等比缩到该值内。
   */
  public static sCanvasMaxSize = 2048;
  /** canvas 导出 jpg 的质量（0~1） */
  public static sJpgQuality = 0.8;

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
      // 总是读一下，确保读到类型。
      ImageChooser.refresh(media, 0, media.size);

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

    // ⓪ 格式：后台严格只支持 jpg，非 jpg 必须先用 canvas 转码（与是否超限无关）
    if (!(await ImageChooser.isJpg(media))) {
      const jpg = await ImageChooser.toJpg(media);
      if (!jpg) {
        // 多数情况是页面未放置隐藏 canvas，交由调用方排查。
        Logger.warn('Image is not jpg and convert failed.', media);
        return Err.Code.WxAPIFailed;
      }
      media.path = jpg;
      media.name = ImageChooser.replacePostfix(media.name, 'jpg');
      await ImageChooser.refresh(media);
    }

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
    // 走到这里必然已是 jpg（步骤⓪已转码），故 quality 一定有效。
    if (media.size > ImageChooser.sMaxSize) {
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
   * 故非 jpg（如 png）必须先用 canvas 转码成 jpg。
   */
  protected static postfix(media: Media): string {
    const name = media.name || '';
    const index = name.lastIndexOf('.');
    return index >= 0 ? name.substring(index + 1).toLowerCase() : '';
  }

  /** 替换后缀（原文件名无后缀时补上），用于转码后更新 name */
  protected static replacePostfix(name: string, postfix: string): string {
    const origin = name || 'image';
    const index = origin.lastIndexOf('.');
    return (index >= 0 ? origin.substring(0, index) : origin) + '.' + postfix;
  }

  /**
   * 是否是 jpg。
   * 优先用后缀快速判断；后缀缺失（微信临时文件常无后缀）时，
   * 读图片真实格式（wx.getImageInfo 的 type，如 jpeg / png）兜底。
   */
  protected static async isJpg(media: Media): Promise<boolean> {
    const postfix = ImageChooser.postfix(media);
    if (ImageChooser.sSupportedTypes.indexOf(postfix) >= 0) return true;
    if (['png', 'gif', 'webp', 'heic', 'bmp'].indexOf(postfix) >= 0) return false;
    const type = media.postfix || '';
    return type === 'jpeg' || type === 'jpg';
  }

  /**
   * 用 canvas 把非 jpg 图转为 jpg（后台严格限制，且缩略图只支持 jpg）。
   * 转码同时按需等比缩到 sCanvasMaxSize 内，避免超出画布尺寸。
   * @returns 新的 jpg 临时路径；失败返回空（多为页面未放置隐藏 canvas）。
   */
  protected static async toJpg(media: Media): Promise<string> {
    const width0 = media.width || 0;
    const height0 = media.height || 0;
    if (!media.path || !width0 || !height0) return '';

    // 目标尺寸：不超过画布上限，也不超过后台长边限制
    const max = Math.min(ImageChooser.sCanvasMaxSize, ImageChooser.sMaxLongEdge);
    const ratio = Math.max(width0, height0) > max ? max / Math.max(width0, height0) : 1;
    const width = Math.max(1, Math.round(width0 * ratio));
    const height = Math.max(1, Math.round(height0 * ratio));

    // 这里用旧版 canvas（canvas-id）而非新版 Canvas 2D：
    // 本类是纯逻辑类、拿不到页面/组件实例，而 2D 版需 SelectorQuery 取 node 才行。
    // 旧版已标记 deprecated 但仍可用；将来若迁移到 2D，需把 wxml 改为
    // <canvas type="2d" id="..." /> 并由调用方传入 component 实例。
    const canvasId = ImageChooser.sCanvasId;
    const ctx = wx.createCanvasContext(canvasId);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(media.path, 0, 0, width, height);

    // draw 是异步的，必须等回调结束再导出
    const drawn = await new Promise<boolean>((resolve) => {
      ctx.draw(false, () => resolve(true));
    });
    if (!drawn) return '';

    return new Promise((resolve) => {
      wx.canvasToTempFilePath({
        canvasId: canvasId,
        x: 0,
        y: 0,
        width: width,
        height: height,
        destWidth: width,
        destHeight: height,
        fileType: 'jpg',
        quality: ImageChooser.sJpgQuality,
        success: (res) => resolve(res?.tempFilePath || ''),
        fail: (err) => {
          Logger.warn('Convert to jpg failed.', media.path, err);
          resolve('');
        },
      });
    });
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
  protected static async refresh(media: Media, width = 0, size = 0): Promise<void> {
    if (!size) media.size = await WxUtils.getFileSize(media.path);
    if (!width) {
      const info = await WxUtils.readImageInfo(media.path);
      if (info) {
        media.width = info.width;
        media.height = info.height;
        media.postfix = (info.type || '').toLowerCase();
      }
    }
  }
}

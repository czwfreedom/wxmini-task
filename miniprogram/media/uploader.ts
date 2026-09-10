import { Err } from '../constant/error';
import { SubUI } from '../core/subUI';
import { Resource, Media } from '../server/resource';
import { Logger } from '../utils/logger';

/** 本地新增媒体的 id 前缀（MediaInputUI 生成的 id 以 m 开头） */
const LOCAL_PREFIX = 'm';

export class MediaUploader extends SubUI<{}> {
  /**
   * 上传图片、音频、视频。
   * 传过来的参数可能已经上传了，也可能没有（例如，在修改场景下，可以删除已有的记录，新增一条）
   * 我的想法是：新增的照片id以 m 开头，上传之后，替换为系统返回的ID（其保证不会以m开头）
   *
   * 上传的流程中：获得上传参数 -> 上传 -> 跟服务器确认上传完成了。 （因为上传没有经过服务器中转，所以设计了一个简单的确认机制）
   * Resource.create 提供了创建的接口，其有一个排重的机制：如果系统中已有同样 hash 照片，直接返回对应的ID以及路径，这时就没必要重复上传了。
   * 如果没有，其会在 upload 中指定上传需要的参数，调用 wx.uploadFile 上传照片到 AliOSS。
   *
   * 上传完成之后，需要调用 Resource.update([{ id, checked: 1} ]) 表示这张照片已上传过了。
   *
   * @param medias 要上传的照片。
   * @param showLoading 是否展示loading，如果有，会展示 上传中x/y 进度。
   */
  public async upload(medias: Media[], showLoading = true): Promise<number> {
    if (!medias?.length) return Err.Code.OK;

    const pendings = medias.filter((o) => MediaUploader.isLocal(o.id) && !!o.path);
    if (!pendings.length) return Err.Code.OK;

    let finished = 0;
    const total = pendings.length;
    const show = (index: number) => {
      if (!showLoading) return;
      this.showLoading(`上传中 ${index}/${total}`);
    };

    show(0);
    for (const media of pendings) {
      const errcode = await MediaUploader.uploadOne(media);
      if (errcode !== Err.Code.OK) {
        this.hideLoading();
        return errcode;
      }
      finished++;
      show(finished);
    }
    this.hideLoading();
    return Err.Code.OK;
  }

  /** 是否是本地新增（未上传）的媒体 */
  public static isLocal(id: string): boolean {
    return !!id?.startsWith(LOCAL_PREFIX);
  }

  /** 单条媒体的完整上传流程：create → uploadFile → update */
  protected static async uploadOne(media: Media): Promise<number> {
    // ① 创建（服务端按 hash 排重）
    const created = await Resource.create({
      type: media.type,
      width: media.width,
      height: media.height,
      size: media.size,
      duration: media.duration,
      time: media.time,
      hash: media.hash,
      path: media.path,
      postfix: media.postfix,
    });
    if (typeof created === 'number') {
      Logger.warn('Create resource before upload failed.', media, created);
      return created;
    }

    // 记录本地路径：上传后 path 会被替换为云端地址
    media.localPath = media.path;

    const upload = created.upload;
    if (upload) {
      // ② 直传 OSS
      const errcode = await MediaUploader.transfer(upload, media.localPath);
      if (errcode !== Err.Code.OK) return errcode;

      // ③ 确认上传完成
      const updated = await Resource.update([{ id: created.id, checked: 1 }]);
      if (typeof updated === 'number') {
        Logger.warn('Confirm resource upload failed.', created.id, updated);
        return updated;
      }
    }
    // upload 为空 = 服务端已存在同 hash 的资源，无需重复上传

    // 用服务端 id 替换本地 id（服务端保证 id 不以 m 开头）
    media.id = created.id;
    media.path = created.path || media.path;
    return Err.Code.OK;
  }

  /** 用直传凭证把文件上传到 OSS */
  protected static async transfer(upload: Resource.Upload, filePath: string): Promise<number> {
    return new Promise((resolve) => {
      const task = wx.uploadFile({
        url: upload.url,
        filePath: filePath,
        name: 'file',
        formData: {
          key: upload.key,
          policy: upload.policy,
          OSSAccessKeyId: upload.keyId,
          signature: upload.signature,
          success_action_status: '200',
        },
        success: (res) => {
          // OSS 直传成功一般返回 200/204，且不带 errcode
          if (res?.statusCode >= 200 && res.statusCode < 300) {
            resolve(Err.Code.OK);
            return;
          }
          Logger.warn('Upload file to oss failed.', res);
          resolve(Err.Code.Network);
        },
        fail: (err) => {
          Logger.warn('Upload file failed.', err);
          resolve(Err.Code.Network);
        },
      });
      // 保留引用，便于调试（小程序弱网下可在 onProgressUpdate 中做进度）
      void task;
    });
  }
}

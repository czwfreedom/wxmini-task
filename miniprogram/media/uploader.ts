import { SubUI } from '../core/subUI';
import { Media } from '../server/resource';

export class MediaLoader extends SubUI<{}> {
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
  public async upload(medias: Media[], showLoading = true): Promise<number> {}
}

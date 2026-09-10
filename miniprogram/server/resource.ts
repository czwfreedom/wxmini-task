import { Api } from '../constant/api';
import { Err } from '../constant/error';
import { Network } from '../core/network';
import { Entity } from '../model/entity';
import { Logger } from '../utils/logger';

export namespace Resource {
  export const enum Type {
    Image = 1,
    Video = 2,
    Audio = 3,
    File = 4,
  }

  export interface Info extends Entity.Info {
    createTime: number;
    checked?: number;
    type: number;
    quality?: number;
    width: number;
    height: number;
    size: number;
    duration: number;
    time: number;
    hash: string;
    path: string;
    tag?: string;
    postfix?: string;
  }

  export interface ListRequest {
    ids: string[];
  }

  // {
  //     "hash": "786db29dc15b03e3be716c047cc18da3",
  //     "width": "3024",
  //     "height": "4032",
  //     "type": 1,
  //     "postfix": "jpg",
  //     "time": "1621502520000"
  // }
  export interface CreateRequest extends Info {}

  export interface Upload {
    key: string;
    keyId: string;
    policy: string;
    signature: string;
    url: string;
  }

  export interface CreateResponse extends Media {
    upload?: Upload;
  }

  export function defaultMedia(): Media {
    const now = Date.now();
    return {
      id: '',
      name: '',
      type: Type.Image,
      quality: 0,
      width: 0,
      height: 0,
      size: 0,
      duration: 0,
      time: now,
      createTime: now,
      hash: '',
      path: '',
    };
  }

  // 设置一些默认值，免得使用时出错。
  export function toMedia(info: Info): Media {
    return Object.assign(defaultMedia(), info);
  }

  function check(res: Network.BaseResponse<Info[]>): number | Media[] {
    if (res?.errcode !== 0) {
      Logger.warn('List resource failed.', res);
      return res.errcode || Err.Code.Network;
    }

    const medias: Media[] = [];
    for (const item of res.data || []) {
      const media = toMedia(item);
      medias.push(media);
    }
    return medias;
  }

  export async function list(data: Partial<ListRequest>): Promise<number | Media[]> {
    const res = await Network.post<Info[]>(Api.ListResource, data);
    return check(res);
  }

  export async function update(data: Partial<Resource.Info>[]): Promise<number | Media[]> {
    const res = await Network.post<Info[]>(Api.UpdateResource, { data });
    return check(res);
  }

  export async function create(
    data: Partial<Resource.Info>
  ): Promise<number | Resource.CreateResponse> {
    const res = await Network.post<CreateResponse>(Api.CreateResource, data);
    if (res?.errcode !== 0 || !res.data) {
      Logger.warn('Create resource failed.', res);
      return res.errcode || Err.Code.Network;
    }
    // 有 upload 字段也不会丢。
    return toMedia(res.data);
  }
}

// 有些历史代码直接使用了 Media，所以导出这个。
export interface Media extends Resource.Info {
  /**
   * 本地照片上传之后，既有本地路径，也有云端路径。如果要使用，暂时保存起来。
   */
  localPath?: string;
}

import { Api } from '../constant/api';
import { Err } from '../constant/error';
import { Network } from '../core/network';
import { Entity } from '../model/entity';
import { Logger } from '../utils/logger';

export namespace Comment {
  export interface Info extends Entity.Id {
    praise: number;
    comment: number;
    type: number;
    ref: string;
    userId: string;
    detail?: string;
    commentTime?: number;
    praiseTime?: number;
    createTime: number;
  }

  export const enum Attr {
    Like = 1,
    Comment = 2,
  }

  export interface ListResponse {
    data: Info[];
    users: Entity.Info[];
  }

  export function hasComment(info: Info): boolean {
    return !!info.detail && !!info.comment;
  }

  export function hasLike(info: Info): boolean {
    return !!info.praise;
  }

  export async function list(data: Partial<Info>): Promise<number | ListResponse> {
    const res = await Network.post<Info[]>(Api.ListComment, data);
    if (res?.errcode !== 0) {
      Logger.warn('List commment failed', res);
      return res?.errcode || Err.Code.Network;
    }
    return { data: res?.data || [], users: res?.users || [] };
  }

  export async function create(data: Partial<Info>): Promise<Info | number> {
    const res = await Network.post<Info[]>(Api.CreateComment, data);
    if (res?.errcode !== 0 || res.data?.length !== 1) {
      Logger.info('Create comment failed', res);
      return res?.errcode || Err.Code.Network;
    }
    return res.data[0];
  }

  export async function update(data: Partial<Info>): Promise<number | Info | undefined> {
    const res = await Network.post<Info[]>(Api.UpdateComment, data);
    if (res.errcode !== 0) {
      Logger.info('Update comment failed', res);
      return res.errcode || Err.Code.Network;
    }
    return res?.data?.[0];
  }
}

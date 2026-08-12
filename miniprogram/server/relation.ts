import { Api } from '../constant/api';
import { Err } from '../constant/error';
import { Network } from '../core/network';
import { Entity } from '../model/entity';
import { Logger } from '../utils/logger';

export namespace Relation {
  export interface Info extends Entity.Id {
    userId: string;
    useeId: string;
    createTime: number;
    deleted?: number;
  }

  export interface User extends Entity.Info {
    // 当天的任务数量
    routine?: { count: number };
  }

  export interface Stat {
    useeCount: number;
    userCount: number;
  }

  export interface ListResponse {
    data: Info[];
    users: User[];
  }

  export async function list(data: Partial<Info>): Promise<number | ListResponse> {
    const res = await Network.post<Info[]>(Api.ListRelation, data);
    if (res?.errcode !== 0) {
      Logger.warn('List relation failed', res);
      return res?.errcode || Err.Code.Network;
    }
    return { data: res?.data || [], users: res?.users || [] };
  }

  export async function create(
    userId: string,
    useeId: string,
    nonce?: string
  ): Promise<Info | number> {
    const res = await Network.post<Info[]>(Api.CreateRelation, {
      nonce,
      data: [{ userId, useeId }],
    });
    if (res?.errcode !== 0 || res.data?.length !== 1) {
      Logger.info('Create relation failed', res);
      return res?.errcode || Err.Code.Network;
    }
    return res.data[0];
  }

  export async function update(data: Partial<Info>): Promise<number> {
    const res = await Network.post<Info>(Api.UpdateRelation, { data: [data] });
    if (res.errcode !== 0) {
      Logger.info('Update relation failed', res);
      return res.errcode || Err.Code.Network;
    }
    return Err.Code.OK;
  }

  export async function stat(): Promise<number | Stat> {
    const res = await Network.post<Stat>(Api.StatRelation);
    if (res?.errcode !== 0 || !res.data) {
      Logger.warn('Stat relation failed', res);
      return res?.errcode || Err.Code.Network;
    }
    return res.data;
  }
}

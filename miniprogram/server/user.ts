import { Api } from '../constant/api';
import { Err } from '../constant/error';
import { Network } from '../core/network';
import { Logger } from '../utils/logger';
import { Entity } from '../model/entity';

export namespace User {
  export interface Info extends Entity.Info {
    token: string;
    loginTime?: number;
  }

  export async function update(data: Partial<Info>): Promise<number | Info> {
    if (1) return data as any;
    const res = await Network.post<Info>(Api.UpdateUser, data);
    if (res.errcode !== 0 || !res.data) {
      Logger.info('Update user failed', res);
      return res.errcode || Err.Code.Network;
    }
    return res.data;
  }

  export async function login(code: string): Promise<number | User.Info> {
    const res = await Network.post<User.Info[]>(Api.Login, { code });
    if (!res || res.errcode !== 0) {
      Logger.warn('Web login failed.', res);
      return res?.errcode || Err.Code.Network;
    }
    if (res.data?.length !== 1) {
      return Err.Code.ServerFailed;
    }
    return res.data[0];
  }
}

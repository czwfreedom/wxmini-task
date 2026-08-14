import { Api } from '../constant/api';
import { Err } from '../constant/error';
import { Network } from '../core/network';
import { Logger } from '../utils/logger';
import { Entity } from '../model/entity';
import { Config } from './config';
import { Routine } from './routine';

export namespace User {
  export interface Info extends Entity.Info {
    token: string;
    loginTime?: number;
  }

  export interface Extra {
    data: Config.Info;
    routineTemplate: Partial<Routine.Info>;
  }

  export const sSystem = '1';

  export async function update(data: Partial<Info>): Promise<number | Info> {
    const res = await Network.post<Info>(Api.UpdateUser, data);
    if (res.errcode !== 0 || !res.data) {
      Logger.info('Update user failed', res);
      return res.errcode || Err.Code.Network;
    }
    return res.data;
  }

  export async function login(code: string): Promise<number | Info> {
    const res = await Network.post<Info[]>(Api.Login, { code });
    if (!res || res.errcode !== 0) {
      Logger.warn('Web login failed.', res);
      return res?.errcode || Err.Code.Network;
    }
    if (res.data?.length !== 1) {
      return Err.Code.ServerFailed;
    }
    return res.data[0];
  }

  export async function listInfo(userId: string): Promise<number | Partial<Extra>> {
    const res = await Network.post<any>(Api.UpdateUser, { id: userId });
    if (res.errcode !== 0) {
      Logger.info('Update user info failed', res);
      return res.errcode || Err.Code.Network;
    }

    delete res.errcode;
    return res;
  }
}

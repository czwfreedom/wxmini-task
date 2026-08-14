import { Api } from '../constant/api';
import { Err } from '../constant/error';
import { Network } from '../core/network';
import { Entity } from '../model/entity';
import { Logger } from '../utils/logger';
import { Utils } from '../utils/utils';
import { Routine } from './routine';

export namespace Config {
  export interface Info extends Entity.Info {
    type: number;
    used?: number;
    proirity?: number;
    ref?: string;
    userId: string;
    tag?: string;
    value: string;
  }

  export const enum Type {
    RoutineTemplate = 1, // 日程模板
  }

  export interface ListRequest extends Info {
    brief: boolean;
  }

  export function parseTemplate(data: Info[]): Partial<Routine.Info[]> {
    return data.map((o) => Utils.parseJson(o.value, true));
  }

  export async function list(data: Partial<ListRequest>): Promise<number | Info[]> {
    const res = await Network.post<Info[]>(Api.ListConfig, data);
    if (res?.errcode !== 0) {
      Logger.warn('List config failed', res);
      return res?.errcode || Err.Code.Network;
    }
    return res?.data || [];
  }
}

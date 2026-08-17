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
    detail?: string;
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

  export interface Template extends Info {
    items: Partial<Routine.Info>[];
  }

  // export const sTemplates: Template[] = [
  //   {
  //     id: '',
  //     name: '学霸日常三件套',
  //     detail: '每天必做的基础学习，不多不少刚刚好',
  //     items: [
  //       { category: Routine.Category.Reading, duration: 1800000 },
  //       { category: Routine.Category.Homework, duration: 2700000 },
  //       { category: Routine.Category.Handwriting, duration: 1800000 },
  //     ],
  //   },
  //   {
  //     id: '',
  //     name: '小小探索家',
  //     detail: '练体魄、问问题、看世界',
  //     items: [
  //       { category: Routine.Category.Reading, duration: 2700000 },
  //       { category: Routine.Category.QA, duration: 900000 },
  //       { category: Routine.Category.Exercise, duration: 1800000 },
  //     ],
  //   },
  // ] as any;

  export interface ListRequest extends Info {
    userIds: string[];
    types: number[];
    brief: boolean;
  }

  export function parseTemplate(data: Info[]): Template[] {
    const result: Template[] = [];
    for (const item of data) {
      const v = item as Template;
      const d: { items: Partial<Routine.Info>[] } | undefined = Utils.parseJson(item.value, true);
      if (d?.items?.length) {
        v.items = d.items;
        result.push(v);
      }
    }
    return result;
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

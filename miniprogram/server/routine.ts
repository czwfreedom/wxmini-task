import { Api } from '../constant/api';
import { Err } from '../constant/error';
import { Network } from '../core/network';
import { Entity } from '../model/entity';
import { Logger } from '../utils/logger';

export namespace Routine {
  export interface Info extends Entity.Info {
    status: number; // 状态，包括 0-未开始，100-进行中，200-已完成。
    category: number; // 分类
    subcategory?: number; // 子分类，预留。
    userId: string; // 归属，目前就是自己。
    date: number; // 日期，精确到天。
    transaction: string; // 创建时用于排重，32位uuid
    detail: string; // 内容
    medias?: string; // 图片或者视频，预留。
    remark?: string; // 完成时提交的内容
    mediaRemark?: string; // 完成时提交的图片或者视频
    createTime: number;
    finishTime?: number; // 完成时间
  }

  export async function create(data: Partial<Info>): Promise<number | Info> {
    const res = await Network.post<Info[]>(Api.CreateRoutine, { data: [data] });
    if (res?.errcode !== 0 || res.data?.length !== 1) {
      Logger.info('Create routine failed', res);
      return res?.errcode || Err.Code.Network;
    }
    return res.data[0];
  }
}

import { Api } from '../constant/api';
import { Err } from '../constant/error';
import { Network } from '../core/network';
import { Entity } from '../model/entity';
import { Logger } from '../utils/logger';
import { Utils } from '../utils/utils';

export namespace Routine {
  /** 任务状态 */
  export const enum Status {
    /** 未开始，预留 */
    Pending = 0,
    /** 进行中 */
    Working = 10,
    /** 已完成 */
    Done = 100,
  }

  /** 任务分类 */
  export const enum Category {
    /** 阅读 */
    Reading = 1,
    /** 作业 */
    Homework = 2,
    /** 运动 */
    Exercise = 3,
    /** 家务 */
    Chores = 4,
    /** 游戏 */
    Game = 5,
    /** 练字 */
    Handwriting = 6,
    /** 乐器 */
    Instrument = 7,
    /** 绘画 */
    Drawing = 8,
    /** 编程 */
    Coding = 9,
    /**
     * 社会实践
     */
    Practice = 10,
    /**
     * 问答
     */
    QA = 11,
    /**
     * 工作
     */
    Job = 12,
    /**
     * 拍摄
     */
    Shoot = 13,

    /**
     * 其他
     */
    Other = 255,
  }

  export interface Info extends Entity.Info {
    /** 任务状态 */
    status: number;
    /** 任务分类 */
    category: number;
    /** 子分类，预留 */
    subcategory?: number;
    /** 归属用户 */
    userId: string;
    /** 日期，精确到天，如 20260727 */
    date: number;
    /** 创建时排重用，32 位 uuid */
    transaction: string;
    /** 任务内容 */
    detail: string;
    /** 图片或视频，预留 */
    medias?: string;
    /** 完成时提交的反馈内容（JSON） */
    remark?: string;
    /** 完成时提交的图片或视频 */
    mediaRemark?: string;
    // 任务计划开始时间
    planTime?: number;
    // 任务持续时间
    duration?: number;
    /** 创建时间 */
    createTime: number;
    /** 完成时间 */
    finishTime?: number;
  }

  export interface Stat extends Entity.Id {
    // 累计任务
    total: number;
    // 已完成的任务。
    finished: number;
    // 总天数
    days?: number;
    /**
     * 连续天数。
     */
    rowDays?: number;
  }

  export function isDone(info?: Info): boolean {
    return info?.status === Status.Done;
  }

  /**
   * 获取指定日期的任务列表
   */
  export async function list(date: number, userId?: string): Promise<number | Info[]> {
    const res = await Network.post<Info[]>(Api.ListRoutine, { date, userId });
    if (res?.errcode !== 0) {
      Logger.warn('List routine failed', res);
      return res?.errcode || Err.Code.Network;
    }
    return res.data ?? [];
  }

  /**
   * 创建新任务
   */
  export async function create(data: Partial<Info>): Promise<number | Info> {
    const res = await Network.post<Info[]>(Api.CreateRoutine, { data: [data] });
    if (res?.errcode !== 0 || res.data?.length !== 1) {
      Logger.info('Create routine failed', res);
      return res?.errcode || Err.Code.Network;
    }
    return res.data[0];
  }

  /**
   * 更新任务（状态切换、内容编辑、保存反馈）
   */
  export async function update(data: Partial<Info>): Promise<number> {
    const res = await Network.post<Info>(Api.UpdateRoutine, { data: [data] });
    if (res.errcode !== 0) {
      Logger.info('Update routine failed', res);
      return res.errcode || Err.Code.Network;
    }
    return Err.Code.OK;
  }

  export async function stat(): Promise<number | Stat> {
    const res = await Network.post<Stat>(Api.StatRoutine);
    if (res?.errcode !== 0 || !res.data) {
      Logger.warn('Stat routine failed', res);
      return res?.errcode || Err.Code.Network;
    }
    return res.data;
  }

  /**
   * 生成排重用 transaction id
   */
  export function newTransaction(): string {
    return Utils.shortUuid();
  }
}

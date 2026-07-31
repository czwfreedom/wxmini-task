import { Api } from '../constant/api';
import { Err } from '../constant/error';
import { Context } from '../core/context';
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
    Working = 100,
    /** 已完成 */
    Done = 200,
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

  const sMock = true;

  let sMockItems: Info[] | null = null;

  function getMockItems(date: number): Info[] {
    if (!sMockItems) {
      const now = Date.now();
      const uid = Context.getUserId();
      const tx = () => Utils.shortUuid();
      sMockItems = [
        {
          id: '1',
          name: '《三体》第3章',
          detail: '约30分钟',
          status: Status.Working,
          category: Category.Reading,
          userId: uid,
          date,
          transaction: tx(),
          createTime: now,
        },
        {
          id: '2',
          name: '数学练习册 P20-25',
          detail: '约30分钟',
          status: Status.Working,
          category: Category.Homework,
          userId: uid,
          date,
          transaction: tx(),
          createTime: now,
        },
        {
          id: '3',
          name: '跳绳500个',
          detail: '约15分钟',
          status: Status.Working,
          category: Category.Exercise,
          userId: uid,
          date,
          transaction: tx(),
          createTime: now,
        },
        {
          id: '4',
          name: 'Minecraft 建造城堡',
          detail: '约30分钟',
          status: Status.Working,
          category: Category.Game,
          userId: uid,
          date,
          transaction: tx(),
          createTime: now,
        },
        {
          id: '5',
          name: '描红《静夜思》',
          detail: '约15分钟',
          status: Status.Done,
          category: Category.Handwriting,
          userId: uid,
          date,
          transaction: tx(),
          createTime: now,
          finishTime: now,
          remark: '笔画比昨天平整，心也静下来了',
        },
        {
          id: '6',
          name: 'Scratch 发射子弹',
          detail: '约45分钟',
          status: Status.Done,
          category: Category.Coding,
          userId: uid,
          date,
          transaction: tx(),
          createTime: now,
          finishTime: now,
        },
      ];
    }
    return sMockItems;
  }

  /**
   * 获取指定日期的任务列表
   */
  export async function list(date: number, userId?: string): Promise<number | Info[]> {
    // if (sMock) return getMockItems(date);
    if (sMock) return [];
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
  export async function update(id: string, patch: Partial<Info>): Promise<number> {
    if (sMock) {
      const item = sMockItems?.find((i) => i.id === id);
      if (item) Object.assign(item, patch);
      return Err.Code.OK;
    }
    const res = await Network.post<Info>(Api.UpdateRoutine, { id, ...patch });
    if (res.errcode !== 0) {
      Logger.info('Update routine failed', res);
      return res.errcode || Err.Code.Network;
    }
    return Err.Code.OK;
  }

  /**
   * 生成排重用 transaction id
   */
  export function newTransaction(): string {
    return Utils.shortUuid();
  }
}

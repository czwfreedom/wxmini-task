import { Api } from '../constant/api';
import { Err } from '../constant/error';
import { Network } from '../core/network';
import { Entity } from '../model/entity';
import { Logger } from '../utils/logger';
import { Utils } from '../utils/utils';
import { User } from './user';

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
     * 笔记
     */
    Note = 14,

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
    /**
     * 委托用户
     */
    delegated?: string;

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

    stat?: Comment;
  }

  export interface Comment {
    count: number;
    comment: number;
    liked: number;
    commented: number;
  }

  /**
   * 跳转「创建 / 完成任务」页时携带的数据。
   *
   * 比 Info 多一个 partner 的原因：署名（昵称、头像色）在列表页已经解析好了，
   * 完成页直接渲染即可，不必为了一个昵称再查一次用户。
   */
  export interface Intent extends Partial<Info> {
    partner?: Entity.Image;
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

  export interface ListRequest extends Info {
    withStat: boolean;
    startDate: number;
    endDate: number;
    brief: boolean;
    //  若设置，拉到委托给自己的任务。
    // 只有查看自己的任务才需要这样。
    withDelegated: boolean;
  }

  export interface ListResponse {
    data: Info[];
    users?: User.Info[];
  }

  export function isNote(category?: number): boolean {
    return category === Category.Note;
  }

  /**
   * 是否叫上了伙伴。
   *
   * delegated 为 '0' 或空都表示「没叫人」—— '0' 是取消委托时的约定值，
   * 不能用 `!!delegated` 直接判断，否则取消后会仍然被当成有委托。
   *
   * 参数取 Pick 而非整个 Info：调用方常常只有 id 字符串，不必伪造一条任务。
   */
  export function hasDelegated(info?: Pick<Info, 'delegated'>): boolean {
    return !!info?.delegated && info.delegated !== '0';
  }

  /** 取归一化后的委托对象 id；未委托（含 '0' 与空）时返回空串。 */
  export function getDelegated(info?: Pick<Info, 'delegated'>): string {
    return hasDelegated(info) ? info!.delegated! : '';
  }

  export function isDone(info?: Info): boolean {
    return info?.status === Status.Done;
  }

  /**
   * 获取指定日期的任务列表
   */
  export async function list(data: Partial<ListRequest>): Promise<number | ListResponse> {
    const res = await Network.post<Info[]>(Api.ListRoutine, data);
    if (res?.errcode !== 0) {
      Logger.warn('List routine failed', res);
      return res?.errcode || Err.Code.Network;
    }
    return { data: res.data ?? [], users: res.users };
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
  export async function update(data: Partial<Info>): Promise<number | Info | undefined> {
    const res = await Network.post<Info[]>(Api.UpdateRoutine, { data: [data] });
    if (res.errcode !== 0) {
      Logger.info('Update routine failed', res);
      return res.errcode || Err.Code.Network;
    }
    return res?.data?.length === 1 ? res.data[0] : undefined;
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

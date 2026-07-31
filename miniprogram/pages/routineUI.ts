import { SubUI } from '../core/subUI';
import { Err } from '../constant/error';
import { Entity } from '../model/entity';
import { DateUtils } from '../utils/dateUtils';
import { Routine } from '../server/routine';
import { RoutineAdapter } from './routineAdapter';
import { Logger } from '../utils/logger';

export namespace RoutineUI {
  export interface Data extends SubUI.Data {
    updateable: boolean;
    addable: boolean;
    /** 任务列表 */
    records: Record[];
    /** 日期主文本，如「7月28日 周二」 */
    dateMain: string;

    stats: Entity.Label[];
  }

  /** ViewModel，仅包含 UI 渲染需要的字段 */
  export interface Record extends Entity.Label {
    holder?: boolean;
    /** 任务详情 */
    detail: string;
    /** 任务分类 */
    category: number;
    /** 分类展示名 */
    categoryName: string;
    /** 分类颜色 */
    color: string;
    /** 分类图标路径 */
    icon: string;
    /** 任务状态 */
    status: number;
    /** 完成时间 */
    finishTime?: number;
    /** 反馈内容 */
    remark?: string;
  }
}

export class RoutineUI extends SubUI<RoutineUI.Data> {
  private adapter = new RoutineAdapter();

  public constructor(component: any) {
    super(component);

    this.bindEvent('onTaskTap', this.onTaskTap);
    this.bindEvent('onAddTap', this.onAddTap);

    this.registerEventBus('routineChanged', this.onRoutineChanged.bind(this));
  }

  public static getDefaultData(): RoutineUI.Data {
    return {
      loaded: false,
      abortMessage: '',
      updateable: false,
      addable: false,
      records: [],
      dateMain: '',
      stats: [],
    };
  }

  public async loadData(): Promise<number> {
    const now = Date.now();
    const errcode = await this.adapter.load(DateUtils.getStartMillisOfDay(now));
    if (errcode !== Err.Code.OK) return this.abort(errcode);

    const records = this.adapter.adapt();
    this.setData({
      records,
      loaded: true,
      dateMain: DateUtils.formatDate(now, 'M月d日 周E'),
      ...records,
    });
    return 0;
  }

  /** 切换任务状态：进行中 ↔ 已完成 */
  protected async onTaskTap(e: WechatMiniprogram.TouchEvent) {
    const { id, status } = e.currentTarget.dataset;
    const nextStatus =
      status === Routine.Status.Done ? Routine.Status.Working : Routine.Status.Done;

    Logger.info('onTaskTap', id, status, '->', nextStatus);

    const errcode = await Routine.update(id, { status: nextStatus });
    if (errcode !== Err.Code.OK) {
      this.showErrToast(errcode);
      return;
    }
    await this.loadData();
  }

  /** 添加新任务 */
  protected onAddTap() {
    Logger.info('onAddTap');
    wx.navigateTo({ url: '/pages/createRoutine' });
  }

  /** 监听任务变更事件（创建成功后刷新列表） */
  protected onRoutineChanged(_params: any) {
    Logger.info('routineChanged received, reloading');
    this.loadData();
  }
}

import { SubUI } from '../core/subUI';
import { Err } from '../constant/error';
import { Entity } from '../model/entity';
import { DateUtils } from '../utils/dateUtils';
import { Routine } from '../server/routine';
import { RoutineAdapter } from './routineAdapter';
import { Logger } from '../utils/logger';

export namespace RoutineUI {
  export interface Data extends SubUI.Data {
    /** 任务列表 */
    records: Record[];
    /** 日期主文本，如「7月28日 周二」 */
    dateMain: string;
    /** 已规划数量 */
    plannedCount: number;
    /** 待反馈数量 */
    feedbackCount: number;
    /** 已完成数量 */
    doneCount: number;
  }

  /** ViewModel，仅包含 UI 渲染需要的字段 */
  export interface Record extends Entity.Label {
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
  }

  public static getDefaultData(): RoutineUI.Data {
    return {
      loaded: false,
      abortMessage: '',
      records: [],
      dateMain: '',
      plannedCount: 0,
      feedbackCount: 0,
      doneCount: 0,
    };
  }

  public async loadData() {
    this.showLoading();
    const now = Date.now();
    this.setData({ dateMain: DateUtils.formatDate(now, 'M月d日 周E') });

    const errcode = await this.adapter.load(DateUtils.getStartMillisOfDay(now));
    if (errcode !== Err.Code.OK) {
      this.abort(errcode);
      return;
    }

    const records = this.adapter.adapt();
    this.setData({
      records,
      loaded: true,
      plannedCount: records.filter((r) => r.status !== Routine.Status.Done).length,
      doneCount: records.filter((r) => r.status === Routine.Status.Done).length,
      feedbackCount: records.filter((r) => r.status === Routine.Status.Done && !r.remark).length,
    });
    this.hideLoading();
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
    // TODO: 跳转到创建任务页
  }
}

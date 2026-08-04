import { SubUI } from '../core/subUI';
import { Err } from '../constant/error';
import { Entity } from '../model/entity';
import { DateUtils } from '../utils/dateUtils';
import { Routine } from '../server/routine';
import { RoutineAdapter } from './routineAdapter';
import { Logger } from '../utils/logger';
import { Event } from '../core/event';
import { Context } from '../core/context';
import { Intent } from '../core/intent';
import { Constants } from '../constant/common';

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
  protected adapter = new RoutineAdapter();
  protected date: number;
  protected userId: string;

  public constructor(component: any) {
    super(component);

    this.date = DateUtils.getStartMillisOfDay(Date.now());
    this.userId = Context.getUserId();

    this.bindEvent('onItemTap', this.onItemTap);
    this.bindEvent('onAddTap', this.onAddTap);

    this.registerEventBus(Event.Name.RoutineUpdated, (ev: Routine.Info) => {
      if (ev?.id && ev?.userId === this.userId && this.date === ev.date) {
        this.adapter.addInfo(ev);
        this.updateView();
      }
    });
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
    const errcode = await this.adapter.load(this.date);
    if (errcode !== Err.Code.OK) return this.abort(errcode);

    const records = this.adapter.adapt();
    this.setData({
      loaded: true,
      dateMain: DateUtils.formatDate(this.date, 'M月d日 周E'),
      ...records,
    });
    return 0;
  }

  protected updateView() {
    this.setData({ ...this.adapter.adapt() });
  }

  /** 切换任务状态：进行中 ↔ 已完成 */
  protected async onItemTap(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset;

    const vm = Entity.find(this.getData().records, id).item;
    const info = this.adapter.getInfo(id);
    if (vm && !info) {
      if (id.startsWith('holder')) {
        Intent.navigateTo(Constants.Page.CreateRoutine, { category: vm.category });
      }
    } else {
    }
  }

  /** 添加新任务 */
  protected onAddTap() {
    Logger.info('onAddTap');
    wx.navigateTo({ url: '/pages/createRoutine' });
  }
}

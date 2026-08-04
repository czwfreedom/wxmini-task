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
    /** 是否今天（历史日期为 false，Hero 褪色 + 显示回到今天） */
    isToday: boolean;
    /** 日期标签：今天是 / 回顾那一天 */
    dateLabel: string;
    /** 日期主文本，如「7月28日 周二」 */
    dateMain: string;
    /** 日期选择器当前值，如「2026-08-03」 */
    pickerValue: string;
    /** 日期选择器上限（今天），禁选未来 */
    pickerEnd: string;

    stats: Entity.Label[];
  }

  /** ViewModel，仅包含 UI 渲染需要的字段 */
  export interface Record extends Entity.Label {
    holder?: boolean;
    /** 任务详情 */
    detail: string;
    /** 任务分类 */
    category: number;
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
    this.bindEvent('onPrevDay', this.onPrevDay);
    this.bindEvent('onNextDay', this.onNextDay);
    this.bindEvent('onDatePicked', this.onDatePicked);
    this.bindEvent('onBackToday', this.onBackToday);

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
      isToday: true,
      dateLabel: '',
      dateMain: '',
      pickerValue: '',
      pickerEnd: '',
      stats: [],
    };
  }

  public async loadData(): Promise<number> {
    return this.loadDate(this.date);
  }

  /** 加载指定日期并刷新视图，供翻页/选择器/回到今天复用 */
  protected async loadDate(date: number): Promise<number> {
    this.date = date;
    const errcode = await this.adapter.load(this.date);
    if (errcode !== Err.Code.OK) return this.abort(errcode);

    const today = DateUtils.getStartMillisOfDay(Date.now());
    const isToday = this.date === today;
    this.setData({
      loaded: true,
      isToday,
      dateLabel: isToday ? '今天是' : '回顾',
      dateMain: DateUtils.formatDate(this.date, 'M月d日 周E'),
      pickerValue: DateUtils.formatDate(this.date, 'yyyy-MM-dd'),
      pickerEnd: DateUtils.formatDate(today, 'yyyy-MM-dd'),
      ...this.adapter.adapt(),
    });
    return 0;
  }

  /** 前一天 */
  protected onPrevDay() {
    Logger.info('onPrevDay');
    this.loadDate(this.date - 24 * 3600 * 1000);
  }

  /** 后一天，今天已到上限则禁用（WXML 同步置灰） */
  protected onNextDay() {
    Logger.info('onNextDay');
    const today = DateUtils.getStartMillisOfDay(Date.now());
    const next = this.date + 24 * 3600 * 1000;
    if (next > today) return;
    this.loadDate(next);
  }

  /** 原生日期选择器（picker mode="date"），上限今天 */
  protected onDatePicked(e: WechatMiniprogram.TouchEvent) {
    const value = (e.detail.value as string) || '';
    Logger.info('onDatePicked', value);
    const millis = DateUtils.getStartMillisOfDay(new Date(value.replace(/-/g, '/')).getTime());
    if (!millis || millis === this.date) return;
    this.loadDate(millis);
  }

  /** 回到今天 */
  protected onBackToday() {
    Logger.info('onBackToday');
    this.loadDate(DateUtils.getStartMillisOfDay(Date.now()));
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
    Intent.navigateTo(Constants.Page.CreateRoutine);
  }
}

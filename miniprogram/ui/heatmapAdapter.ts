import { DateUtils } from '../utils/dateUtils';
import { HeatmapUI } from './heatmapUI';

export abstract class HeatmapAdapter {
  public today: number;
  public day: number;
  /** 当前展示月份第一天 00:00 的时间戳 */
  public monthMillis: number;

  public constructor(day: number) {
    this.day = day;
    this.monthMillis = DateUtils.getMonth(day);
    this.today = DateUtils.getToday();
  }

  /** 当前月的起始时间戳 */
  public getMonthMillis(): number {
    return this.monthMillis;
  }

  /** 是否还能上一月（无限制） */
  public prevable(): boolean {
    return true;
  }

  /** 是否还能下一月（不允许超过当前真实月份） */
  public nextable(): boolean {
    return this.monthMillis < DateUtils.getMonth(this.today);
  }

  public nextMonth(): number {
    const days = DateUtils.daysInMonth(this.monthMillis);
    return this.monthMillis + days * DateUtils.sDayMillis;
  }

  public prevMonth(): number {
    return DateUtils.getMonth(this.getMonthMillis() - DateUtils.sDayMillis);
  }

  // 按月加载数据.
  // 当点击下一月、上一月时使用。
  // 初始化时？
  public abstract load(date?: number): Promise<number>;

  public abstract adapt(): HeatmapUI.Data;
}

import { HeatmapAdapter } from '../heatmapAdapter';
import { HeatmapUI } from '../heatmapUI';
import { Routine } from '../../server/routine';
import { DateUtils } from '../../utils/dateUtils';
import { Err } from '../../constant/error';
import { Entity } from '../../model/entity';
import { Locale } from '../../constant/locale';

export class RoutineHeatAdapter extends HeatmapAdapter {
  private userId: string;
  private today: number;
  private day: number;
  /** 当前展示月份第一天 00:00 的时间戳 */
  private monthMillis: number;
  /** 聚合结果：日期整数 → { finished, total } */
  private aggs = new Map<number, { finished: number; total: number }>();

  public constructor(userId: string, day: number) {
    super();
    this.userId = userId;
    this.day = day;
    this.monthMillis = DateUtils.getMonth(day);
    this.today = DateUtils.getToday();
  }

  /** 当前月的起始时间戳 */
  public getMonthMillis(): number {
    return this.monthMillis;
  }

  /** 是否还能上一月（无限制） */
  public canPrev(): boolean {
    return true;
  }

  /** 是否还能下一月（不允许超过当前真实月份） */
  public canNext(): boolean {
    return this.monthMillis < DateUtils.getMonth(this.today);
  }

  public async load(date?: number): Promise<number> {
    if (date !== undefined) this.monthMillis = DateUtils.getMonth(date);

    const days = DateUtils.daysInMonth(this.monthMillis);
    const endMillis = this.monthMillis + days * DateUtils.sDayMillis;

    const result = await Routine.list({
      userId: this.userId,
      startDate: this.monthMillis,
      endDate: endMillis,
      brief: true,
    });
    if ('number' === typeof result) return result;

    this.aggs.clear();
    for (const info of result) {
      const cur = this.aggs.get(info.date) ?? { finished: 0, total: 0 };
      cur.total += 1;
      if (info.status === Routine.Status.Done) cur.finished += 1;
      this.aggs.set(info.date, cur);
    }
    return Err.Code.OK;
  }

  public adapt(): HeatmapUI.Data {
    const days = DateUtils.daysInMonth(this.monthMillis);
    const leading = (new Date(this.monthMillis).getDay() + 6) % 7; // 周一为第一列
    const items: Entity.Label[] = [];

    // 月初前的空白占位（id 为空串）
    for (let i = 0; i < leading; i++) {
      items.push({ id: '', name: '', desc: '', style: RoutineHeatAdapter.Style.Blank });
    }

    for (let d = 1; d <= days; d++) {
      const dayMillis = this.monthMillis + (d - 1) * DateUtils.sDayMillis;
      const cur = this.aggs.get(dayMillis);
      const total = cur?.total ?? 0;
      const finished = cur?.finished ?? 0;

      items.push({
        id: '' + dayMillis,
        name: '' + d,
        desc: total > 0 ? `${finished}/${total}` : '—',
        style: this.resolveStyle(total, finished),
        selected: dayMillis === this.day,
      });
    }

    // 月末后的空白占位，补齐整周
    const trailing = (7 - (items.length % 7)) % 7;
    for (let i = 0; i < trailing; i++) {
      items.push({ id: '', name: '', desc: '', style: RoutineHeatAdapter.Style.Blank });
    }

    return {
      id: 'routine',
      weekdays: Locale.sWeekdays,
      name: DateUtils.formatDate(this.monthMillis, 'yyyy年 M月'),
      nextable: this.canNext(),
      prevable: this.canPrev(),
      items,
      legends: RoutineHeatAdapter.sLegends,
    };
  }

  private resolveStyle(total: number, finished: number): string {
    if (total === 0) return RoutineHeatAdapter.Style.None;
    if (finished >= total) return RoutineHeatAdapter.Style.Done;
    if (finished === 0) return RoutineHeatAdapter.Style.Pending;
    return RoutineHeatAdapter.Style.Partial;
  }
}

export namespace RoutineHeatAdapter {
  /** 四态样式值（与 HeatmapUI.Data.items.style 约定一致） */
  export const enum Style {
    Done = 'done',
    Partial = 'partial',
    Pending = 'pending',
    None = 'none',
    Blank = '',
  }

  /** 图例（与设计方案 E 一致） */
  export const sLegends: Entity.Label[] = [
    { id: 'done', name: '全部完成', style: Style.Done },
    { id: 'partial', name: '有未完', style: Style.Partial },
    { id: 'pending', name: '全未完', style: Style.Pending },
    { id: 'none', name: '无任务', style: Style.None },
  ];
}

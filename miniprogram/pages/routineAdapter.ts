import { Err } from '../constant/error';
import { Routine } from '../server/routine';
import { RoutineUI } from './routineUI';

/** 分类颜色映射 */
const sCategoryColors: Record<number, string> = {
  [Routine.Category.Reading]: '#FFB74D',
  [Routine.Category.Homework]: '#64B5F6',
  [Routine.Category.Exercise]: '#81C784',
  [Routine.Category.Chores]: '#BA68C8',
  [Routine.Category.Game]: '#F06292',
  [Routine.Category.Handwriting]: '#4DB6AC',
  [Routine.Category.Instrument]: '#A1887F',
  [Routine.Category.Drawing]: '#FFD54F',
  [Routine.Category.Coding]: '#4FC3F7',
};

/** 分类图标路径映射 */
const sCategoryIcons: Record<number, string> = {
  [Routine.Category.Reading]: '/assets/imgs/ic-reading.svg',
  [Routine.Category.Homework]: '/assets/imgs/ic-homework.svg',
  [Routine.Category.Exercise]: '/assets/imgs/ic-sport.svg',
  [Routine.Category.Chores]: '/assets/imgs/ic-housework.svg',
  [Routine.Category.Game]: '/assets/imgs/ic-game.svg',
  [Routine.Category.Handwriting]: '/assets/imgs/ic-calligraphy.svg',
  [Routine.Category.Instrument]: '/assets/imgs/ic-instrument.svg',
  [Routine.Category.Drawing]: '/assets/imgs/ic-drawing.svg',
  [Routine.Category.Coding]: '/assets/imgs/ic-coding.svg',
};

export class RoutineAdapter {
  private infos: Routine.Info[] = [];

  /** 加载指定日期的任务数据，返回错误码 */
  async load(date: number): Promise<number> {
    const result = await Routine.list(date);
    if (typeof result === 'number') return result;
    this.infos = result;
    return Err.Code.OK;
  }

  /** 将加载到的数据转换为 ViewModel，按状态排序：进行中 > 未开始 > 已完成 */
  adapt(): RoutineUI.Record[] {
    const records = this.infos.map((info) => {
      const done = info.status === Routine.Status.Done;
      const working = info.status === Routine.Status.Working;
      return {
        id: info.id,
        name: info.name,
        detail: info.detail,
        category: info.category,
        categoryName: Routine.sCategories[info.category] || '',
        color: sCategoryColors[info.category] || '#FFB74D',
        icon: sCategoryIcons[info.category] || '',
        status: info.status,
        finishTime: info.finishTime,
        remark: info.remark,
        style: done ? 'done' : working ? 'working' : '',
      };
    });
    records.sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === Routine.Status.Working) return -1;
        if (b.status === Routine.Status.Working) return 1;
        if (a.status === Routine.Status.Pending) return -1;
        if (b.status === Routine.Status.Pending) return 1;
      }
      return 0;
    });
    return records;
  }
}

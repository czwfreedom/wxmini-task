import { Err } from '../constant/error';
import { Routine } from '../server/routine';
import { RoutineUI } from './routineUI';

export class RoutineAdapter {
  protected infos: Routine.Info[] = [];

  /** 加载指定日期的任务数据，返回错误码 */
  public async load(date: number): Promise<number> {
    const result = await Routine.list(date);
    if (typeof result === 'number') return result;
    this.infos = result;
    return Err.Code.OK;
  }

  /** 将加载到的数据转换为 ViewModel，按状态排序：进行中 > 已完成 */
  public adapt(): Partial<RoutineUI.Data> {
    const records: RoutineUI.Record[] = [];
    let count = 0;
    let doneCount = 0;
    let pendingCount = 0;

    for (const info of this.infos || []) {
      const done = info.status === Routine.Status.Done;
      const config = RoutineAdapter.sConfigs[info.category];
      count++;
      if (done) {
        doneCount++;
      } else {
        pendingCount++;
      }

      const record: RoutineUI.Record = {
        id: info.id,
        name: info.name,
        detail: info.detail,
        category: info.category,
        categoryName: Routine.sCategories[info.category] || '',
        color: config.color || '#f4b942',
        icon: config.icon || '/assets/imgs/ic-reading.svg',
        status: info.status,
        finishTime: info.finishTime,
        remark: info.remark,
        style: done ? 'done' : '',
      };
      records.push(record);
    }

    if (records.length && records.length > 1) {
      records.sort((a, b) => {
        if (a.status === b.status) return 0;
        return a.status === Routine.Status.Working ? -1 : 1;
      });
    }

    return {
      records,
      stats: [
        { id: 'count', name: `已规划 ${count}` },
        { id: 'pending', name: `待反馈 ${pendingCount}`, style: 'pending' },
        { id: 'done', name: `已完成 ${doneCount}`, style: 'done' },
      ],
    };
  }
}

export namespace RoutineAdapter {
  export interface Config {
    color: string;
    icon: string;
  }

  // 先放在这。未来多了，放到后台。小程序的空间有限。
  export const sConfigs: Record<number, Config> = {
    [Routine.Category.Reading]: {
      color: '#f4b942',
      icon: '/assets/imgs/ic-reading.svg',
    },
    [Routine.Category.Homework]: {
      color: '#64B5F6',
      icon: '/assets/imgs/ic-homework.svg',
    },
    [Routine.Category.Exercise]: {
      color: '#81C784',
      icon: '/assets/imgs/ic-sport.svg',
    },
    [Routine.Category.Chores]: {
      color: '#BA68C8',
      icon: '/assets/imgs/ic-housework.svg',
    },
    [Routine.Category.Game]: {
      color: '#F06292',
      icon: '/assets/imgs/ic-game.svg',
    },
    [Routine.Category.Handwriting]: {
      color: '#4DB6AC',
      icon: '/assets/imgs/ic-calligraphy.svg',
    },
    [Routine.Category.Instrument]: {
      color: '#A1887F',
      icon: '/assets/imgs/ic-instrument.svg',
    },
    [Routine.Category.Drawing]: {
      color: '#FFD54F',
      icon: '/assets/imgs/ic-drawing.svg',
    },
    [Routine.Category.Coding]: {
      color: '#4FC3F7',
      icon: '/assets/imgs/ic-coding.svg',
    },
  };
}

import { Err } from '../constant/error';
import { Context } from '../core/context';
import { Entity } from '../model/entity';
import { Routine } from '../server/routine';
import { DateUtils } from '../utils/dateUtils';
import { RoutineUI } from './routineUI';

export class RoutineAdapter {
  protected infos: Routine.Info[] = [];
  protected updateable = false;
  protected addable = false;

  protected date = 0;

  protected defaults = RoutineAdapter.getDefaults();

  public getInfo(id: string): Routine.Info | undefined {
    return Entity.find(this.infos, id).item;
  }

  public addInfo(info: Routine.Info) {
    const res = Entity.find(this.infos, info.id);
    if (res.index >= 0) {
      this.infos[res.index] = info;
    } else {
      this.infos.push(info);
    }
  }

  /** 加载指定日期的任务数据，返回错误码 */
  public async load(date: number, userId?: string): Promise<number> {
    this.date = date;
    this.updateable = !userId || userId === Context.getUserId();
    this.addable = this.updateable && date === DateUtils.getStartMillisOfDay(Date.now());
    const result = await Routine.list(date, userId);
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

    const infos = this.fillHolders();
    for (const info of infos) {
      const holder = info.id.startsWith('holder');
      const done = info.status === Routine.Status.Done;
      const config = RoutineAdapter.findConfig(info.category)!;
      if (!holder) {
        count++;
        if (done) {
          doneCount++;
        } else {
          pendingCount++;
        }
      }

      const detail = `${config.name} · ${DateUtils.formatDate(info.planTime || Date.now(), 'hh:mm')}开始 · ${Math.floor(info.duration || 1800000) / 60000}分钟`;

      const record: RoutineUI.Record = {
        id: info.id,
        name: info.detail,
        detail: detail,
        category: info.category,
        color: config.color || '#f4b942',
        icon: config.icon || '/assets/imgs/ic-reading.svg',
        status: info.status,
        finishTime: info.finishTime,
        remark: info.remark,
        holder: holder,
        style: done ? 'done' : holder ? 'holder' : '',
      };
      records.push(record);
    }

    if (records.length && records.length > 1) {
      records.sort((a, b) => {
        if (a.status === b.status) return 0;
        return a.status === Routine.Status.Working ? -1 : 1;
      });
    }

    const isAllDone = count > 0 && doneCount === count;

    return {
      updateable: this.updateable,
      addable: this.addable,
      isAllDone,
      records,
      stats: [
        { id: 'count', name: `已规划 ${count}` },
        { id: 'pending', name: `待反馈 ${pendingCount}`, style: 'pending' },
        { id: 'done', name: `已完成 ${doneCount}`, style: 'done' },
      ],
    };
  }

  protected getHolder(category: Routine.Category): Routine.Info {
    const config = RoutineAdapter.findConfig(category);
    return {
      id: 'holder' + category,
      name: config.name,
      detail: '',
      status: Routine.Status.Working,
      category: category,
      userId: '',
      date: this.date,
      transaction: '',
      createTime: Date.now(),
    };
  }

  protected fillHolders(): Routine.Info[] {
    const result = [...this.infos];
    if (!this.addable) return result;
    // 也不非要默认的不可，超过3个以上，就当作有数据了
    if (result.length >= 3) return result;

    const exists = result.map((item) => item.category);
    for (const category of this.defaults) {
      if (!exists.includes(category)) {
        result.push(this.getHolder(category));
      }
    }
    return result;
  }
}

export namespace RoutineAdapter {
  export interface Config {
    /** 分类枚举值 */
    category: number;
    name: string;
    color: string;
    icon: string;
    /** 是否为默认/常用分类，true 的展示在创建页常用区域 */
    default?: boolean;
    /** 各分类的快捷示例提示词 */
    examples?: string[];
    finish?: string;
  }

  /** 所有分类统一配置：分类枚举、颜色、图标、是否默认、示例提示词 */
  // 先放在这。未来多了，放到后台。小程序的空间有限。
  export const sConfigs: Config[] = [
    {
      category: Routine.Category.Reading,
      name: '阅读',
      color: '#f4b942',
      icon: '/assets/imgs/ic-reading.svg',
      default: true,
      examples: ['《三体》第3章', '英语绘本朗读', '读书笔记一页'],
      finish: '哪一句印象最深刻？',
    },
    {
      category: Routine.Category.Homework,
      name: '作业',
      color: '#64B5F6',
      icon: '/assets/imgs/ic-homework.svg',
      default: true,
      examples: ['数学练习册 P20', '背诵古诗一首', '英语单词10个'],
      finish: '做完感觉怎么样？',
    },
    {
      category: Routine.Category.Exercise,
      name: '运动',
      color: '#81C784',
      icon: '/assets/imgs/ic-sport.svg',
      default: true,
      examples: ['跳绳500个', '跑步15分钟', '仰卧起坐30个'],
      finish: '出汗了吗？运动完爽不爽？',
    },
    {
      category: Routine.Category.Chores,
      name: '家务',
      color: '#BA68C8',
      icon: '/assets/imgs/ic-housework.svg',
      examples: ['整理书桌', '扫地拖地', '浇花'],
      finish: '家里是不是变整洁了？',
    },
    {
      category: Routine.Category.Game,
      name: '游戏',
      color: '#F06292',
      icon: '/assets/imgs/ic-game.svg',
      examples: ['Minecraft 建造', '拼图100片', '数独一局'],
      finish: '今天玩得最开心的是什么？',
    },
    {
      category: Routine.Category.Handwriting,
      name: '练字',
      color: '#4DB6AC',
      icon: '/assets/imgs/ic-calligraphy.svg',
      examples: ['描红一页', '临摹《兰亭序》', '硬笔字帖'],
      finish: '哪个字写得最好看？',
    },
    {
      category: Routine.Category.Instrument,
      name: '音乐',
      color: '#A1887F',
      icon: '/assets/imgs/ic-instrument.svg',
      examples: ['音阶练习10遍', '练习曲第3首', '复习和弦'],
      finish: '哪一段弹得最顺？',
    },
    {
      category: Routine.Category.Drawing,
      name: '绘画',
      color: '#FFD54F',
      icon: '/assets/imgs/ic-drawing.svg',
      examples: ['素描静物', '水彩风景', '卡通人物'],
      finish: '画了什么？满意吗？',
    },
    {
      category: Routine.Category.Coding,
      name: '编程',
      color: '#4FC3F7',
      icon: '/assets/imgs/ic-coding.svg',
      examples: ['Scratch 发射子弹', 'Python 小游戏', '网页制作'],
      finish: '搞定什么Bug了？',
    },
    {
      category: Routine.Category.Practice,
      name: '社会实践',
      color: '#FF8A65',
      icon: '/assets/imgs/ic-practice.svg',
      examples: ['摆摊体验', '社区志愿服务', '参观博物馆'],
      finish: '今天有什么新收获？',
    },
    {
      category: Routine.Category.QA,
      name: '问答',
      color: '#7986CB',
      icon: '/assets/imgs/ic-qa.svg',
      default: true,
      examples: ['每日一问', '百科知识问答', '成语接龙'],
      finish: '今天问了什么有趣的问题？',
    },
    {
      category: Routine.Category.Job,
      name: '工作',
      color: '#26C6DA',
      icon: '/assets/imgs/ic-job.svg',
      examples: ['处理工作消息', '完成项目方案', '整理会议纪要'],
      finish: '今天搞定了什么大事？',
    },
    {
      category: Routine.Category.Shoot,
      name: '拍摄',
      color: '#EF5350',
      icon: '/assets/imgs/ic-shoot.svg',
      examples: ['拍一段 Vlog', '录制朗读视频', '拍摄全家福'],
      finish: '拍到了什么精彩画面？',
    },
    {
      category: Routine.Category.Other,
      name: '其他',
      color: '#90A4AE',
      icon: '/assets/imgs/ic-other.svg',
      examples: ['帮妈妈一个忙', '整理书包', '自由探索'],
    },
  ];

  /** 按分类枚举值查找配置 */
  export function findConfig(category: number): Config {
    const r = sConfigs.find((c) => c.category == category);
    if (r) return r;
    return {
      category: category,
      name: '其他',
      color: '#90A4AE',
      icon: '/assets/imgs/ic-other.svg',
    };
  }

  /** 获取所有默认/常用分类 ID */
  export function getDefaults(v = true): Routine.Category[] {
    return sConfigs.filter((c) => !!c.default === v).map((c) => c.category);
  }

  /** 获取所有非默认/更多分类 ID */
  export function getMoreCategoryIds(): Routine.Category[] {
    return sConfigs.filter((c) => !c.default).map((c) => c.category);
  }

  /** 获取指定分类的完成反馈提示词 */
  export function getFinish(category: number): string {
    return findConfig(category)?.finish || '做完啦，有什么想说的？';
  }
}

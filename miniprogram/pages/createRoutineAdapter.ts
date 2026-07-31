import { Routine } from '../server/routine';
import { RoutineAdapter } from './routineAdapter';
import { CreateRoutineUI } from './createRoutineUI';

/**
 * 创建任务页的数据适配器。
 * 所有列表数据由 Adapter 产出，WXML 不写死任何列表项。
 * 分类配置统一从 RoutineAdapter.sConfigs / findConfig 读取。
 */
export class CreateRoutineAdapter {
  /** 自定义时长入口的 sentinel */
  public static readonly kCustomDurationMinutes = -1;

  // ---- 计划时长选项（10分钟 · 25番茄钟 · 30 · 45 · 1小时 · 其他） ----
  private static sDurations: CreateRoutineUI.Duration[] = [
    { id: '10', name: '10', desc: '分钟' },
    { id: '25', name: '25', desc: '分钟' },
    { id: '30', name: '30', desc: '分钟', selected: true },
    { id: '45', name: '45', desc: '分钟' },
    { id: '60', name: '1', desc: '小时' },
    { id: 'custom', name: '其他', desc: '' },
  ];

  /** 计划时间选项（整点快捷 + 自定义入口），构建时按当前小时过滤已过时间 */
  private static readonly sTimes: CreateRoutineUI.Time[] = [
    { id: 'now', name: '现在', selected: true },
    { id: '08:00', name: '08:00' },
    { id: '09:00', name: '09:00' },
    { id: '10:00', name: '10:00' },
    { id: '11:00', name: '11:00' },
    { id: '14:00', name: '14:00' },
    { id: '15:00', name: '15:00' },
    { id: '16:00', name: '16:00' },
    { id: '17:00', name: '17:00' },
    { id: '19:00', name: '19:00' },
    { id: '20:00', name: '20:00' },
    { id: '21:00', name: '21:00' },
    { id: 'custom', name: '其他' },
  ];

  // ---- 构建方法 ----

  /** 获取常用分类 VM 列表（从 sConfigs 中 default=true 的分类） */
  public adaptCategories(): CreateRoutineUI.Category[] {
    return RoutineAdapter.getDefaults().map((id) => this.buildCategoryVM(id));
  }

  /** 获取更多分类 VM 列表（从 sConfigs 中 default 不为 true 的分类），可传入已选 ID 预选 */
  public adaptMoreCategories(selectedId?: number): CreateRoutineUI.Category[] {
    return RoutineAdapter.getDefaults(false).map((id) => {
      const item = this.buildCategoryVM(id);
      if (selectedId && selectedId === id) item.selected = true;
      return item;
    });
  }

  /** 获取指定分类的示例提示词 VM 列表（从 sConfigs.examples 读取，空数组则不展示） */
  public adaptExamples(category: number): CreateRoutineUI.Example[] {
    const config = RoutineAdapter.findConfig(category);
    const texts = config?.examples || [];
    return texts.map((text, i) => ({
      id: `ex_${category}_${i}`,
      name: text,
    }));
  }

  /** 获取计划时长选项 VM 列表（带选中态），末尾"其他"为虚线自定义入口 */
  public adaptDurations(selectedMinutes?: number): CreateRoutineUI.Duration[] {
    return CreateRoutineAdapter.sDurations.map((o) => Object.assign({}, o));
  }

  /** 获取计划时间选项 VM 列表（按当前小时过滤已过时间 + 带选中态），末尾为自定义入口 */
  public adaptTimes(hour: number): CreateRoutineUI.Time[] {
    const filtered = CreateRoutineAdapter.sTimes.filter((item) => {
      if (item.id === 'now' || item.id === 'custom') return true;
      const itemHour = parseInt(item.id.split(':')[0], 10);
      return itemHour > hour;
    });
    return filtered.map((item) => ({ ...item }));
  }

  /** 判断分类 ID 是否属于「更多分类」 */
  public isMoreCategory(category: number): boolean {
    return !RoutineAdapter.findConfig(category).default;
  }

  public buildCategoryVM(id: Routine.Category): CreateRoutineUI.Category {
    const config = RoutineAdapter.findConfig(id);
    return { id: '' + id, name: config.name, avatar: config.icon, color: config.color };
  }
}

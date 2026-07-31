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
  private static sDurationOptions: CreateRoutineUI.DurationItem[] = [
    { id: 'd10', name: '10', desc: '分钟', minutes: 10 },
    { id: 'd25', name: '25', desc: '分钟', minutes: 25 },
    { id: 'd30', name: '30', desc: '分钟', minutes: 30 },
    { id: 'd45', name: '45', desc: '分钟', minutes: 45 },
    { id: 'd60', name: '1', desc: '小时', minutes: 60 },
    { id: 'custom', name: '其他', desc: '', minutes: CreateRoutineAdapter.kCustomDurationMinutes },
  ];

  /** 计划时间选项（整点快捷 + 自定义入口），构建时按当前小时过滤已过时间 */
  private static readonly sTimeOptionsRaw: CreateRoutineUI.TimeItem[] = [
    { id: 'now', name: '现在', timeValue: 'now' },
    { id: 't08', name: '08:00', timeValue: '08:00' },
    { id: 't09', name: '09:00', timeValue: '09:00' },
    { id: 't10', name: '10:00', timeValue: '10:00' },
    { id: 't11', name: '11:00', timeValue: '11:00' },
    { id: 't14', name: '14:00', timeValue: '14:00' },
    { id: 't15', name: '15:00', timeValue: '15:00' },
    { id: 't16', name: '16:00', timeValue: '16:00' },
    { id: 't17', name: '17:00', timeValue: '17:00' },
    { id: 't19', name: '19:00', timeValue: '19:00' },
    { id: 't20', name: '20:00', timeValue: '20:00' },
    { id: 't21', name: '21:00', timeValue: '21:00' },
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
  adaptDurations(selectedMinutes?: number): CreateRoutineUI.DurationItem[] {
    const selected = selectedMinutes ?? 30;
    return CreateRoutineAdapter.sDurationOptions.map((item) => ({
      ...item,
      selected: item.minutes === selected,
      style:
        item.minutes === selected
          ? 'selected'
          : item.minutes === CreateRoutineAdapter.kCustomDurationMinutes
            ? 'custom'
            : '',
    }));
  }

  /** 获取计划时间选项 VM 列表（按当前小时过滤已过时间 + 带选中态），末尾为自定义入口 */
  adaptTimes(nowHour?: number, selectedTimeValue?: string): CreateRoutineUI.TimeItem[] {
    const selected = selectedTimeValue || 'now';
    const hour = nowHour ?? new Date().getHours();
    const filtered = CreateRoutineAdapter.sTimeOptionsRaw.filter((item) => {
      if (item.timeValue === 'now') return true;
      const itemHour = parseInt(item.timeValue.split(':')[0], 10);
      return itemHour > hour;
    });

    // 判断选中值是否在预设列表内（含 'custom' 占位）
    const isPreset =
      selected === 'now' ||
      selected === 'custom' ||
      filtered.some((item) => item.timeValue === selected);

    // 自定义入口始终占最后一个位置，使用 timeValue='custom' 保持 picker 包裹
    // 当选中自定义时间时，name 显示时间值 + selected 样式；否则显示"其他" + custom 虚线
    const customEntry: CreateRoutineUI.TimeItem = {
      id: 'custom',
      name: isPreset ? '其他 ›' : selected,
      timeValue: 'custom',
    };

    const result = [...filtered, customEntry];

    return result.map((item) => ({
      ...item,
      selected: item.timeValue === selected || (!isPreset && item.timeValue === 'custom'),
      style:
        item.timeValue === selected
          ? 'selected'
          : item.timeValue === 'custom' && !isPreset
            ? 'selected'
            : item.timeValue === 'custom'
              ? 'custom'
              : '',
    }));
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

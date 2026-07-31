import { Routine } from '../server/routine';
import { RoutineAdapter } from './routineAdapter';
import { CreateRoutineUI } from './createRoutineUI';

/**
 * 创建任务页的数据适配器。
 * 所有列表数据由 Adapter 产出，WXML 不写死任何列表项。
 * 分类配置统一从 RoutineAdapter.sConfigs / findConfig 读取。
 */
export class CreateRoutineAdapter {
  // ---- 计划时长选项 ----
  private static sDurationOptions: CreateRoutineUI.DurationItem[] = [
    { id: 'd10', name: '10', desc: '分钟', minutes: 10 },
    { id: 'd15', name: '15', desc: '分钟', minutes: 15 },
    { id: 'd20', name: '20', desc: '分钟', minutes: 20 },
    { id: 'd30', name: '30', desc: '分钟', minutes: 30 },
    { id: 'd45', name: '45', desc: '分钟', minutes: 45 },
    { id: 'd60', name: '1', desc: '小时', minutes: 60 },
  ];

  /** 计划时间选项（整点快捷 + 自定义入口） */
  private static sTimeOptions: CreateRoutineUI.TimeItem[] = [
    { id: 'now', name: '现在', timeValue: 'now' },
    { id: 't08', name: '08:00', timeValue: '08:00' },
    { id: 't09', name: '09:00', timeValue: '09:00' },
    { id: 't10', name: '10:00', timeValue: '10:00' },
    { id: 't14', name: '14:00', timeValue: '14:00' },
    { id: 't15', name: '15:00', timeValue: '15:00' },
    { id: 't16', name: '16:00', timeValue: '16:00' },
    { id: 't19', name: '19:00', timeValue: '19:00' },
    { id: 't20', name: '20:00', timeValue: '20:00' },
    { id: 'custom', name: '其他', timeValue: 'custom' },
  ];

  // ---- 构建方法 ----

  /** 获取常用分类 VM 列表（从 sConfigs 中 default=true 的分类） */
  adaptCommonCategories(): CreateRoutineUI.CategoryItem[] {
    return RoutineAdapter.getDefaultCategoryIds().map((id) =>
      this.buildCategoryItem(id),
    );
  }

  /** 获取更多分类 VM 列表（从 sConfigs 中 default 不为 true 的分类） */
  adaptMoreCategories(): CreateRoutineUI.CategoryItem[] {
    return RoutineAdapter.getMoreCategoryIds().map((id) =>
      this.buildCategoryItem(id),
    );
  }

  /** 获取更多分类数量 */
  getMoreCategoryCount(): number {
    return RoutineAdapter.getMoreCategoryIds().length;
  }

  /** 获取指定分类的示例提示词 VM 列表（从 sConfigs.examples 读取，空数组则不展示） */
  adaptExamples(categoryId: number): CreateRoutineUI.ExampleChipItem[] {
    const config = RoutineAdapter.findConfig(categoryId);
    const texts = config?.examples || [];
    return texts.map((text, i) => ({
      id: `ex_${categoryId}_${i}`,
      name: text,
    }));
  }

  /** 获取计划时长选项 VM 列表（带选中态） */
  adaptDurations(selectedMinutes?: number): CreateRoutineUI.DurationItem[] {
    const selected = selectedMinutes ?? 30;
    return CreateRoutineAdapter.sDurationOptions.map((item) => ({
      ...item,
      selected: item.minutes === selected,
      style: item.minutes === selected ? 'selected' : '',
    }));
  }

  /** 获取计划时间选项 VM 列表（带选中态） */
  adaptTimes(selectedTimeValue?: string): CreateRoutineUI.TimeItem[] {
    const selected = selectedTimeValue || 'now';
    return CreateRoutineAdapter.sTimeOptions.map((item) => ({
      ...item,
      selected: item.timeValue === selected,
      style:
        item.timeValue === selected
          ? 'selected'
          : item.timeValue === 'custom'
            ? 'custom'
            : '',
    }));
  }

  /** 根据分类 ID 获取展示信息（名称/颜色/图标） */
  getCategoryInfo(
    categoryId: number,
  ): { name: string; color: string; icon: string } {
    const config = RoutineAdapter.findConfig(categoryId);
    return {
      name: Routine.sCategories[categoryId] || '',
      color: config?.color || '#f4b942',
      icon: config?.icon || '/assets/imgs/ic-reading.svg',
    };
  }

  // ---- 私有方法 ----

  private buildCategoryItem(id: Routine.Category): CreateRoutineUI.CategoryItem {
    const info = this.getCategoryInfo(id);
    return {
      id: `cat_${id}`,
      name: info.name,
      avatar: info.icon,
      icon: info.icon,
      color: info.color,
      categoryId: id,
    };
  }
}

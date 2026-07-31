import { SubUI } from '../core/subUI';
import { Err } from '../constant/error';
import { Entity } from '../model/entity';
import { Routine } from '../server/routine';
import { CreateRoutineAdapter } from './createRoutineAdapter';
import { Logger } from '../utils/logger';
import { DateUtils } from '../utils/dateUtils';
import { ChoicesUI } from '../ui/choicesUI';

export namespace CreateRoutineUI {
  export interface Data extends SubUI.Data {
    /** 常用分类列表（3 个） */
    commonCategories: CategoryItem[];
    /** 更多分类数量（用于"还有 X 个"） */
    moreCategoryCount: number;

    /** 当前选中分类 ID */
    selectedCategoryId: number;
    /** 当前选中分类的展示信息 */
    selectedCategoryName: string;
    selectedCategoryIcon: string;
    selectedCategoryColor: string;

    /** 任务内容 */
    contentText: string;
    contentMaxLength: number;
    contentCharCount: number;

    /** 示例提示词（数据驱动，可能为空） */
    exampleChips: ExampleChipItem[];

    /** 计划时长选项 */
    durationOptions: DurationItem[];

    /** 计划时间选项 */
    timeOptions: TimeItem[];

    /** 是否可以提交 */
    submittable: boolean;
  }

  export interface CategoryItem extends Entity.Image {
    icon: string;
    color: string;
    categoryId: number;
  }

  export interface ExampleChipItem extends Entity.Label {}

  export interface DurationItem extends Entity.Label {
    desc?: string;
    minutes: number;
  }

  export interface TimeItem extends Entity.Label {
    timeValue: string;
  }
}

export class CreateRoutineUI extends SubUI<CreateRoutineUI.Data> {
  private adapter = new CreateRoutineAdapter();
  private choicesUI?: ChoicesUI;

  public static readonly sContentMaxLength = 50;

  constructor(component: any, choicesUI?: ChoicesUI) {
    super(component);
    this.choicesUI = choicesUI;

    this.bindEvent('onCategoryTap', this.onCategoryTap);
    this.bindEvent('onMoreToggle', this.onMoreToggle);
    this.bindEvent('onContentInput', this.onContentInput);
    this.bindEvent('onExampleChipTap', this.onExampleChipTap);
    this.bindEvent('onDurationTap', this.onDurationTap);
    this.bindEvent('onTimeTap', this.onTimeTap);
    this.bindEvent('onTimeCustomTap', this.onTimeCustomTap);
    this.bindEvent('onSubmitTap', this.onSubmitTap);
  }

  public static getDefaultData(): CreateRoutineUI.Data {
    return {
      loaded: false,
      abortMessage: '',
      commonCategories: [],
      moreCategoryCount: 0,
      selectedCategoryId: 0,
      selectedCategoryName: '',
      selectedCategoryIcon: '',
      selectedCategoryColor: '',
      contentText: '',
      contentMaxLength: CreateRoutineUI.sContentMaxLength,
      contentCharCount: 0,
      exampleChips: [],
      durationOptions: [],
      timeOptions: [],
      submittable: false,
    };
  }

  /** 初始化页面数据（同步，无需网络请求） */
  public loadData(): number {
    const commonCategories = this.adapter.adaptCommonCategories();
    const moreCount = this.adapter.getMoreCategoryCount();
    const durationOptions = this.adapter.adaptDurations();
    const timeOptions = this.adapter.adaptTimes();

    this.setData({
      commonCategories,
      moreCategoryCount: moreCount,
      durationOptions,
      timeOptions,
      loaded: true,
    });

    return Err.Code.OK;
  }

  // ---- 事件处理 ----

  /** 选择常用分类 */
  protected onCategoryTap(e: WechatMiniprogram.TouchEvent) {
    const { categoryId } = e.currentTarget.dataset;
    const id = Number(categoryId);
    if (!id) return;

    Logger.info('onCategoryTap', id);
    this.selectCategory(id);
  }

  /** 打开更多分类弹窗（委托 ChoicesUI） */
  protected onMoreToggle() {
    Logger.info('onMoreToggle');
    if (!this.choicesUI) return;

    const moreCategories = this.adapter.adaptMoreCategories();
    this.choicesUI.show(
      {
        id: 'more-category',
        title: '更多分类',
        items: moreCategories,
        limited: 1,
        grid: '3',
        tips: '选中后自动关闭弹窗',
      },
      {
        onChoicesDialogItemTap: (item) => {
          Logger.info('moreCategory selected', item.id);
          this.selectCategory((item as CreateRoutineUI.CategoryItem).categoryId);
        },
      },
    );
  }

  /** 任务内容输入 */
  protected onContentInput(e: WechatMiniprogram.InputEvent) {
    const text = (e.detail.value || '') as string;
    const count = text.length;

    this.setData({
      contentText: text,
      contentCharCount: count,
      _submittable: !!this.getData().selectedCategoryId && text.trim().length > 0,
    });
  }

  /** 点击示例提示词 chip，填充到输入框 */
  protected onExampleChipTap(e: WechatMiniprogram.TouchEvent) {
    const { name } = e.currentTarget.dataset;
    if (!name) return;

    Logger.info('onExampleChipTap', name);
    const count = (name as string).length;

    this.setData({
      contentText: name,
      contentCharCount: count,
      _submittable: !!this.getData().selectedCategoryId,
    });
  }

  /** 选择计划时长 */
  protected onDurationTap(e: WechatMiniprogram.TouchEvent) {
    const { minutes } = e.currentTarget.dataset;
    const mins = Number(minutes);
    if (!mins) return;

    Logger.info('onDurationTap', mins);
    const options = this.adapter.adaptDurations(mins);
    this.setData({ durationOptions: options });
  }

  /** 选择计划时间（整点快捷） */
  protected onTimeTap(e: WechatMiniprogram.TouchEvent) {
    const { timeValue } = e.currentTarget.dataset;
    if (!timeValue) return;

    Logger.info('onTimeTap', timeValue);
    const options = this.adapter.adaptTimes(timeValue as string);
    this.setData({ timeOptions: options });
  }

  /** 自定义时间 */
  protected onTimeCustomTap() {
    Logger.info('onTimeCustomTap');
    const options = this.adapter.adaptTimes('custom');
    this.setData({ timeOptions: options });
    this.showToast('自定义时间功能即将上线');
  }

  /** 提交创建任务 */
  protected async onSubmitTap() {
    const data = this.getData();
    if (!data.submittable) {
      this.showToast('请选择分类并填写任务内容');
      return;
    }

    Logger.info('onSubmitTap', {
      category: data.selectedCategoryId,
      content: data.contentText,
    });

    this.showLoading();

    const duration =
      data.durationOptions.find((d) => d.selected)?.minutes || 30;

    const timeItem = data.timeOptions.find((t) => t.selected);
    let planTime = Date.now();
    if (timeItem && timeItem.timeValue !== 'now' && timeItem.timeValue !== 'custom') {
      const today = new Date();
      const [h, m] = timeItem.timeValue.split(':').map(Number);
      today.setHours(h, m, 0, 0);
      planTime = today.getTime();
    }

    const now = Date.now();
    const info: Partial<Routine.Info> = {
      name: data.contentText.trim(),
      detail: this.buildDetail(duration),
      category: data.selectedCategoryId,
      status: Routine.Status.Working,
      duration,
      planTime,
      date: DateUtils.getStartMillisOfDay(now),
      userId: '',
      transaction: Routine.newTransaction(),
      createTime: now,
    };

    const result = await Routine.create(info);
    this.hideLoading();

    if (typeof result === 'number') {
      this.showErrToast(result);
      return;
    }

    this.showToast('创建成功');
    this.postEvent('routineChanged', { action: 'created', id: result.id });

    setTimeout(() => {
      wx.navigateBack();
    }, 800);
  }

  // ---- 私有方法 ----

  /** 选择分类：更新选中态 + 刷新示例提示词 */
  private selectCategory(categoryId: number) {
    const info = this.adapter.getCategoryInfo(categoryId);
    const commonCategories = this.markSelected(
      this.getData().commonCategories,
      categoryId,
    );
    const examples = this.adapter.adaptExamples(categoryId);

    this.setData({
      selectedCategoryId: categoryId,
      selectedCategoryName: info.name,
      selectedCategoryIcon: info.icon,
      selectedCategoryColor: info.color,
      commonCategories,
      exampleChips: examples,
      _submittable: this.getData().contentText.trim().length > 0,
    });
  }

  private buildDetail(minutes: number): string {
    if (minutes >= 60) {
      const hours = minutes / 60;
      return `约${hours}小时`;
    }
    return `约${minutes}分钟`;
  }

  private markSelected<T extends Entity.Label>(
    items: T[],
    selectedId: number,
  ): T[] {
    return items.map((item) => ({
      ...item,
      selected: Number(item.id?.replace('cat_', '')) === selectedId,
      style: Number(item.id?.replace('cat_', '')) === selectedId ? 'selected' : '',
    }));
  }
}

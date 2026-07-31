import { SubUI } from '../core/subUI';
import { Err } from '../constant/error';
import { Entity } from '../model/entity';
import { Routine } from '../server/routine';
import { CreateRoutineAdapter } from './createRoutineAdapter';
import { Logger } from '../utils/logger';
import { DateUtils } from '../utils/dateUtils';
import { ChoicesUI } from '../ui/choicesUI';
import { InteractUI } from '../core/interactUI';

export namespace CreateRoutineUI {
  export interface Data extends SubUI.Data {
    choices: ChoicesUI.Data;
    /** 当前选中分类 ID */
    selectedCategoryId: number;
    /** 常用分类列表（3 个） */
    categories: Category[];

    /** 更多分类数量（用于"还有 X 个"） */
    moreCategoryCount: number;

    /** 当前选中分类是否来自「更多分类」 */
    selectedCategoryIsMore: boolean;
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
    /** 自定义时长输入是否可见 */
    durationCustomVisible: boolean;
    /** 自定义时长输入文本 */
    durationCustomText: string;
    /** 当前选中的时长分钟数（含自定义） */
    durationSelectedMinutes: number;

    /** 计划时间选项 */
    timeOptions: TimeItem[];
    /** 自定义时间值（picker 回填） */
    timeCustomValue: string;
    /** 当前选中的时间值 */
    timeSelectedValue: string;

    /** 是否可以提交 */
    submittable: boolean;
  }

  export interface Category extends Entity.Image {
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

export class CreateRoutineUI extends InteractUI<CreateRoutineUI.Data> {
  private adapter = new CreateRoutineAdapter();

  public static readonly sContentMaxLength = 50;

  public constructor(component: any) {
    super(component);

    this.bindEvent('onCategoryTap', this.onCategoryTap);
    this.bindEvent('onMoreToggle', this.onMoreToggle);
    this.bindEvent('onContentInput', this.onContentInput);
    this.bindEvent('onExampleChipTap', this.onExampleChipTap);
    this.bindEvent('onDurationTap', this.onDurationTap);
    this.bindEvent('onDurationCustomTap', this.onDurationCustomTap);
    this.bindEvent('onDurationCustomInput', this.onDurationCustomInput);
    this.bindEvent('onDurationCustomConfirm', this.onDurationCustomConfirm);
    this.bindEvent('onTimeTap', this.onTimeTap);
    this.bindEvent('onTimePicked', this.onTimePicked);
    this.bindEvent('onSubmitTap', this.onSubmitTap);
  }

  public static defaultData(): CreateRoutineUI.Data {
    return {
      loaded: false,
      abortMessage: '',
      choices: ChoicesUI.defaultData(),
      categories: [],
      moreCategoryCount: 0,
      selectedCategoryId: 0,
      selectedCategoryIsMore: false,
      selectedCategoryName: '',
      selectedCategoryIcon: '',
      selectedCategoryColor: '',
      contentText: '',
      contentMaxLength: CreateRoutineUI.sContentMaxLength,
      contentCharCount: 0,
      exampleChips: [],
      durationOptions: [],
      durationCustomVisible: false,
      durationCustomText: '',
      durationSelectedMinutes: 30,
      timeOptions: [],
      timeCustomValue: '',
      timeSelectedValue: 'now',
      submittable: false,
    };
  }

  /** 初始化页面数据（同步，无需网络请求） */
  public loadData(): number {
    const now = new Date();
    const currentHour = now.getHours();
    const categories = this.adapter.adaptCategories();
    const moreCount = this.adapter.getMoreCategoryCount();
    const durationOptions = this.adapter.adaptDurations(30);
    const timeOptions = this.adapter.adaptTimes(currentHour, 'now');

    this.setData({
      categories: categories,
      moreCategoryCount: moreCount,
      durationOptions,
      durationSelectedMinutes: 30,
      timeOptions,
      timeSelectedValue: 'now',
      loaded: true,
    });

    return Err.Code.OK;
  }

  // ---- 事件处理 ----

  /** 选择常用分类 */
  protected onCategoryTap(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset;
    Logger.info('onCategoryTap', id);
    this.selectCategory(Number(id));
  }

  /** 打开更多分类弹窗（委托 ChoicesUI） */
  protected onMoreToggle() {
    Logger.info('onMoreToggle');
    const moreCategories = this.adapter.adaptMoreCategories(
      this.getData().selectedCategoryIsMore ? this.getData().selectedCategoryId : undefined
    );
    this.getChoices().show(
      {
        id: 'more-category',
        title: '更多分类',
        items: moreCategories,
        limited: 1,
        grid: 3,
      },
      {
        onChoicesDialogItemTap: (item) => {
          this.selectCategory(Number(item.id));
        },
      }
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
    this.setData({
      durationOptions: options,
      durationSelectedMinutes: mins,
      durationCustomVisible: false,
      durationCustomText: '',
    });
  }

  /** 自定义时长入口（点击"其他"）→ 原地切换为输入框 */
  protected onDurationCustomTap() {
    if (this.getData().durationCustomVisible) return;
    Logger.info('onDurationCustomTap');
    const options = this.adapter.adaptDurations(CreateRoutineAdapter.kCustomDurationMinutes);
    this.setData({
      durationOptions: options,
      durationCustomVisible: true,
      durationCustomText: '',
      durationSelectedMinutes: 0,
    });
  }

  /** 自定义时长输入 */
  protected onDurationCustomInput(e: WechatMiniprogram.InputEvent) {
    const text = (e.detail.value || '') as string;
    this.setData({ durationCustomText: text });
  }

  /** 自定义时长确认（失焦后生效） */
  protected onDurationCustomConfirm() {
    const text = this.getData().durationCustomText.trim();
    if (!text) return;
    const mins = parseInt(text, 10);
    if (isNaN(mins) || mins <= 0 || mins > 480) {
      this.showToast('请输入 1-480 之间的分钟数');
      this.setData({ durationCustomText: '' });
      return;
    }
    Logger.info('durationCustom confirm', mins);
    const options = this.adapter.adaptDurations(CreateRoutineAdapter.kCustomDurationMinutes);
    this.setData({
      durationOptions: options,
      durationSelectedMinutes: mins,
    });
  }

  /** 选择计划时间（整点快捷） */
  protected onTimeTap(e: WechatMiniprogram.TouchEvent) {
    const { timeValue } = e.currentTarget.dataset;
    if (!timeValue) return;

    Logger.info('onTimeTap', timeValue);
    const currentHour = new Date().getHours();
    const options = this.adapter.adaptTimes(currentHour, timeValue as string);
    this.setData({
      timeOptions: options,
      timeSelectedValue: timeValue as string,
      timeCustomValue: '',
    });
  }

  /** 原生 picker 选择回调 */
  protected onTimePicked(e: WechatMiniprogram.PickerChangeEvent) {
    const timeValue = e.detail.value as string;
    Logger.info('onTimePicked', timeValue);
    if (!timeValue) return;
    const currentHour = new Date().getHours();
    const options = this.adapter.adaptTimes(currentHour, timeValue);
    this.setData({
      timeOptions: options,
      timeSelectedValue: timeValue,
      timeCustomValue: timeValue,
    });
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

    const duration = data.durationSelectedMinutes || 30;

    const timeValue = data.timeSelectedValue || 'now';
    let planTime = Date.now();
    if (timeValue !== 'now') {
      const today = new Date();
      const [h, m] = timeValue.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        today.setHours(h, m, 0, 0);
        planTime = today.getTime();
      }
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
  private selectCategory(category: number) {
    const info = this.adapter.getCategoryInfo(category);
    const isMore = this.adapter.isMoreCategory(category);
    const categories = this.markSelected(
      this.getData().categories,
      isMore ? 0 : category // 更多分类时清空常用分类选中
    );
    const examples = this.adapter.adaptExamples(category);

    this.setData({
      selectedCategoryId: category,
      selectedCategoryIsMore: isMore,
      selectedCategoryName: info.name,
      selectedCategoryIcon: info.icon,
      selectedCategoryColor: info.color,
      categories: categories,
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

  private markSelected<T extends Entity.Label>(items: T[], selectedId: number): T[] {
    return items.map((item) => ({
      ...item,
      selected: Number(item.id?.replace('cat_', '')) === selectedId,
      style: Number(item.id?.replace('cat_', '')) === selectedId ? 'selected' : '',
    }));
  }
}

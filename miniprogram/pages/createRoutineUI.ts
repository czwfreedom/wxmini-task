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
    /** 当前选中分类的展示信息，如果ID为空表示没有 */
    moreCategory?: Category;

    /** 任务内容 */
    contentText: string;
    contentMaxLength: number;
    contentCharCount: number;
    /** 示例提示词（数据驱动，可能为空） */
    contentExamples: Example[];

    /** 计划时长选项 */
    durations: Duration[];
    /** 自定义时长输入文本 */
    durationCustomText: string;

    /** 计划时间选项 */
    times: Time[];
    /** 自定义时间值（picker 回填） */
    timeCustomValue: string;

    /** 是否可以提交 */
    submittable: boolean;
  }

  export interface Category extends Entity.Image {
    color: string;
  }

  export interface Example extends Entity.Label {}

  export interface Duration extends Entity.Label {}

  export interface Time extends Entity.Label {}
}

export class CreateRoutineUI extends InteractUI<CreateRoutineUI.Data> {
  private adapter = new CreateRoutineAdapter();

  public static readonly sContentMaxLength = 50;

  public constructor(component: any) {
    super(component);

    this.bindEvent('onCategoryTap', this.onCategoryTap);
    this.bindEvent('onMoreToggle', this.onMoreToggle);
    this.bindEvent('onContentInput', this.onContentInput);
    this.bindEvent('onContentExampleTap', this.onContentExampleTap);
    this.bindEvent('onDurationTap', this.onDurationTap);
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
      selectedCategoryId: 0,
      contentText: '',
      contentMaxLength: CreateRoutineUI.sContentMaxLength,
      contentCharCount: 0,
      contentExamples: [],

      durations: [],
      durationCustomText: '',

      times: [],
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
    const durations = this.adapter.adaptDurations();
    const times = this.adapter.adaptTimes(currentHour);

    this.setData({
      categories: categories,
      durations,
      times,
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
    const categories = this.adapter.adaptMoreCategories(this.getData().selectedCategoryId);
    this.getChoices().show(
      {
        id: 'more-category',
        title: '更多分类',
        items: categories,
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
  protected onContentExampleTap(e: WechatMiniprogram.TouchEvent) {
    const { name } = e.currentTarget.dataset;
    if (!name) return;

    Logger.info('onContentExampleTap', name);
    const count = (name as string).length;

    this.setData({
      contentText: name,
      contentCharCount: count,
      _submittable: !!this.getData().selectedCategoryId,
    });
  }

  /** 选择计划时长 */
  protected onDurationTap(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset;
    Logger.info('onDurationTap', id);
    const options = this.getData().durations;
    this.markSelected(options, id);
    this.setData({ durations: options });
  }

  /** 自定义时长输入 */
  protected onDurationCustomInput(e: WechatMiniprogram.TouchEvent) {
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
  }

  /** 选择计划时间（整点快捷） */
  protected onTimeTap(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset;

    Logger.info('onTimeTap', id);
    const options = this.getData().times;
    this.markSelected(options, id);
    this.setData({ times: options });
  }

  /** 原生 picker 选择回调 */
  protected onTimePicked(e: WechatMiniprogram.TouchEvent) {
    const timeValue = e.detail.value as string;
    Logger.info('onTimePicked', timeValue);
    if (!timeValue) return;

    const options = this.getData().times;
    this.markSelected(options, 'custom');
    this.setData({ times: options, timeCustomValue: timeValue });
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

    // const duration = data.durationSelectedMinutes || 30;
    const duration = 30;

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
    const isMore = this.adapter.isMoreCategory(category);
    const more = isMore
      ? this.adapter.buildCategoryVM(category)
      : ({ id: '' } as CreateRoutineUI.Category);
    const categories = this.markSelected(this.getData().categories, category);
    const examples = this.adapter.adaptExamples(category);

    this.setData({
      selectedCategoryId: category,
      categories: categories,
      moreCategory: more,
      contentExamples: examples,
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

  private markSelected<T extends Entity.Label>(items: T[], selectedId: number | string): T[] {
    const id = '' + selectedId;
    for (const item of items) {
      if (item.id === id) {
        item.selected = true;
      } else if (item.selected) item.selected = false;
    }
    return items;
  }
}

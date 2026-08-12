import { SubUI } from '../core/subUI';
import { Err } from '../constant/error';
import { Entity } from '../model/entity';
import { Routine } from '../server/routine';
import { RoutineEditorAdapter } from './routineEditorAdapter';
import { Logger } from '../utils/logger';
import { ChoicesUI } from '../ui/choicesUI';
import { InteractUI } from '../core/interactUI';
import { Utils } from '../utils/utils';
import { DateUtils } from '../utils/dateUtils';
import { Event } from '../core/event';
import { Intent } from '../core/intent';
import { MenuUI } from '../ui/menuUI';
import { RoutineAdapter } from './routineAdapter';
import { ObjectUtils } from '../utils/objectUtils';

export namespace RoutineEditorUI {
  export interface Data extends SubUI.Data {
    finishing?: boolean;

    choices: ChoicesUI.Data;
    /** 当前选中分类 ID */
    selectedCategoryId: number;
    /** 常用分类列表，最后一个是“更多”选项 */
    categories: Category[];

    /** 任务内容 */
    contentHint?: string;
    contentHolder?: string;

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

    /** 键盘弹起高度（px），用于 CTA 按钮跟随上移 */
    keyboardHeight: number;
    menus?: MenuUI.Menus;
  }

  export interface Category extends Entity.Image {
    color: string;
    other?: boolean;
  }

  export interface Example extends Entity.Label {}

  export interface Duration extends Entity.Label {}

  export interface Time extends Entity.Label {}
}

export class RoutineEditorUI extends InteractUI<RoutineEditorUI.Data> {
  private adapter = new RoutineEditorAdapter();
  protected entry?: Partial<Routine.Info>;

  public static readonly sContentMaxLength = 128;

  public constructor(component: any, intent?: Partial<Routine.Info>) {
    super(component);

    this.entry = intent;

    this.bindEvent('onCategoryTap', this.onCategoryTap);
    this.bindEvent('onContentInput', this.onContentInput);
    this.bindEvent('onContentExampleTap', this.onContentExampleTap);
    this.bindEvent('onDurationTap', this.onDurationTap);
    this.bindEvent('onDurationCustomInput', this.onDurationCustomInput);
    this.bindEvent('onDurationCustomConfirm', this.onDurationCustomConfirm);
    this.bindEvent('onTimeTap', this.onTimeTap);
    this.bindEvent('onTimePicked', this.onTimePicked);
    this.bindEvent('onBottomBarTap', this.onBottomBarTap);
  }

  public static defaultData(): RoutineEditorUI.Data {
    return {
      loaded: false,
      abortMessage: '',
      choices: ChoicesUI.defaultData(),
      categories: [],
      selectedCategoryId: 0,
      contentText: '',
      contentMaxLength: RoutineEditorUI.sContentMaxLength,
      contentCharCount: 0,
      contentExamples: [],

      durations: [],
      durationCustomText: '',

      times: [],
      timeCustomValue: '',
      submittable: false,
      keyboardHeight: 0,
    };
  }

  protected watchKeyboard() {
    wx.onKeyboardHeightChange((res) => {
      this.setData({ keyboardHeight: res.height });
    });
  }

  /** 初始化页面数据（同步，无需网络请求） */
  public loadData(): number {
    const entry = this.entry;
    const categories = this.adapter.adaptCategories();
    const durations = this.adapter.adaptDurations((entry?.duration || 0) / 60000 || 30);
    const times = this.adapter.adaptTimes(entry?.planTime);

    const detail = entry?.detail || '';
    this.setData(
      {
        loaded: true,
        categories: categories,
        ...durations,
        ...times,
        contentText: detail,
        contentCharCount: detail.length,
      },
      () => {
        if (entry?.category) {
          this.selectCategory(entry.category, this.adapter.isMoreCategory(entry.category));
        } else {
          this.setData({ menus: this.getMenus() });
        }
      }
    );

    return Err.Code.OK;
  }

  // ---- 事件处理 ----

  /** 选择常用分类 */
  protected onCategoryTap(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset;
    Logger.info('onCategoryTap', id);
    const vm = Entity.find(this.getData().categories, id);
    if (!vm.item) return;
    if (vm.item.other) {
      this.showMoreCategories();
    } else {
      this.selectCategory(Number(id), false);
    }
  }

  /** 打开更多分类弹窗（委托 ChoicesUI） */
  protected showMoreCategories() {
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
          this.selectCategory(Number(item.id), true);
        },
      }
    );
  }

  /** 任务内容输入 */
  protected onContentInput(e: WechatMiniprogram.TouchEvent) {
    const text = (e.detail.value || '') as string;
    const count = text.length;

    this.updateData({ contentText: text, contentCharCount: count });
  }

  /** 点击示例提示词 chip，填充到输入框 */
  protected onContentExampleTap(e: WechatMiniprogram.TouchEvent) {
    const { name } = e.currentTarget.dataset;
    if (!name) return;

    Logger.info('onContentExampleTap', name);
    const count = (name as string).length;

    this.updateData({
      contentText: name,
      contentCharCount: count,
    });
  }

  /** 选择计划时长 */
  protected onDurationTap(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset;
    Logger.info('onDurationTap', id);
    const options = this.getData().durations;
    this.markSelected(options, id);
    this.updateData({ durations: options });
  }

  /** 自定义时长输入 */
  protected onDurationCustomInput(e: WechatMiniprogram.TouchEvent) {
    const text = (e.detail.value || '') as string;
    this.updateData({ durationCustomText: text });
  }

  /** 自定义时长确认（失焦后生效） */
  protected onDurationCustomConfirm() {
    const text = this.getData().durationCustomText.trim();
    if (!text) return;
    const mins = parseInt(text, 10);
    if (isNaN(mins) || mins <= 0 || mins > 480) {
      this.showToast('请输入 1-480 之间的分钟数');
      this.updateData({ durationCustomText: '' });
      return;
    }
  }

  /** 选择计划时间（整点快捷） */
  protected onTimeTap(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset;

    Logger.info('onTimeTap', id);
    const options = this.getData().times;
    this.markSelected(options, id);
    this.updateData({ times: options });
  }

  /** 原生 picker 选择回调 */
  protected onTimePicked(e: WechatMiniprogram.TouchEvent) {
    const timeValue = e.detail.value as string;
    Logger.info('onTimePicked', timeValue);
    if (!timeValue) return;

    const options = this.getData().times;
    this.markSelected(options, 'custom');
    this.updateData({ times: options, timeCustomValue: timeValue });
  }

  /** 提交创建任务 */
  protected onBottomBarTap(e: WechatMiniprogram.TouchEvent) {
    this.commit();
  }

  protected updating() {
    return !!this.entry?.id && DateUtils.getStartMillisOfDay(Date.now()) === this.entry.date;
  }

  protected async commit() {
    const data = this.getCommitData(true);
    if (!data) return;

    const updating = this.updating();
    if (this.entry?.id && !updating) {
      this.showToast('只能修改当天的任务');
      // 隔天的处理。
      this.setData({ menus: this.getMenus() });
      return;
    }

    Logger.info('Commiting', data);

    let res: number | Routine.Info | undefined = undefined;
    this.showLoading();
    if (updating) {
      res = await Routine.update(data);
    } else {
      data.status = Routine.Status.Working;
      data.date = DateUtils.getStartMillisOfDay(data.planTime!);
      data.transaction = Routine.newTransaction();
      res = await Routine.create(data);
    }
    this.hideLoading();

    if ('number' === typeof res) {
      this.showErrToast(res);
      return;
    }

    this.showToast(updating ? '修改成功' : '创建成功');
    this.postEvent(Event.Name.RoutineUpdated, res);
    Intent.delayBack();
  }

  protected getMenus(): MenuUI.Menus {
    const commitData = this.getCommitData();
    const updating = this.updating();
    if (this.entry?.id && (!updating || !commitData)) return { id: '', items: [] };
    return {
      id: 'm',
      items: [{ id: 'create', name: updating ? '修改任务' : '创建任务', enabled: !!commitData }],
    };
  }

  protected updateData(data: Partial<RoutineEditorUI.Data>) {
    this.setData(data, () => {
      this.setData({ menus: this.getMenus() });
    });
  }

  protected getCommitData(showToast = false): Partial<Routine.Info> | undefined {
    const data = this.getData();
    if (!data.selectedCategoryId) {
      if (showToast) this.showToast('请选择任务分类');
      return undefined;
    }

    const content = data.contentText.trim();
    if (!content) {
      if (showToast) this.showToast('请填写任务内容');
      return undefined;
    }

    const duration = data.durations.find((o) => o.selected);
    if (!duration || (duration.id === 'custom' && !data.durationCustomText.trim())) {
      if (showToast) this.showToast('请选择计划时长');
      return undefined;
    }

    const mins = Utils.ZNumber(
      duration.id === 'custom' ? data.durationCustomText.trim() : duration.id
    );

    const time = data.times.find((o) => o.selected);
    if (!time || (time.id === 'custom' && !data.timeCustomValue.trim())) {
      if (showToast) this.showToast('请选择计划时间');
      return undefined;
    }

    const newInfo: Partial<Routine.Info> = {
      category: data.selectedCategoryId,
      detail: content,
      duration: mins * 60000,
      planTime: this.formatPlanTime(time.id === 'custom' ? data.timeCustomValue.trim() : time.id),
    };
    const entry = this.entry;
    if (!entry?.id) return newInfo;
    // 也支持修改。
    ObjectUtils.deleteSame(newInfo, entry);
    if (Object.keys(newInfo).length) {
      newInfo.id = entry?.id;
      return newInfo;
    }
    return undefined;
  }

  private formatPlanTime(v: string): number {
    const date = new Date(Date.now());
    if (v === 'now') {
      date.setSeconds(0, 0);
    } else {
      const arr = v.split(':');
      const h = arr.length === 2 ? Utils.ZNumber(arr[0], 9) : 9;
      const m = arr.length === 2 ? Utils.ZNumber(arr[1], 0) : 0;
      date.setHours(h, m, 0, 0);
    }
    return date.getTime();
  }

  /** 选择分类：更新选中态 + 刷新示例提示词 */
  private selectCategory(category: number, isMore = false) {
    const categories = this.getData().categories;
    if (isMore) {
      const more = this.adapter.buildCategoryVM(category);
      more.other = true;
      categories.splice(categories.length - 1, 1, more);
    }
    this.markSelected(categories, category);
    const examples = this.adapter.adaptExamples(category);
    const config = RoutineAdapter.findConfig(category);

    this.updateData({
      selectedCategoryId: category,
      categories: categories,
      contentExamples: examples,
      contentHolder: config?.hint || '',
    });
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

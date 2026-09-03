import { SubUI } from '../core/subUI';
import { Err } from '../constant/error';
import { Entity } from '../model/entity';
import { Routine } from '../server/routine';
import { RoutineEditorAdapter } from './routineEditorAdapter';
import { Logger } from '../utils/logger';
import { ChoicesUI } from '../ui/base/choicesUI';
import { InteractUI } from '../core/interactUI';
import { Utils } from '../utils/utils';
import { DateUtils } from '../utils/dateUtils';
import { Event } from '../core/event';
import { Intent } from '../core/intent';
import { MenuUI } from '../ui/base/menuUI';
import { RoutineAdapter } from './routineAdapter';
import { ObjectUtils } from '../utils/objectUtils';
import { RoutineCache } from '../storage/routineCache';
import { InputUI } from '../ui/base/inputUI';

export namespace RoutineEditorUI {
  export interface Data extends SubUI.Data {
    finishing?: boolean;

    choices: ChoicesUI.Data;

    category: InputUI.VM;

    // 很想把这个统统放到一个结构里。
    /** 任务内容 */
    contentTitle?: string;
    contentHint?: string;
    contentHolder?: string;
    contentText: string;
    contentMaxLength: number;
    contentStyle?: string;

    contentCharCount: number;
    /** 示例提示词（数据驱动，可能为空） */
    contentExamples: Example[];

    duration: InputUI.VM;
    time: InputUI.VM;

    /** 是否可以提交 */
    submittable: boolean;

    /** 键盘弹起高度（px），用于 CTA 按钮跟随上移 */
    keyboardHeight: number;
    menus?: MenuUI.Menus;
  }

  export interface Example extends Entity.Label {}

  export interface Duration extends Entity.Label {}

  export interface Time extends Entity.Label {}
}

export class RoutineEditorUI extends InteractUI<RoutineEditorUI.Data> {
  private adapter = new RoutineEditorAdapter();
  protected entry?: Partial<Routine.Info>;
  protected isFuture: boolean;

  public static readonly sContentMaxLength = 128;

  public constructor(component: any, intent?: Partial<Routine.Info>) {
    super(component);

    this.entry = intent;
    this.isFuture = (intent?.date || 0) > Date.now();

    this.bindEvent('onInputRadioTap', this.onInputRadioTap);
    this.bindEvent('onContentInput', this.onContentInput);
    this.bindEvent('onContentExampleTap', this.onContentExampleTap);
    this.bindEvent('onInputChanged', this.onInputChanged);
    this.bindEvent('onInputBlur', this.onInputBlur);
    this.bindEvent('onInputTimePicked', this.onInputTimePicked);
    this.bindEvent('onBottomBarTap', this.onBottomBarTap);
  }

  public static defaultData(): RoutineEditorUI.Data {
    return {
      loaded: false,
      abortMessage: '',
      choices: ChoicesUI.defaultData(),
      category: { id: 'category', name: '想做什么呢？', type: InputUI.Type.GridRadio },
      contentText: '',
      contentMaxLength: RoutineEditorUI.sContentMaxLength,
      contentCharCount: 0,
      contentExamples: [],
      duration: {
        id: 'duration',
        name: '计划时长',
        type: InputUI.Type.OptionInput,
        subType: 'number',
        hint: '输入',
        maxLength: 3,
      },
      time: {
        id: 'time',
        name: '几点开始？⏰',
        type: InputUI.Type.OptionTime,
        hint: '可选，默认现在',
      },
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
    const oldData = this.getData();
    const category = oldData.category;
    const duration = oldData.duration;
    const time = oldData.time;
    category.items = this.adapter.adaptCategories();
    Object.assign(duration, this.adapter.adaptDurations((entry?.duration || 0) / 60000 || 30));
    Object.assign(time, this.adapter.adaptTimes(entry?.planTime, this.isFuture));

    const detail = entry?.detail || '';
    this.setData(
      {
        loaded: true,
        category,
        duration,
        time,
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
  protected onInputRadioTap(e: WechatMiniprogram.TouchEvent) {
    const { id, subid } = e.currentTarget.dataset;
    Logger.info('onInputTap', id, subid);

    if (id === 'category') {
      const vm = Entity.find(this.getData().category.items, subid);
      if (!vm.item) return;
      if (vm.item.other) {
        this.showMoreCategories();
      } else {
        this.selectCategory(Number(subid), false);
      }
    } else if (id === 'duration') {
      const options = this.getData().duration.items!;
      Entity.markSelected(options, subid);
      this.updateData({ duration: this.getData().duration });
    } else if (id === 'time') {
      const options = this.getData().time.items!;
      Entity.markSelected(options, subid);
      this.updateData({ time: this.getData().time });
    }
  }

  /** 打开更多分类弹窗（委托 ChoicesUI） */
  protected showMoreCategories() {
    const categories = this.adapter.adaptMoreCategories(this.getSelectedCategory());
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

  /** 自定义时长输入 */
  protected onInputChanged(e: WechatMiniprogram.TouchEvent) {
    const text = (e.detail.value || '') as string;
    this.updateData(this.buildNewData('duration.value', text));
  }

  /** 自定义时长确认（失焦后生效） */
  protected onInputBlur() {
    const text = this.getData().duration.value?.trim();
    if (!text) return;
    const mins = parseInt(text, 10);
    if (isNaN(mins) || mins <= 0 || mins > 480) {
      this.showToast('请输入 1-480 之间的分钟数');
      this.updateData(this.buildNewData('duration.value', ''));
      return;
    }
  }

  /** 原生 picker 选择回调 */
  protected onInputTimePicked(e: WechatMiniprogram.TouchEvent) {
    const timeValue = e.detail.value as string;
    Logger.info('onTimePicked', timeValue);
    if (!timeValue) return;

    const time = this.getData().time;
    Entity.markSelected(time.items!, 'custom');
    time.value = timeValue;
    this.updateData({ time });
  }

  /** 提交创建任务 */
  protected onBottomBarTap(e: WechatMiniprogram.TouchEvent) {
    this.commit();
  }

  protected getSelectedCategory(): number {
    return Utils.ZNumber(this.getData().category.selectedId);
  }

  protected updating() {
    return !!this.entry?.id && (this.isFuture || DateUtils.getToday() === this.entry.date);
  }

  protected async commit() {
    const data = this.getCommitData(true);
    if (!data) return;

    const updating = this.updating();
    if (this.entry?.id && !updating) {
      this.showToast('过去的任务不能修改');
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
      data.date = DateUtils.getDay(data.planTime!);
      data.transaction = Routine.newTransaction();
      res = await Routine.create(data);
    }
    this.hideLoading();

    if ('number' === typeof res) {
      this.showErrToast(res === Err.Code.OverLimited ? Err.Code.RoutineOverLimited : res);
      return;
    }

    const category = data.category || this.entry?.category;
    const detail = data.detail || this.entry?.detail;
    if (category && detail) RoutineCache.save(category, detail);

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

  protected updateData(data: Partial<RoutineEditorUI.Data> | any) {
    this.setData(data, () => {
      this.setData({ menus: this.getMenus() });
    });
  }

  protected getCommitData(showToast = false): Partial<Routine.Info> | undefined {
    const data = this.getData();
    const selectedCategory = this.getSelectedCategory();
    if (!selectedCategory) {
      if (showToast) this.showToast('请选择任务分类');
      return undefined;
    }

    const content = data.contentText.trim();
    if (!content) {
      if (showToast) this.showToast('请填写任务内容');
      return undefined;
    }

    const duration = data.duration.items?.find((o) => o.selected);
    if (!duration || (duration.id === 'custom' && !data.duration.value?.trim())) {
      if (showToast) this.showToast('请选择计划时长');
      return undefined;
    }

    const mins = Utils.ZNumber(
      duration.id === 'custom' ? data.duration.value?.trim() : duration.id
    );

    const time = data.time.items?.find((o) => o.selected);
    if (!time || (time.id === 'custom' && !data.time?.value?.trim())) {
      if (showToast) this.showToast('请选择计划时间');
      return undefined;
    }

    const newInfo: Partial<Routine.Info> = {
      category: selectedCategory,
      detail: content,
      duration: mins * 60000,
      planTime: this.formatPlanTime(time.id === 'custom' ? data.time.value!.trim() : time.id),
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
    const date = new Date(this.entry?.date || Date.now());
    if (v === 'now') {
      const now = new Date();
      date.setHours(now.getHours(), now.getMinutes(), 0, 0);
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
    const input = this.getData().category;
    const categories = input.items!;
    input.selectedId = '' + category;
    if (isMore) {
      const more = this.adapter.buildCategoryVM(category);
      more.other = true;
      categories.splice(categories.length - 1, 1, more);
    }
    Entity.markSelected(categories, category);

    const examples = this.adapter.adaptExamples(category, this.updating());
    const config = RoutineAdapter.findConfig(category);

    this.updateData({
      category: input,
      contentExamples: examples,
      contentHolder: config?.hint || '',
    });
  }
}

import { SubUI } from '../core/subUI';
import { Err } from '../constant/error';
import { Entity } from '../model/entity';
import { Routine } from '../server/routine';
import { RoutineEditorAdapter } from './routineEditorAdapter';
import { Logger } from '../utils/logger';
import { ChoicesUI } from '../ui/base/choicesUI';
import { Utils } from '../utils/utils';
import { DateUtils } from '../utils/dateUtils';
import { Event } from '../core/event';
import { Intent } from '../core/intent';
import { MenuUI } from '../ui/base/menuUI';
import { RoutineAdapter } from './routineAdapter';
import { ObjectUtils } from '../utils/objectUtils';
import { RoutineCache } from '../storage/routineCache';
import { InputUI } from '../ui/base/inputUI';
import { MediaInputUI } from '../ui/base/mediaInputUI';

export namespace RoutineEditorUI {
  export interface Data extends SubUI.Data {
    finishing?: boolean;

    /** 委托任务顶部的署名条（Intent 里带了 partner 才有）；普通任务为空 */
    partner?: Entity.Image;

    choices: ChoicesUI.Data;

    category: InputUI.VM;
    detail: InputUI.VM;
    detailImage?: InputUI.VM;
    detailAudio?: InputUI.VM;
    snapCanvas?: boolean;

    duration: InputUI.VM;
    time: InputUI.VM;

    /** 委托入口卡（叫上谁一起）。没有可选伙伴时为空，整块不渲染。 */
    together?: InputUI.VM;

    /** 是否可以提交 */
    submittable: boolean;

    /** 键盘弹起高度（px），用于 CTA 按钮跟随上移 */
    keyboardHeight: number;
    menus?: MenuUI.Menus;
  }
}

export class RoutineEditorUI extends MediaInputUI<RoutineEditorUI.Data> {
  private adapter = new RoutineEditorAdapter();
  protected entry?: Routine.Intent;
  protected isFuture: boolean;

  /** 可选伙伴（我星标 且 互相关注）。随 loadData 拉一次，选人时复用不重复请求。 */
  protected partners: Entity.Option[] = [];

  public static readonly sContentMaxLength = 128;

  public constructor(component: any, intent?: Routine.Intent) {
    super(component);

    this.entry = intent;
    this.isFuture = (intent?.date || 0) > Date.now();

    this.bindEvent('onInputRadioTap', this.onInputRadioTap);
    this.bindEvent('onInputChanged', this.onInputChanged);
    this.bindEvent('onInputBlur', this.onInputBlur);
    this.bindEvent('onInputTimePicked', this.onInputTimePicked);
    this.bindEvent('onBottomBarTap', this.onBottomBarTap);
    this.bindEvent('onInputMenuTap', this.onInputMenuTap);
  }

  public static defaultData(): RoutineEditorUI.Data {
    return {
      loaded: false,
      abortMessage: '',
      choices: ChoicesUI.defaultData(),
      category: { id: 'category', name: '想做什么呢？', type: InputUI.Type.GridRadio },
      detail: {
        id: 'detail',
        name: '具体做什么呢 ✍️',
        type: InputUI.Type.Textarea,
        hint: '请先选择任务类型',
        maxLength: RoutineEditorUI.sContentMaxLength,
        charCount: 0,
        disabled: true,
      },
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

  /**
   * @override
   */
  public release(): void {
    if (this.getData().snapCanvas) this.setData({ snapCanvas: false });
    super.release();
  }

  /** 初始化页面数据。除委托伙伴名单外均为本地装配。 */
  public async loadData(): Promise<number> {
    const entry = this.entry;
    const oldData = this.getData();
    const category = oldData.category;
    const duration = oldData.duration;
    const time = oldData.time;
    const detail = oldData.detail;

    category.items = this.adapter.adaptCategories();
    Object.assign(duration, this.adapter.adaptDurations((entry?.duration || 0) / 60000 || 30));
    Object.assign(time, this.adapter.adaptTimes(entry?.planTime, this.isFuture));

    detail.value = entry?.detail || '';
    detail.charCount = detail.value?.length || 0;

    this.setData(
      {
        loaded: true,
        category,
        duration,
        time,
        detail,
      },
      () => {
        if (entry?.category) {
          this.selectCategory(entry.category, this.adapter.isMoreCategory(entry.category));
        } else {
          this.setData({ menus: this.getMenus() });
        }
      }
    );

    // 委托入口单独补上：它是可选项，不该为了它拖慢首屏。
    this.loadPartners();

    return Err.Code.OK;
  }

  /**
   * 拉取可选伙伴，并补上「叫上谁一起」的入口卡。
   *
   * 没有「我星标 且 互相关注」的伙伴时，buildTogetherVM 返回 undefined，
   * 整块不渲染（不留空态）；拉取失败也当作没有 —— 它不该挡住创建流程。
   */
  protected async loadPartners() {
    const partners = await this.adapter.loadPartners();
    this.partners = 'number' === typeof partners ? [] : partners;
    const together = this.adapter.buildTogetherVM(this.partners, this.entry?.delegated);
    if (together) this.setData({ together: together });
  }

  // ---- 事件处理 ----

  /** 选择常用分类 */
  protected onInputRadioTap(e: WechatMiniprogram.TouchEvent) {
    const { id, subid, name } = e.currentTarget.dataset;
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
      const duration = this.getData().duration;
      Entity.markSelected(duration.items!, subid);
      duration.focused = subid === 'custom';
      this.updateData({ duration });
    } else if (id === 'time') {
      const options = this.getData().time.items!;
      Entity.markSelected(options, subid);
      this.updateData({ time: this.getData().time });
    } else if (id === 'detail') {
      if (name) this.updateDetailValue(name);
    } else if (id === 'together') {
      this.showPartners();
    }
  }

  /**
   * 打开伙伴选择弹窗（Choices 的 people 样式：头像 + 名字）。
   * 名单复用 loadData 时拉到的 partners，不再重新请求。
   */
  protected showPartners() {
    if (!this.partners.length) return;

    const together = this.getData().together;
    const items = this.adapter.adaptPartnerOptions(this.partners, together?.value);
    this.getChoices().show(
      {
        id: 'together',
        name: '叫上谁一起',
        tips: '只显示我星标、且互相关注的伙伴',
        items: items,
        limited: 1,
        style: 'people',
      },
      {
        onChoicesDialogItemTap: (item) => {
          this.selectPartner(item.id);
        },
      }
    );
  }

  /** 选定伙伴 / 取消委托（kNoPartner 即取消），只改本地，提交时随任务一起写回 */
  protected selectPartner(id: string) {
    const together = this.adapter.buildTogetherVM(this.partners, id);
    if (!together) return;
    this.updateData({ together: together });
  }

  /** 打开更多分类弹窗（委托 ChoicesUI） */
  protected showMoreCategories() {
    const categories = this.adapter.adaptMoreCategories(this.getSelectedCategory());
    this.getChoices().show(
      {
        id: 'more-category',
        name: '更多分类',
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

  /** 自定义时长输入 */
  protected onInputChanged(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset;
    const text = (e.detail.value || '') as string;
    if (id === 'duration') {
      this.updateDurationCustom(text, true);
    } else if (id === 'detail') {
      this.updateDetailValue(text);
    }
  }

  /** 自定义时长确认（失焦后生效） */
  protected onInputBlur(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset;
    const text = this.getData().duration.value?.trim();
    if (!text) return;
    if (id === 'duration') {
      const mins = parseInt(text, 10);
      if (isNaN(mins) || mins <= 0 || mins > 480) {
        this.showToast('请输入 1-480 之间的分钟数');
        this.updateDurationCustom('');
        return;
      }
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

  protected onInputMenuTap(e: WechatMiniprogram.TouchEvent) {
    const { id, button } = e.currentTarget.dataset;
    if (id === 'detail') {
      if (button?.startsWith('footer')) {
        const examples = this.getDetailExamples();
        if (examples?.items?.length) {
          const options: Entity.Option[] = examples.items.map((o) => {
            return { id: o.id, name: o.name, desc: o.desc };
          });
          this.getChoices().show(
            { id: 'i', name: '提示', items: options, limited: 1, style: 'detailed' },
            {
              onChoicesDialogItemTap: (item) => {
                const detail = this.getData().detail;
                detail.footer = this.getFooter(item.id);
                this.setData({ detail });
              },
            }
          );
        }
      }
    }
  }

  protected getFooter(id?: string): Entity.Label {
    const examples = this.getDetailExamples();
    if (examples?.items?.length) {
      let item: Entity.Hierarchy | undefined;
      if (!id) {
        const rand = Math.floor(Math.random() * examples.items.length);
        item = examples.items[rand];
      } else {
        item = Entity.find(examples.items, id).item;
      }
      if (item) {
        return {
          id: 'footer:' + item.id,
          name: '例如',
          desc: item.items?.map((o) => o.name).join(' · ') || '',
          hint: examples.name || '',
        };
      }
    }
    return { id: '', name: '' };
  }

  protected getDetailExamples(): Entity.Hierarchy | undefined {
    const category = this.getSelectedCategory();
    if (category && !this.updating()) {
      const config = RoutineAdapter.findConfig(category);
      return config?.createExamples;
    }
    return undefined;
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

  protected updateDetailValue(v: string) {
    const detail = this.getData().detail;
    detail.value = v;
    detail.charCount = v.length;
    this.updateData({ detail });
  }

  protected updateDurationCustom(v: string, focus = false) {
    const duration = this.getData().duration;
    duration.value = v;
    duration.focused = focus;
    this.updateData({ duration });
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

    const content = data.detail.value?.trim();
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
    // 委托：没有可选伙伴时整块卡不存在，也就不该带这个字段。
    // value 为空即「没叫人」，与取消委托的约定值 '0' 一致。
    if (data.together) {
      newInfo.delegated = data.together.value || RoutineEditorAdapter.kNoPartner;
    }
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
    const detail = this.getData().detail;
    detail.disabled = false;
    detail.hint = config?.hint || '';
    detail.items = examples;
    detail.footer = this.getFooter();

    this.updateData({ category: input, detail });
  }
}

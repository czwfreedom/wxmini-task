import { SubUI } from '../core/subUI';
import { Err } from '../constant/error';
import { Entity } from '../model/entity';
import { DateUtils } from '../utils/dateUtils';
import { Routine } from '../server/routine';
import { RoutineAdapter } from './routineAdapter';
import { Logger } from '../utils/logger';
import { Event } from '../core/event';
import { Context } from '../core/context';
import { Intent } from '../core/intent';
import { Constants } from '../constant/common';
import { DialogUI } from '../ui/dialogUI';
import { WxUtils } from '../utils/wxUtils';
import { UserUpdaterUI } from '../ui/userUpdaterUI';
import { RoutineTemplatesUI } from '../ui/routineTemplatesUI';

export namespace RoutineUI {
  export interface Data extends SubUI.Data {
    /**
     * 是否可以更新。自己的，且今天及之后可以更新。
     */
    updateable: boolean;
    /**
     * 是否可以添加。自己的，且今天及之后可以添加。
     */
    addable: boolean;
    /**
     * 是否可以完成。自己的，且今天及之前的可以完成。
     */
    finishable: boolean;

    /**
     * 是否可以“下一天”
     */
    nextable: boolean;

    /** 今天的任务是否已全部完成 */
    isAllDone: boolean;
    /** 任务列表 */
    records: Record[];
    /** 是否今天（历史日期为 false，Hero 褪色 + 显示回到今天） */
    isToday: boolean;
    /** 日期标签：今天是 / 回顾那一天 */
    dateLabel: string;
    /** 日期主文本，如「7月28日 周二」 */
    dateMain: string;
    /** 日期选择器当前值，如「2026-08-03」 */
    pickerValue: string;
    /** 日期选择器上限（今天），禁选未来 */
    pickerEnd: string;

    /**
     * 三个统计合并成一个。
     */
    stat?: Stat;

    starVisible?: boolean;

    /**
     * 加了星标的已关注，
     * name: 名字
     * letterIndex: 名字首字
     * desc: 描述
     */
    stars?: Entity.Image[];

    dialog?: DialogUI.Data;
    templates?: RoutineTemplatesUI.Data;
  }

  export interface Stat extends Entity.Label {
    progress: number;
  }

  /** ViewModel，仅包含 UI 渲染需要的字段 */
  export interface Record extends Entity.Label {
    holder?: boolean;
    done?: boolean;
    /** 任务详情 */
    detail: string;
    /** 任务分类 */
    category: number;
    /** 分类颜色 */
    color: string;
    /** 分类图标路径 */
    icon: string;
    /** 任务状态 */
    status: number;
    /** 完成时间 */
    finishTime?: number;
    /** 反馈内容 */
    remark?: string;

    /**
     * 若指定，展示底部的点赞/评论交互区，否则留空。（看自己的routine时，如果没有数据，没必要展示出来占地方）
     * id: like
     * name: 文本
     * avatar: 图标
     */
    footers?: Entity.Image[];

    /**
     * 控制整个评论区的可见性。
     */
    commentVisible?: boolean;

    /**
     * 若指定，展示出具体的评论区。每一item中的字段，空数组就展示出空状态。
     */
    comments?: Comment[];

    /**
     * 若指定，展示底下的评论输入区。
     */
    commentable?: boolean;
  }

  // id: 评论ID
  // name: 评论人名字
  // letterIndex: 名字首字
  // avatarStyle： 名字背景色，与relationsAdapter生成的逻辑一致。
  // desc: 评论具体内容
  // hint: 评论时间
  // editable: 自己的评论可以删除、修改。
  export interface Comment extends Entity.Image {
    editable?: boolean;
  }
}

export class RoutineUI extends UserUpdaterUI<RoutineUI.Data> {
  protected adapter = new RoutineAdapter();
  protected date = 0;
  protected timer?: number;

  public constructor(component: any, subDataKey = '', userId?: string) {
    super(component, subDataKey);
    this.adapter.userId = userId || Context.getUserId();

    this.bindEvent('onItemTap', this.onItemTap);
    this.bindEvent('onMenuTap', this.onMenuTap);
    this.bindEvent('onShareTap', this.onShareTap);
    this.bindEvent('onDatePicked', this.onDatePicked);
    this.bindEvent('onItemMenuTap', this.onItemMenuTap);
    this.bindEvent('onRelationTap', this.onRelationTap);

    this.registerEventBus(Event.Name.RoutineUpdated, (ev: Routine.Info) => {
      if (ev?.id && ev?.userId === this.adapter?.userId && this.date === ev.date) {
        this.adapter.addInfo(ev);
        this.updateView();
      }
    });
    this.registerEventBus(Event.Name.onAddTap, () => {
      const date = this.adapter.isFuture() ? this.date : this.adapter.getToday();
      Intent.navigateTo(Constants.Page.CreateRoutine, {
        data: { date: date },
      } as Intent.Wrap<Partial<Routine.Info>>);
    });
    this.registerEventBus(Event.Name.OnDoubleTap, (ev: Event.DoubleTap) => {
      if (ev?.button === 'routine' && ev?.from === 'home' && this.getData().loaded) {
        this.loadData();
      }
    });
    this.registerEventBus(Event.Name.TemplateUpdated, async () => {
      if (this.getData().loaded) {
        await this.adapter.loadTemplate(true);
        this.setData({ loaded: true, ...this.adapter.adapt() });
      }
      this.loadData();
    });

    this.registerEventBus(Event.Name.RelationUpdated, () => {
      if (this.getData().loaded) {
        this.adapter.loadStars(true).then((res) => {
          if (res === 0) this.setData({ ...this.adapter.adaptStars() });
        });
      }
    });
  }

  public static defaultData(): RoutineUI.Data {
    return {
      loaded: false,
      abortMessage: '',
      updateable: false,
      addable: false,
      finishable: false,
      nextable: false,
      isAllDone: false,
      records: [],
      isToday: true,
      dateLabel: '',
      dateMain: '',
      pickerValue: '',
      pickerEnd: '',
    };
  }

  /**
   * @override
   */
  public release(): void {
    this.resetTimer(true);
    super.release();
  }

  public onPullDownRefresh() {
    Logger.info('onPullDownRefresh');
    if (this.getData().loaded) this.loadDate(this.adapter.date, true);
  }

  public async loadData(): Promise<number> {
    return this.loadDate(Date.now());
  }

  /** 加载指定日期并刷新视图，供翻页/选择器/回到今天复用 */
  protected async loadDate(date: number, reload = false): Promise<number> {
    date = DateUtils.getStartMillisOfDay(date);
    this.date = date; // 有太多引用了，故也保存在这里。
    const errcode = await this.adapter.load(date, reload);
    if (errcode !== Err.Code.OK) return this.abort(errcode);
    this.setData({ loaded: true, ...this.adapter.adapt() });
    this.resetTimer();
    return 0;
  }

  protected async onMenuTap(e: WechatMiniprogram.TouchEvent) {
    const { button } = e.currentTarget.dataset;
    Logger.info('onMenuTap', button);
    if (button === 'next') {
      const next = this.date + DateUtils.sDayMillis;
      const max = this.adapter.getMaxMillis();
      if (next > max) {
        const isSelf = this.adapter.isSelf();
        if (isSelf) this.showToast('只支持提前一天规划任务');
        return;
      }
      this.loadDate(next);
    } else if (button === 'prev') {
      this.loadDate(this.date - 24 * 3600 * 1000);
    } else if (button === 'template') {
      this.showLoading();
      const data = await RoutineTemplatesUI.load();
      this.hideLoading();
      if ('number' === typeof data) {
        this.showErrToast(data);
        return;
      }
      const dialog = new RoutineTemplatesUI(this.component, this.subDataKey);
      dialog.show(data);
    } else if (button === 'today') {
      this.loadDate(Date.now());
    } else if (button === 'star') {
      Intent.navigateTo(`${Constants.Page.Relations}?dir=usee`);
    }
  }

  /** 原生日期选择器（picker mode="date"），上限今天 */
  protected onDatePicked(e: WechatMiniprogram.TouchEvent) {
    const value = (e.detail.value as string) || '';
    Logger.info('onDatePicked', value);
    const millis = DateUtils.getStartMillisOfDay(new Date(value.replace(/-/g, '/')).getTime());
    if (!millis || millis === this.date) return;
    this.loadDate(millis);
  }

  protected onItemMenuTap(e: WechatMiniprogram.TouchEvent) {
    const { id, button } = e.currentTarget.dataset;
    Logger.info('onMenuTap', id, button);

    if (button === 'comment') {
      this.toggleComment(id);
    } else if (button === 'like') {
      this.toggleLike(id);
    } else if (button === 'createComment' || button === 'editComment') {
      this.createComment(id);
    } else if (button === 'deleteComment') {
      this.getDialog().show(
        {
          id: 'm',
          name: '确认要删除吗？',
          desc: '删除之后将无法恢复，请确认',
          menus: DialogUI.defaultMenus('danger'),
        },
        (button) => {
          if (button === 'confirm') {
            this.doCreateComment(id, '');
          }
        }
      );
    }
  }

  protected onRelationTap(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset;
    Intent.navigateTo(`${Constants.Page.Routine}?uid=${id}`);
  }

  protected async toggleLike(id: string) {
    if (this.adapter.isSelf()) return;
    const vm = Entity.find(this.getData().records, id);
    if (!vm.item) return;

    this.showLoading();
    const res = await this.adapter.toggleLike(id);
    this.hideLoading();
    if (res !== 0) {
      this.showErrToast(res);
      return;
    }

    vm.item.footers = this.adapter.adaptFooters(this.adapter.getInfo(id)!);
    this.setKvData(`records[${vm.index}]`, vm.item);
  }

  protected async toggleComment(id: string) {
    const vm = Entity.find(this.getData().records, id);
    if (!vm.item) return;
    this.showLoading();
    const res = await this.adapter.loadComments(id);
    this.hideLoading();
    if (res !== 0) {
      this.showErrToast(res);
      return;
    }

    const newVM = this.adapter.adaptComments(vm.item);
    this.setKvData(`records[${vm.index}]`, newVM);
  }

  protected createComment(id: string) {
    if (this.adapter.isSelf()) return;
    const dialog = this.getDialog();
    const comment = this.adapter.getComment(id, Context.getUserId());
    dialog.show(
      {
        id: 'm',
        name: '评论',
        input: {
          id: 'detail',
          name: '',
          type: 'textarea',
          value: comment?.detail,
          hint: '说点什么鼓励你的伙伴吧',
          maxLength: 400,
        },
        menus: DialogUI.defaultMenus(),
      },
      (button) => {
        if (button === 'confirm' && dialog.getInputValue()) {
          this.doCreateComment(id, dialog.getInputValue());
        }
      }
    );
  }

  protected async doCreateComment(id: string, detail: string) {
    const vm = Entity.find(this.getData().records, id);
    if (!vm.item) return;

    this.showLoading();
    const res = await this.adapter.updateComment(id, detail);
    this.hideLoading();
    if (res !== 0) {
      this.showErrToast(res);
      return;
    }

    const newVM = this.adapter.adaptComments(vm.item, true);
    newVM.footers = this.adapter.adaptFooters(this.adapter.getInfo(id)!);
    this.setKvData(`records[${vm.index}]`, newVM);
  }

  /**
   * 跨天的情况下，没有自动刷新，所以自己引入一个计时器。
   */
  protected resetTimer(force = false) {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    if (this.adapter.isSelf() && this.adapter.isToday && !force) {
      const date = this.date;
      const millis = date + DateUtils.sDayMillis - Date.now();
      if (millis > 0) {
        this.timer = setTimeout(() => {
          this.timer = undefined;
          if (this.adapter.isToday && date === this.date) {
            this.loadData();
          }
        }, millis);
      }
    }
  }

  protected updateView() {
    this.setData({ ...this.adapter.adapt() });
  }

  /** 切换任务状态：进行中 ↔ 已完成 */
  protected async onItemTap(e: WechatMiniprogram.TouchEvent) {
    const { id, button } = e.currentTarget.dataset;
    const vm = Entity.find(this.getData().records, id).item;
    const info = this.adapter.getInfo(id);
    if (vm && !info) {
      if (id.startsWith('holder')) {
        const template = this.adapter.findTemplate(vm.category);
        Intent.navigateTo(Constants.Page.CreateRoutine, {
          data: { category: vm.category, date: this.date, duration: template?.duration },
        } as Intent.Wrap<Partial<Routine.Info>>);
      }
    } else if (info) {
      const edit = button !== 'next';
      if (edit && !this.getData().updateable) return;
      if (this.getData().updateable || this.getData().finishable) {
        Intent.navigateTo(Constants.Page.CreateRoutine, {
          type: Routine.isDone(info) || !edit ? Entity.Action.Finish : Entity.Action.Update,
          data: info,
        });
      }
    }
  }

  /** 分享入口 */
  protected onShareTap() {
    WxUtils.hapticLight();
    Logger.info('onShareTap');
    this.share();
  }
}

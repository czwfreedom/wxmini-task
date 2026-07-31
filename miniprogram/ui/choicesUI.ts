import { SubUI } from '../core/subUI';
import { Entity } from '../model/entity';
import { Logger } from '../utils/logger';

export namespace ChoicesUI {
  export interface Data {
    /** 弹窗 ID，空字符串表示不展示 */
    id: string;
    /** 标题 */
    title?: string;
    /** 确定按钮文字（多选时 header 使用） */
    confirm?: string;
    /** 限制选择数量，1 为单选，>1 为多选 */
    limited?: number;
    /** 是否有序（预留） */
    ordered?: boolean;
    /** items 上方提示 */
    tips?: string;
    /** 待选列表 */
    items: Entity.Option[];
    /** 一行展示几个：'2' 横向 / '3' 纵向 / '4' 纯文本 */
    grid?: string;
    /** 是否模态（不可取消） */
    modal?: boolean;
  }

  export interface WrapData {
    choices: Data;
  }

  export interface Listener {
    /** 单项点击（单选自动关闭前回调） */
    onChoicesDialogItemTap?(item: Entity.Option, id?: string): void;
    /** 多选确认按钮 */
    onChoicesDialogConfirmTap?(): void;
    /** 选中变化回调（多选时每次 toggle 触发） */
    onSelectedChanged?(selectedIds: string[]): void;
  }
}

export class ChoicesUI extends SubUI<ChoicesUI.WrapData> {
  private listener?: ChoicesUI.Listener;
  private selectedIds: string[] = [];

  public constructor(component: any) {
    super(component);

    this.bindEvent('onChoicesItemTap', this.onItemTap);
    this.bindEvent('onChoicesMaskTap', this.onMaskTap);
    this.bindEvent('onChoicesCloseTap', this.onCloseTap);
    this.bindEvent('onChoicesConfirmTap', this.onConfirmTap);
  }

  /** 展示弹窗 */
  public show(data: ChoicesUI.Data, listener: ChoicesUI.Listener) {
    this.listener = listener;
    this.selectedIds = [];

    const limited = data.limited || 1;
    const items = (data.items || []).map((item) => ({
      ...item,
      selected: false,
      style: '',
    }));

    this.setData({
      _choices: {
        id: data.id || 'choices',
        title: data.title,
        confirm: data.confirm || '确定',
        limited,
        ordered: data.ordered,
        tips: data.tips,
        items,
        grid: data.grid || '3',
        modal: data.modal || false,
      },
    });
  }

  /** 隐藏弹窗 */
  public hide() {
    this.setData({
      _choices: { id: '', title: '', items: [], limited: 1, grid: '3' },
    });
    this.listener = undefined;
    this.selectedIds = [];
  }

  /** 获取当前选中的项 */
  public getSelectedItems(): Entity.Option[] {
    const data = this.getData();
    const items = data.choices?.items || [];
    return items.filter((item) => this.selectedIds.includes(item.id));
  }

  // ---- 事件处理（public 供 Page 委托调用） ----

  public onItemTap(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;

    const data = this.getData();
    const choices = data.choices;
    if (!choices || !choices.id) return;

    const limited = choices.limited || 1;
    const items = choices.items || [];

    if (limited === 1) {
      // 单选：标记选中 → 回调 listener → 自动关闭
      const newItems = items.map((item) => ({
        ...item,
        selected: item.id === id,
        style: item.id === id ? 'selected' : '',
      }));

      this.setData({ _choices: { ...choices, items: newItems } });

      const selected = items.find((item) => item.id === id);
      if (selected && this.listener?.onChoicesDialogItemTap) {
        this.listener.onChoicesDialogItemTap(selected, choices.id);
      }

      if (!choices.modal) {
        setTimeout(() => this.hide(), 150);
      }
    } else {
      // 多选：toggle 选中态
      const idx = this.selectedIds.indexOf(id as string);
      if (idx >= 0) {
        this.selectedIds.splice(idx, 1);
      } else if (this.selectedIds.length < limited) {
        this.selectedIds.push(id as string);
      }

      const newItems = items.map((item) => ({
        ...item,
        selected: this.selectedIds.includes(item.id),
        style: this.selectedIds.includes(item.id) ? 'selected' : '',
      }));

      this.setData({ _choices: { ...choices, items: newItems } });
      this.listener?.onSelectedChanged?.(this.selectedIds);
    }
  }

  public onMaskTap() {
    const data = this.getData();
    if (!data.choices?.modal) {
      this.hide();
    }
  }

  public onCloseTap() {
    this.hide();
  }

  public onConfirmTap() {
    this.listener?.onChoicesDialogConfirmTap?.();
    this.hide();
  }
}

import { SubUI } from '../core/subUI';
import { Entity } from '../model/entity';

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
    /** 一行展示几个: 默认是1个 */
    grid?: number;
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
    this.bindEvent('onChoicesMenuTap', this.onMenuTap);
  }

  public static defaultData(): ChoicesUI.Data {
    return {
      id: '',
      title: '',
      confirm: '',
      limited: 1, // 默认是单选。
      items: [],
    };
  }

  /** 展示弹窗 */
  public show(data: ChoicesUI.Data, listener: ChoicesUI.Listener) {
    this.listener = listener;
    this.selectedIds = [];

    if (!data.limited) data.limited = 1;
    this.setData({ choices: data });
  }

  /** 隐藏弹窗 */
  public hide() {
    this.setData({
      choices: { id: '', title: '', items: [], limited: 1, grid: '3' },
    });
    this.listener = undefined;
    this.selectedIds = [];
  }

  /** 获取当前选中的项 */
  public getSelectedItems(): Entity.Option[] {
    return this.getData().choices.items.filter((o) => o.selected);
  }

  protected onItemTap(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;

    const choices = this.getData().choices;
    if (!choices || !choices.id) return;
    const item = Entity.find(choices.items, id).item;
    if (!item) return;

    const limited = choices.limited || 1;
    if (limited === 1) {
      for (const item of choices.items) {
        if (item.id === id) {
          item.selected = true;
        } else if (item.selected) {
          item.selected = false;
        }
      }
      this.setData({ choices: choices });
      if (item && this.listener?.onChoicesDialogItemTap) {
        this.listener.onChoicesDialogItemTap(item, choices.id);
      }
      setTimeout(() => this.hide(), 150);
    } else {
      // TODO 如果超出限制？
      item.selected = !item.selected;
      this.setData({ choices: choices });
      this.listener?.onSelectedChanged?.(Entity.getSelectedIds(choices.items));
    }
  }

  protected onMenuTap(e: WechatMiniprogram.TouchEvent) {
    const { button } = e.currentTarget.dataset;
    if (button === 'cancel') {
      this.hide();
    } else if (button === 'confirm') {
      this.listener?.onChoicesDialogConfirmTap?.();
      this.hide();
    }
  }
}

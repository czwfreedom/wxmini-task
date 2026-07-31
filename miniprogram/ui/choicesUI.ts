import { SubUI } from '../core/subUI';
import { Entity } from '../model/entity';

export namespace ChoicesUI {
  export interface Data {
    // ID，一个页面可能会有不同弹窗。
    id: string;

    // 在允许多选的情况下，顶部会有一个Header，从左到右是
    // 取消 按键
    // 标题 title
    // 确定 按钮 confirm
    title?: string;
    confirm?: string;
    confirmOpenType?: string;

    // 在多选的情况下，指定能选多少，如果是1,就表示单选。
    // 单选不展示顶部的header，而用底部的取消按钮。
    limited?: number;
    // 预留：多选也可以是有顺序的。
    ordered?: boolean;

    tips?: string; // items上面的提示。
    // 要展示的内容，会带有以下内容：
    // 可选 avatar: 图标
    // name: 名称
    // 可选 desc: 描述
    items: Entity.Option[];
    // 一行展示几个。
    grid?: string;
    // 如果是modal，则不可取消。
    modal?: boolean;
  }

  export interface WrapData {
    choices: Data;
  }

  export interface Listener {
    onChoicesDialogItemTap?(item: Entity.Option, id?: string): void;
    onChoicesDialogConfirmTap?(): void;
    onSelectedChanged?(selectedIds: string[]): void;
  }
}

export class ChoicesUI extends SubUI<ChoicesUI.WrapData> {
  public constructor(component: any) {
    super(component);
  }

  /** 展示弹窗。data 见 ChoicesUI.Data，listener 见 ChoicesUI.Listener */
  public show(data: ChoicesUI.Data, listener: ChoicesUI.Listener) {}

  /** 获取当前选中的项（多选场景，确认前也可调用） */
  public getSelectedItems(): Entity.Option[] {
    return [];
  }

  public hide() {}
}

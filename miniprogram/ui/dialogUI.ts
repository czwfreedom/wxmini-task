import { SubUI } from '../core/subUI';
import { Entity } from '../model/entity';
import { MenuUI } from './menuUI';

export namespace DialogUI {
  /**
   * {@link Entity.Label#name} 标题
   * {@link Entity.Label#desc} 位于标题之下的描述。
   * {@link Entity.Label#hint} 按钮后面的说明
   */
  export interface Data extends Entity.Label {
    descStyle?: string; // 默认居中，又有一些要求左对齐。
    menus?: MenuUI.VM[]; // 菜单。
  }

  export interface WrapData {
    dialog: Data;
  }
}

export class DialogUI extends SubUI<DialogUI.WrapData> {
  protected data?: DialogUI.Data;

  public show(data: DialogUI.Data, onButtonTap?: (button: string) => void) {
    this.data = data;
    this.bindEvent('onDialogButtonTap', (e) => {
      const { button } = e.currentTarget.dataset;

      this.hide();
      onButtonTap && onButtonTap(button);
    });

    this.setData({ dialog: data });
  }

  // 在open-type的场景，未必会直接回调上面的事件，而要主动调用。
  public hide() {
    // 总是隐藏
    this.setData({ dialog: { id: '', title: '', left: '', right: '' } });
    this.unbindEvent('onDialogButtonTap');
  }
}

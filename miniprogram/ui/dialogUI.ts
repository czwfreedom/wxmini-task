import { SubUI } from '../core/subUI';
import { Entity } from '../model/entity';
import { Logger } from '../utils/logger';
import { MenuUI } from './menuUI';

export namespace DialogUI {
  /**
   * {@link Entity.Label#name} 标题
   * {@link Entity.Label#desc} 位于标题之下的描述。
   * {@link Entity.Label#hint} 按钮后面的说明
   */
  export interface Data extends Entity.Label {
    descStyle?: string; // 默认居中，又有一些要求左对齐。
    // 如果设置了，在desc下展示一个单行的input
    // hint: 表示input的holder
    // maxLength: 限制长度
    input?: MenuUI.Input;
    menus?: MenuUI.VM[]; // 菜单。
  }

  export interface WrapData {
    dialog: Data;
  }
}

export class DialogUI extends SubUI<DialogUI.WrapData> {
  protected data?: DialogUI.Data;
  private inputValue: string = '';

  public static defaultMenus(): MenuUI.VM[] {
    return [
      { id: 'cancel', name: '取消' },
      { id: 'confirm', name: '确定' },
    ];
  }

  public show(data: DialogUI.Data, onButtonTap?: (button: string) => void) {
    this.data = data;
    this.inputValue = '';

    this.bindEvent('onDialogButtonTap', (e) => {
      Logger.log('onDialogButtonTap', e);
      const { button } = e.currentTarget.dataset;

      if (button === 'confirm' && this.data?.input?.hint && !this.inputValue?.trim()) {
        this.showToast(this.data.input.hint);
        return;
      }

      this.hide();
      onButtonTap && onButtonTap(button);
    });

    // 如果有 input 字段，则启用输入组件（如 type="nickname"）
    if (data.input) {
      this.bindEvent('onDialogInput', (e: WechatMiniprogram.TouchEvent) => {
        this.inputValue = e.detail.value;
      });
    }

    this.setData({ dialog: data });
  }

  /** 获取输入组件的值（如昵称），供调用方在按钮回调里读取 */
  public getInputValue(): string {
    return this.inputValue;
  }

  // 在open-type的场景，未必会直接回调上面的事件，而要主动调用。
  public hide() {
    this.inputValue = '';
    // 总是隐藏
    this.setData({ dialog: { id: '', title: '', left: '', right: '' } });
    this.unbindEvent('onDialogButtonTap');
    this.unbindEvent('onDialogInput');
  }
}

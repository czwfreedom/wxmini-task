import { Context } from '../../core/context';
import { AudiosUI } from './audiosUI';
import { InputUI } from './inputUI';

// 继承 AudiosUI（它是 InteractUI 的子类）后，所有输入型页面都具备音频播放能力
export abstract class PageInputUI<D> extends AudiosUI<D> {
  protected keyboardListener?: (
    res: WechatMiniprogram.OnKeyboardHeightChangeListenerResult
  ) => void;

  public constructor(component: any, subDataKey = '') {
    super(component, subDataKey);
    // this.bindEvent('onInputLineChange', this.onInputLineChange);
  }

  public release(): void {
    if (this.keyboardListener) wx.offKeyboardHeightChange(this.keyboardListener);
    super.release();
  }

  /**
   * 适配已有页面。
   */
  public getInputItem(id: string): InputUI.VM | undefined {
    return undefined;
  }

  // 默认行为？？
  // 不清楚子类是怎么定义VM的，所以留个hook点。
  protected setInputData(id: string, item: InputUI.VM, changed = true) {
    this.setData({ [id]: item });
  }

  /**
   * 手头一些机器，顶起时，keyboard没有占用 safeBottom，但存在本身是只能在safeArea之中的，顶起会导致底部有个空白。
   */
  protected watchKeyboard() {
    if (!this.keyboardListener) {
      this.keyboardListener = (res) => {
        this.setData({ keyboardHeight: Math.max(0, res.height - Context.getSafeBottom()) });
      };
      wx.onKeyboardHeightChange(this.keyboardListener);
    }
  }

  /**
   * textarea 行数变化：按行数设置高度（有上限），避免原生 textarea 无限增高盖住底部按钮。
   *
   * @remarks
   * textarea 是原生组件、层级最高（z-index 无效），若用 auto-height 会一直变高并盖住
   * 底部 CTA。改为受控高度：行数 × 行高，最大 TEXT_MAX_LINES 行，超出后高度固定，
   * 内容由 textarea 自身内部滚动。
   */
  // protected onInputLineChange(e: WechatMiniprogram.TouchEvent) {
  //   const { id } = e.currentTarget.dataset;
  //   const item = this.getInputItem(id || '');
  //   if (!item) return;

  //   const lineCount = e?.detail?.lineCount || 1;
  //   /** textarea 单行高度（rpx）：font-size 34rpx × line-height 1.4 ≈ 48rpx */
  //   /** textarea 常规最小高度（rpx），与 input.scss 中 min-height 一致 */
  //   /** textarea 大号最小高度（rpx），对应 style 为 h 时 */
  //   /** textarea 最大行数：超过后高度固定、内部滚动 */
  //   const min = item.style === 'h' ? 192 : 96;
  //   const height = Math.max(min, Math.min(lineCount, 16) * 48);
  //   if (item.textHeight === height) return;

  //   item.textHeight = height;
  //   this.setInputData(id, item);
  // }
}

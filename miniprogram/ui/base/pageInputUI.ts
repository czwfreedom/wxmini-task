import { AudiosUI } from './audiosUI';
import { InputUI } from './inputUI';

// 继承 AudiosUI（它是 InteractUI 的子类）后，所有输入型页面都具备音频播放能力
export abstract class PageInputUI<D> extends AudiosUI<D> {
  /**
   * 适配已有页面。
   */
  public getInputItem(id: string): InputUI.VM | undefined {
    return undefined;
  }
}

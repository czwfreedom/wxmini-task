import { InteractUI } from '../../core/interactUI';
import { InputUI } from './inputUI';

export abstract class PageInputUI<D> extends InteractUI<D> {
  /**
   * 适配已有页面。
   */
  public abstract getInputItem(id: string): InputUI.VM;
}

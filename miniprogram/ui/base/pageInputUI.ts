import { SubUI } from '../../core/subUI';
import { InputUI } from './inputUI';

export abstract class PageInputUI<D> extends SubUI<D> {
  /**
   * 适配已有页面。
   */
  public abstract getInputItem(id: string): InputUI.VM;
}

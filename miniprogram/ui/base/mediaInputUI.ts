import { InputUI } from './inputUI';
import { PageInputUI } from './pageInputUI';

export abstract class MediaInputUI<D> extends PageInputUI<D> {
  public constructor(component: any, subDataKey = '') {
    super(component, subDataKey);

    this.bindEvent('onInputMediaTap', this.onInputMediaTap);
  }

  protected onInputMediaTap(e: WechatMiniprogram.TouchEvent) {
    const { id, subid, button } = e.currentTarget.dataset;
    const item = this.getInputItem(id);
    if (!id) return;
  }

  protected static defaultImageVM(id: string): InputUI.VM {
    
  }

  protected static defaultAudioVM(id: string): InputUI.VM {}
}

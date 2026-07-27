import { SubUI } from '../core/subUI';
import { Logger } from '../utils/logger';

export namespace IndexUI {
  export interface Data extends SubUI.Data {}
}

export class IndexUI extends SubUI<IndexUI.Data> {
  public constructor(component: any) {
    super(component);

    this.bindEvent('onMenuTap', this.onMenuTap);
  }

  public static getDefaultData(): IndexUI.Data {
    return {
      loaded: false,
      abortMessage: '',
    };
  }

  public loadData() {
    this.setData({ loaded: true });
  }

  protected onMenuTap(e: WechatMiniprogram.TouchEvent) {
    const { button } = e.currentTarget.dataset;
    Logger.info('onMenuTap', button);
    if (button === 'routine') {
      wx.navigateTo({ url: '/pages/routine' });
    }
  }
}

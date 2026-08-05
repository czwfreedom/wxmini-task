import { Intent } from '../core/intent';
import { SubUI } from '../core/subUI';

export namespace IndexUI {
  export interface Data extends SubUI.Data {}
}

export class IndexUI extends SubUI<IndexUI.Data> {
  public constructor(component: any) {
    super(component);
  }

  public static defaultData(): IndexUI.Data {
    return {
      loaded: false,
      abortMessage: '',
    };
  }

  public loadData() {
    this.setData({ loaded: true });
    Intent.redirectTo('/pages/home');
  }
}

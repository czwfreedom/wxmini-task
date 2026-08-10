import { Constants } from '../constant/common';
import { Context } from '../core/context';
import { Event } from '../core/event';
import { Intent } from '../core/intent';
import { SubUI } from '../core/subUI';
import { Relation } from '../server/relation';
import { DialogUI } from '../ui/dialogUI';
import { UserUpdaterUI } from '../ui/userUpdaterUI';

export namespace IndexUI {
  export interface Data extends SubUI.Data {
    dialog?: DialogUI.Data;
  }
}

export class IndexUI extends UserUpdaterUI<IndexUI.Data> {
  public constructor(component: any) {
    super(component);
  }

  public static defaultData(): IndexUI.Data {
    return {
      loaded: false,
      abortMessage: '',
    };
  }

  public async loadData(options?: Record<string, string>) {
    this.setData({ loaded: true });
    const e = options?.[Constants.Param.Event];
    if (e === Constants.Share.Def) {
      const userId = options?.[Constants.Param.UserId];
      const nonce = options?.[Constants.Param.Nonce];
      if (userId && nonce && userId !== Context.getUserId()) {
        this.share((cancel) => {
          if (!cancel && Context.isNamed()) {
            Relation.create(Context.getUserId(), userId).then((res) => {
              if ('number' !== typeof res) this.postEvent(Event.Name.RelationUpdated);
              this.home();
            });
          } else {
            this.home();
          }
        });
        return;
      }
    }

    // 其他情况总是直接到首页。
    this.home();
  }

  protected home() {
    Intent.redirectTo('/pages/home');
  }
}

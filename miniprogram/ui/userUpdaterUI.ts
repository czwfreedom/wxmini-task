import { Context } from '../core/context';
import { InteractUI } from '../core/interactUI';
import { Login } from '../core/login';
import { User } from '../server/user';
import { Logger } from '../utils/logger';
import { DialogUI } from './dialogUI';
import { ShareUI } from './shareUI';

export abstract class UserUpdaterUI<D> extends InteractUI<D> {
  protected dialog?: DialogUI;

  public getDialog(): DialogUI {
    if (!this.dialog) this.dialog = new DialogUI(this.component, this.subDataKey);
    return this.dialog;
  }

  // https://developers.weixin.qq.com/miniprogram/dev/reference/api/Page.html#onShareAppMessage-Object-object
  public onShareAppMessage(obj: any) {
    if (this.dialog) this.dialog.hide();
    const data = ShareUI.share();
    return data;
  }

  public async share(): Promise<void> {
    const user = Context.getUser();
    if (User.isNameSet(user)) {
      this.doShare();
      return;
    }

    const dialog = this.getDialog();
    dialog.show(
      {
        id: 'share',
        name: '完善你的信息',
        desc: '伙伴列表需要你的昵称，\n让大家更容易认出你',
        input: { id: 'name', name: '', hint: '输入你的昵称', type: 'nickname', maxLength: 16 },
        menus: DialogUI.defaultMenus(),
      },
      (button) => {
        if (button === 'confirm' && dialog.getInputValue()) {
          const newData = { id: user.id, name: dialog.getInputValue() };
          User.update(newData).then((res) => {
            if ('number' === typeof res) {
              this.showErrToast(res);
              return;
            }
            Logger.info('User name updated.');
            user.name = newData.name;
            Login.setCache(user);
            this.doShare();
          });
        }
      }
    );
  }

  protected doShare() {
    this.getDialog().show({
      id: 'share',
      name: '三人行，必有我师',
      desc: '邀请好友来看看你在做什么吧！',
      menus: [{ id: 'confirm', name: '马上分享', openType: 'share' }],
    });
  }
}

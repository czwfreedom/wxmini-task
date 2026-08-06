import { Context } from '../core/context';
import { Login } from '../core/login';
import { SubUI } from '../core/subUI';
import { User } from '../server/user';
import { Logger } from '../utils/logger';
import { DialogUI } from './dialogUI';

export class UserUpdaterUI extends SubUI<SubUI.Data> {
  public async checkName(cb: () => void): Promise<void> {
    const user = Context.getUser();
    if (user.name && user.name !== '微信用户') {
      return cb();
    }

    const dialog = new DialogUI(this.component, this.subDataKey);
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
          const res = User.update(newData);
          if ('number' === typeof res) {
            this.showErrToast(res);
            return;
          }
          Logger.info('User name updated.');
          user.name = newData.name;
          Login.setCache(user);
          cb();
        }
      }
    );
  }
}

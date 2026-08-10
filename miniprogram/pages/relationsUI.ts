import { SubUI } from '../core/subUI';
import { Err } from '../constant/error';
import { Entity } from '../model/entity';
import { RelationsAdapter } from './relationsAdapter';
import { MenuUI } from '../ui/menuUI';
import { Context } from '../core/context';
import { UserUpdaterUI } from '../ui/userUpdaterUI';
import { Intent } from '../core/intent';
import { Constants } from '../constant/common';
import { ChoicesUI } from '../ui/choicesUI';
import { DialogUI } from '../ui/dialogUI';
import { Event } from '../core/event';

export namespace RelationsUI {
  export interface Data extends SubUI.Data {
    /**
     * 方向：usee 表示我可查看的，user 表示可查看我的
     */
    direction: 'usee' | 'user';
    /**
     * 伙伴列表
     * name: 名字
     * letterIndex: 名字首字
     * desc: 描述
     */
    items: Entity.Image[];

    /**
     * 底部菜单。
     */
    menus: MenuUI.Menus;

    choices?: ChoicesUI.Data;
    dialog?: DialogUI.Data;
  }
}

export class RelationsUI extends UserUpdaterUI<RelationsUI.Data> {
  private adapter: RelationsAdapter;
  private direction = '';

  public constructor(component: any, dir: string) {
    super(component);
    this.direction = dir;
    this.adapter = new RelationsAdapter(dir);
    this.bindEvent('onItemTap', this.onItemTap);
    this.bindEvent('onMenuTap', this.onMenuTap);
    this.bindEvent('onBottomBarTap', this.onBottomBarTap);
  }

  public static defaultData(): RelationsUI.Data {
    return {
      loaded: false,
      abortMessage: '',
      direction: 'usee',
      items: [],
      menus: { id: '', items: [] },
    };
  }

  public async loadData() {
    const errcode = await this.adapter.load();
    if (errcode !== Err.Code.OK) {
      this.abort(errcode);
      return;
    }
    this.setData({
      loaded: true,
      direction: this.direction,
      menus: this.getMenus(),
      ...this.adapter.adapt(),
    });
  }

  protected onItemTap(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset;
    if (this.direction === 'usee') {
      Intent.navigateTo(`${Constants.Page.Routine}?uid=${id}`);
    }
  }

  protected onMenuTap(e: WechatMiniprogram.TouchEvent) {
    const { id, button } = e.currentTarget.dataset;
    if (button === 'more') {
      this.getChoices().show(
        {
          id: 'm',
          title: '设置',
          items: [{ id: 'del', name: this.canManage() ? '取消查看' : '移出可查看' }],
        },
        {
          onChoicesDialogItemTap: (item) => {
            this.showDeleteConfirm(id);
          },
        }
      );
    }
  }

  protected onBottomBarTap(e: WechatMiniprogram.TouchEvent) {
    const { button } = e.currentTarget.dataset;
    if (button === 'share') {
      this.share();
    }
  }

  protected getMenus(): MenuUI.Menus {
    if (this.direction === 'user') return { id: '', items: [] };
    const named = Context.isNamed();
    return {
      id: 'm',
      items: [{ id: 'share', name: '邀请伙伴', openType: named ? 'share' : '' }],
    };
  }

  protected canManage() {
    return this.direction === 'usee';
  }

  protected showDeleteConfirm(id: string) {
    const dir = this.canManage();
    this.getDialog().show(
      {
        id: 'm',
        name: dir ? '取消查看' : '移出可查看',
        desc: dir
          ? '取消后你将不再看到\nTA 的任务动态'
          : 'TA 将不再看到你的任务，\n如需恢复需重新分享',
        menus: [
          { id: 'cancel', name: '暂不' },
          { id: 'confirm', name: dir ? '确认取消' : '确认移出', style: 'danger' },
        ],
      },
      (button) => {
        if (button === 'confirm') {
          this.doDelete(id);
        }
      }
    );
  }

  protected async doDelete(id: string) {
    this.showLoading();
    const res = await this.adapter.delete(id);
    this.hideLoading();
    if (res !== 0) {
      this.showErrToast(res);
    } else {
      this.setData({ ...this.adapter.adapt() });
      this.postEvent(Event.Name.RelationUpdated);
    }
  }
}

import { SubUI } from '../core/subUI';
import { Err } from '../constant/error';
import { Entity } from '../model/entity';
import { RelationsAdapter } from './relationsAdapter';
import { MenuUI } from '../ui/menuUI';
import { Context } from '../core/context';
import { User } from '../server/user';
import { UserUpdaterUI } from '../ui/userUpdaterUI';
import { Intent } from '../core/intent';
import { Constants } from '../constant/common';

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

  protected onBottomBarTap(e: WechatMiniprogram.TouchEvent) {
    const { button } = e.currentTarget.dataset;
    if (button === 'share') {
      this.share();
    }
  }

  protected getMenus(): MenuUI.Menus {
    if (this.direction === 'user') return { id: '', items: [] };
    const user = Context.getUser();
    const isNameSet = User.isNameSet(user);
    return {
      id: 'm',
      items: [{ id: 'share', name: '邀请伙伴', openType: isNameSet ? 'share' : '' }],
    };
  }
}

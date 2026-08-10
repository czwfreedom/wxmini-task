import { SubUI } from '../core/subUI';
import { Err } from '../constant/error';
import { Constants } from '../constant/common';
import { Intent } from '../core/intent';
import { MineAdapter } from './mineAdapter';
import { Entity } from '../model/entity';
import { Event } from '../core/event';

export namespace MineUI {
  export interface Data extends SubUI.Data {
    /** 用户基本信息（头像+昵称） */
    info: Entity.Image;
    /** 统计数字列表（name=数值, hint=标签） */
    stats: Entity.Label[];
    /** 菜单入口卡片（name=标题, desc=副标题, hint=角标, avatarStyle=图标底色） */
    cards: Entity.Image[];
  }
}

export class MineUI extends SubUI<MineUI.Data> {
  private adapter = new MineAdapter();

  public constructor(component: any, subDataKey: string) {
    super(component, subDataKey);
    this.bindEvent('onCardTap', this.onCardTap);

    this.registerEventBus(Event.Name.RelationUpdated, () => {
      this.loadData();
    });
  }

  public static defaultData(): MineUI.Data {
    return {
      loaded: false,
      abortMessage: '',
      info: { id: '', name: '' },
      stats: [],
      cards: [],
    };
  }

  public async loadData() {
    const errcode = await this.adapter.load();
    if (errcode !== Err.Code.OK) {
      this.abort(errcode);
      return;
    }
    this.setData({ ...this.adapter.adapt(), loaded: true });
  }

  protected onCardTap(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset;
    Intent.navigateTo(`${Constants.Page.Relations}?dir=${id}`);
  }
}

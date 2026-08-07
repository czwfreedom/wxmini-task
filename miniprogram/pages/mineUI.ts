import { SubUI } from '../core/subUI';
import { MineAdapter } from './mineAdapter';
import { Entity } from '../model/entity';

export namespace MineUI {
  export interface Data extends SubUI.Data {
    /**
     * 表示我的信息
     */
    info: Entity.Image;

    /**
     * 表示各种统计。里面的数字、文字全在adapter中拼装。
     */
    stats: Entity.Label[];

    /**
     * 底下的卡片入口，包含我关注的伙伴这些。
     * {@link Entity.Image#name} 标题文字
     * {@link Entity.Image#desc} 灰色描述
     * {@link Entity.Image#hint} 色标
     * {@link Entity.Image#avatar} 图标
     * {@link Entity.Image#avatarStyle} 图标样式类
     */
    cards: Entity.Image[];
  }
}

export class MineUI extends SubUI<MineUI.Data> {
  private adapter = new MineAdapter();

  public constructor(component: any, subDataKey: string) {
    super(component, subDataKey);
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

  public loadData() {}
}

import { Entity } from '../../model/entity';

export namespace MenuUI {
  /**
   * 基础的菜单数据。
   */
  export interface VM extends Entity.Label {
    enabled?: boolean; // 是否可点击，没有设置为false，就表示可见。
    openType?: string; // 如果设置了，那使用微信小程序的button:open-type
    data?: any; // 私有数据。
  }

  export interface Menus extends Entity.Id {
    items: VM[];
  }

  export interface Input extends VM {
    type?: string;
    maxLength?: number;
    value?: string;
  }
  /**
   * Tab有文字，有普通图片，也有选中态图片。
   */
  export interface ImageTab extends Entity.Info {
    normalImage: string;
    checkedImage: string;
    visible?: boolean;
  }

  export interface ImageTabs extends Entity.Id {
    id: string;
    items: ImageTab[];
  }
}

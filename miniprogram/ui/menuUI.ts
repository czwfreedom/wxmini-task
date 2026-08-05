import { Entity } from '../model/entity';

export namespace MenuUI {
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

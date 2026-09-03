import { Entity } from '../../model/entity';

export namespace InputUI {
  export const enum Type {
    /**
     * 带图文的单选。
     */
    GridRadio = 'gridRadio',
  }

  // 配合 input.scss/wxml
  export interface VM extends Entity.Image {
    type?: string;
    maxLength?: number;
    value?: string;
    
    color?: string;

    other?: boolean; // 是否是'其他'

    selectedId?: string; // 选中的 id
    /**
     * 子选择。
     */
    items?: VM[];
  }
}

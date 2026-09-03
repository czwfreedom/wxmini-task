import { Entity } from '../../model/entity';

export namespace InputUI {
  export const enum Type {
    /**
     * 带图文的单选。
     */
    GridRadio = 'gridRadio',

    /**
     * 带候选的短输入。
     */
    OptionInput = 'optionInput',

    /**
     * 带候选的时间选择。
     */
    OptionTime = 'optionTime',
  }

  // 配合 input.scss/wxml
  export interface VM extends Entity.Image {
    type?: string;
    subType?: string; // 子类型，预留。
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

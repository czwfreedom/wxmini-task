import { Entity } from '../../model/entity';

export namespace InputUI {
  export const enum Type {
    /**
     * 多行输入。
     */
    Textarea = 'textarea',
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

    disabled?: boolean; // 是否禁用
    focused?: boolean; // 是否聚焦
    // 文本类。
    maxLength?: number;
    value?: string; // 当前值
    header?: string; // 头部提示。
    charCount?: number; // 当前字符数，预留。

    color?: string;

    other?: boolean; // 是否是'其他'

    selectedId?: string; // items中选中的 id
    /**
     * 子选择。
     */
    items?: VM[];
  }
}

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

    /**
     * 多图。
     */
    Images = 'images',

    /**
     * 多音频。
     */
    Audios = 'audios',

    /**
     * 委托：叫上伙伴一起。细长卡，未选虚线 / 已选金边。
     * value 存对方 userId，avatar/letterIndex/avatarStyle 见 input.wxml 的字段约定。
     */
    Together = 'together',
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
     * type 为 Images / Audios 时，复用为本表单的媒体列表：
     *   avatar = 图片或音频地址；name = 展示文案（音频可放时长文本，如「0:15」）。
     */
    items?: VM[];

    /**
     * name: 标题前缀，可以为空。
     * desc: 具体内容，可以为空，例如用 · 分隔的提示。
     * hint: 可以换提示，点击之后有事件，可以为空。
     */
    footer?: Entity.Label; // 底部提示。

    // 图片/视频/音频相关。
    mediaLimited?: number; // 最多上传大小。
    mediaDeletable?: boolean; // 图片是否删除。
    // mediaScaleable?: boolean;
    // mediaSortable?: boolean; // 图片是否可以排序。
    sourceType?: string[];

    /**
     * 是否正在录音，type 为 Audios 时控制「录音中」态。
     */
    recording?: boolean;
  }
}

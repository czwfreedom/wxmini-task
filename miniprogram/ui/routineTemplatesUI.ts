import { SubUI } from '../core/subUI';
import { Entity } from '../model/entity';
import { Logger } from '../utils/logger';

export namespace RoutineTemplatesUI {
  export interface Data extends SubUI.Data {
    /** 弹窗 ID，空字符串表示不展示 */
    id: string;
    /** 弹窗标题，如「选个日程模板」 */
    name: string;
    /** 标题下方的说明文字 */
    desc?: string;
    /** 模板列表 */
    items: Template[];
  }

  /** 单个日程模板 */
  export interface Template extends Entity.Info {
    /** 模板描述 */
    desc?: string;
    /** 标签样式：hot=热门 / official=官方 */
    tag?: string;
    /** 使用人数文案，如「128 人在用」 */
    used?: string;
    /** 模板包含的任务项 */
    items: Item[];
  }

  /** 模板任务项 */
  export interface Item {
    /** 任务名，如「阅读 30'」 */
    name: string;
    /** 分类颜色 */
    color: string;
  }

  export interface WrapData {
    templates: Data;
  }
}

export class RoutineTemplatesUI extends SubUI<RoutineTemplatesUI.WrapData> {
  public constructor(component: any) {
    super(component);
    this.bindEvent('onTemplateMaskTap', this.onMaskTap);
    this.bindEvent('onTemplateUseTap', this.onUseTap);
  }

  public static defaultData(): RoutineTemplatesUI.Data {
    return {
      id: '',
      loaded: false,
      abortMessage: '',
      name: '',
      items: [],
    };
  }

  /** 展示弹窗 */
  public show(data: RoutineTemplatesUI.Data) {
    this.setData({ templates: data });
  }

  /** 隐藏弹窗 */
  public hide() {
    this.setData({ templates: RoutineTemplatesUI.defaultData() });
  }

  /** 点击遮罩关闭 */
  protected onMaskTap() {
    this.hide();
  }

  /** 点击「选这个」按钮（预留，行为待定） */
  protected onUseTap(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset;
    Logger.info('onTemplateUseTap', id);
    // TODO 选中模板后的行为待定
  }
}

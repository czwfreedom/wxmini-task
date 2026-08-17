import { Err } from '../constant/error';
import { SubUI } from '../core/subUI';
import { Entity } from '../model/entity';
import { RoutineAdapter } from '../pages/routineAdapter';
import { Config } from '../server/config';
import { User } from '../server/user';
import { Logger } from '../utils/logger';

export namespace RoutineTemplatesUI {
  export interface Data {
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
  public constructor(component: any, subDataKey = '') {
    super(component, subDataKey);
    this.bindEvent('onTemplateMaskTap', this.onMaskTap);
    this.bindEvent('onTemplateUseTap', this.onUseTap);
  }

  public static defaultData(): RoutineTemplatesUI.Data {
    return { id: '', name: '', items: [] };
  }

  public static async load(): Promise<number | RoutineTemplatesUI.Data> {
    const res = await Config.list({
      userIds: [User.sSystem],
      types: [Config.Type.RoutineTemplate],
    });
    if ('number' === typeof res) return res;

    const tpls = Config.parseTemplate(res);
    if (!tpls?.length) return Err.Code.InvalidConfig;

    const vms: RoutineTemplatesUI.Template[] = [];
    for (const tpl of tpls) {
      const items: RoutineTemplatesUI.Item[] = [];
      for (const c of tpl?.items || []) {
        const config = RoutineAdapter.findConfig(c.category || 0);
        items.push({ name: config.name, color: config.color });
      }
      vms.push({ id: tpl.id, name: tpl.name, desc: tpl.detail, items: items });
    }
    debugger;
    return {
      id: 'tpl',
      name: '选个常用的任务模板',
      desc: '只提醒，不强制，可随时更换',
      items: vms,
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

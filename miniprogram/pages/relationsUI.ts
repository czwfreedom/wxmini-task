import { SubUI } from '../core/subUI';
import { Err } from '../constant/error';
import { Entity } from '../model/entity';
import { RelationsAdapter } from './relationsAdapter';

export namespace RelationsUI {
  export interface Data extends SubUI.Data {
    /**
     * 方向：usee 表示我可查看的，user 表示可查看我的
     */
    direction: 'usee' | 'user';
    /**
     * 伙伴列表
     * name: 名字
     * letterIndex: 名字首字
     * desc: 描述
     */
    items: Entity.Image[];
  }
}

export class RelationsUI extends SubUI<RelationsUI.Data> {
  private adapter: RelationsAdapter;
  private direction = '';

  public constructor(component: any, dir: string) {
    super(component);
    this.direction = dir;
    this.adapter = new RelationsAdapter(dir);
    this.bindEvent('onRowTap', this.onRowTap);
    this.bindEvent('onShareTap', this.onShareTap);
  }

  public static defaultData(): RelationsUI.Data {
    return {
      loaded: false,
      abortMessage: '',
      direction: 'usee',
      items: [],
    };
  }

  public async loadData() {
    const errcode = await this.adapter.load();
    if (errcode !== Err.Code.OK) {
      this.abort(errcode);
      return;
    }
    this.setData({ loaded: true, direction: this.direction, ...this.adapter.adapt() });
  }

  protected onRowTap(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset;
    // TODO: 跳转到围观对方任务页
    console.log('relations row tap:', id);
  }

  protected onShareTap() {
    // TODO: 触发微信分享
    console.log('relations share tap');
  }
}

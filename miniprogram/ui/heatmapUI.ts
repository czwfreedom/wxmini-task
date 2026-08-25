import { Err } from '../constant/error';
import { SubUI } from '../core/subUI';
import { Entity } from '../model/entity';
import { HeatmapAdapter } from './heatmapAdapter';

export namespace HeatmapUI {
  /**
   * id 不为空时才展示。
   * name：日期上的文字
   */
  export interface Data extends Entity.Label {
    weekdays: string[];
    /**
     * 可以下一月。
     */
    nextable: boolean;

    /**
     * 可以上一月。
     */
    prevable: boolean;

    /**
     * 格子
     * id：当为空时，表示空白。其他则为 Date.getTime() 转string
     * name: 日期。
     * desc: 小字。
     * style: done/partial/pending/none 分别表示四种状态。
     */
    items: Entity.Label[];

    /**
     * 图例说明，字段意义同上。
     */
    legends: Entity.Label[];
  }

  export interface WrapData {
    heatmap: Data;
  }
}

export class HeatmapUI extends SubUI<HeatmapUI.Data> {
  protected adapter?: HeatmapAdapter;

  public async show(adapter: HeatmapAdapter, onDateTap?: (id: string) => void) {
    this.adapter = adapter;
    const res = await this.load();
    if (res !== 0) {
      this.showErrToast(res);
      return;
    }
    this.setData({ heatmap: this.adapter?.adapt() });
  }

  public hide() {
    this.adapter = undefined;
    this.setData({ heatmap: { id: '', name: '' } });
  }

  protected async load(millis?: number): Promise<number> {
    if (!this.adapter) return Err.Code.Unknown;
    this.showLoading();
    const res = await this.adapter.load(millis);
    this.hideLoading();
    return res;
  }
}

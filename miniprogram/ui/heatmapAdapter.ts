import { HeatmapUI } from './heatmapUI';

export abstract class HeatmapAdapter {
  // 按月加载数据.
  // 当点击下一月、上一月时使用。
  // 初始化时？
  public abstract load(date?: number): Promise<number>;

  public abstract adapt(): HeatmapUI.Data;
}

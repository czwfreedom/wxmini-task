import { HeatmapAdapter } from '../heatmapAdapter';
import { HeatmapUI } from '../heatmapUI';

export class RoutineHeatAdapter extends HeatmapAdapter {
  /**
   * 通过接口 Routine.list({ startDate, endDate, userId, brief }) 拉到数据。
   */
  public load(date?: number): Promise<number> {
    throw new Error('Method not implemented.');
  }
  public adapt(): HeatmapUI.Data {
    throw new Error('Method not implemented.');
  }
}

export namespace RoutineHeatAdapter {}

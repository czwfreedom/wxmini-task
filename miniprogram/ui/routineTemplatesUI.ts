import { SubUI } from '../core/subUI';
import { Entity } from '../model/entity';

export namespace RoutineTemplatesUI {
  export interface Data extends SubUI.Data {
    name: string; // 上面的标题，选个日程模板
  }

  // name 模板名字
  // desc 模板详情
  export interface Template extends Entity.Info {
    // name: 阅读 30'
    // 颜色
    items: { name: string; color: string };

    // 其他字段暂时忽略，都暂时不展示
  }
}

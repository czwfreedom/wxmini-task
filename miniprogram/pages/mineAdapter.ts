import { Context } from '../core/context';
import { MineUI } from './mineUI';

/**
 * 「我的」页面 Adapter。
 * 目前数据来源于本地 Context（用户信息）和存储，后续由后端接口提供。
 */
export class MineAdapter {
  /** 加载并转换为 ViewModel */
  adapt(): Partial<MineUI.Data> {
    const user = Context.getUser();
    return {
      loaded: true,
      avatarText: user?.nickname?.charAt(0) || '我',
      nickname: user?.nickname || '未设置昵称',
      totalTasks: 0,
      totalDone: 0,
      streakDays: 0,
      partnerCount: 0,
    };
  }
}

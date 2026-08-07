/**
 * 「我的」页面 Adapter。
 * 目前数据来源于本地 Context（用户信息）和存储，后续由后端接口提供。
 */
import { Err } from '../constant/error';
import { Context } from '../core/context';
import { Entity } from '../model/entity';
import { MineUI } from './mineUI';

export class MineAdapter {
  /** 加载用户信息与统计数据，返回错误码 */
  public async load(): Promise<number> {
    // TODO: 后续对接后端接口
    return Err.Code.OK;
  }

  /** 将数据转换为 ViewModel */
  public adapt(): Pick<MineUI.Data, 'info' | 'stats' | 'cards'> {
    return {
      info: this.buildInfo(),
      stats: this.buildStats(),
      cards: this.buildCards(),
    };
  }

  // ===== 私有方法 =====

  private buildInfo(): Entity.Image {
    const user = Context.getUser();
    const name = user.name || '未设置';
    return {
      id: 'me',
      name: name,
      letterIndex: name.charAt(0),
      avatarStyle: 'gold',
    };
  }

  private buildStats(): Entity.Label[] {
    return [
      { id: 'total', name: '12', hint: '累计任务' },
      { id: 'done', name: '8', hint: '累计完成' },
      { id: 'streak', name: '3', hint: '连续天数' },
    ];
  }

  private buildCards(): Entity.Image[] {
    return [
      {
        id: 'following',
        name: '我可查看的伙伴',
        desc: '围观他们的任务，一起加油',
        hint: '2',
        avatarStyle: 'blue',
      },
      {
        id: 'followers',
        name: '可查看我的伙伴',
        desc: '他们也在一起见证你的坚持',
        hint: '3',
        avatarStyle: 'gold',
      },
    ];
  }
}

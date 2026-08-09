import { Err } from '../constant/error';
import { Context } from '../core/context';
import { Relation } from '../server/relation';
import { RelationsUI } from './relationsUI';

export class RelationsAdapter {
  private direction = '';
  private users: Relation.User[] = [];

  public constructor(direction: string) {
    this.direction = direction;
  }

  public async load(): Promise<number> {
    const userId = Context.getUserId();
    const params = this.direction === 'usee' ? { userId } : { useeId: userId };

    const result = await Relation.list(params);
    if ('number' === typeof result) return result;
    this.users = result.users ?? [];
    return Err.Code.OK;
  }

  public adapt(): Pick<RelationsUI.Data, 'items'> {
    return {
      items: this.users.map((u) => ({
        id: u.id,
        name: u.nickname || u.name || '',
        letterIndex: (u.nickname || u.name || '?')[0],
        desc: `今日任务 ${u.routine?.count || 0} 个`,
        avatarStyle: this.randomColor(u.id),
      })),
    };
  }

  private randomColor(seed?: string): string {
    const colors = ['c1', 'c2', 'c3', 'c4'];
    if (!seed) return colors[0];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }
}

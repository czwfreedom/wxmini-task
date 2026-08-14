import { Err } from '../constant/error';
import { Context } from '../core/context';
import { Entity } from '../model/entity';
import { Relation } from '../server/relation';
import { RelationsUI } from './relationsUI';

export class RelationsAdapter {
  private direction = '';
  private users: Relation.User[] = [];
  private relations: Relation.Info[] = [];

  public constructor(direction: string) {
    this.direction = direction;
  }

  protected findRelation(id: string): Relation.Info | undefined {
    const dir = this.canManage();
    return this.relations?.find((o) => (dir ? o.useeId === id : o.userId === id));
  }

  public async load(): Promise<number> {
    const userId = Context.getUserId();
    const params = this.canManage() ? { userId, withStat: true } : { useeId: userId };

    const result = await Relation.list(params);
    if ('number' === typeof result) return result;
    this.users = result.users ?? [];
    this.relations = result.data ?? [];
    return Err.Code.OK;
  }

  public adapt(): Pick<RelationsUI.Data, 'items'> {
    const m = this.canManage();
    return {
      items: this.users.map((u) => ({
        id: u.id,
        name: u.nickname || u.name || '',
        letterIndex: (u.nickname || u.name || '?')[0],
        desc: m ? `今日任务 ${u.routine?.count || 0} 个` : '',
        avatarStyle: this.randomColor(u.id),
      })),
    };
  }

  public async delete(id: string): Promise<number> {
    const info = this.findRelation(id);
    if (!info) return Err.Code.Unknown;

    const res = await Relation.update({ id: info.id, deleted: 1 });
    if (res === 0) {
      const user = Entity.find(this.users, id);
      if (user?.index >= 0) this.users.splice(user.index, 1);
      const relation = Entity.find(this.relations, info.id);
      if (relation?.index >= 0) this.relations.splice(relation.index, 1);
    }
    return res;
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

  protected canManage() {
    return this.direction === 'usee';
  }
}

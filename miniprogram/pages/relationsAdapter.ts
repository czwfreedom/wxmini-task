import { Err } from '../constant/error';
import { Context } from '../core/context';
import { Entity } from '../model/entity';
import { Relation } from '../server/relation';
import { AvatarUtils } from '../utils/avatarUtils';
import { RelationsUI } from './relationsUI';

export class RelationsAdapter {
  private direction = '';
  private users: Relation.User[] = [];
  private relations: Relation.Info[] = [];

  public constructor(direction: string) {
    this.direction = direction;
  }

  public canManage() {
    return this.direction === 'usee';
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

    // 只排序一次，免得操作之后乱序。
    if (this.users?.length > 1) {
      const m = this.canManage();
      this.users.sort((o1, o2) => {
        if (m) {
          const r1 = this.findRelation(o1.id);
          const r2 = this.findRelation(o2.id);
          if (r1?.star !== r2?.star) return r1?.star ? -1 : 1;
        }
        return o1.name.localeCompare(o2.name);
      });
    }

    return Err.Code.OK;
  }

  public adapt(): Pick<RelationsUI.Data, 'items'> {
    const m = this.canManage();
    const result: Entity.Image[] = [];
    for (const u of this.users) {
      const relation = this.findRelation(u.id);
      result.push({
        id: u.id,
        name: u.nickname || u.name || '',
        letterIndex: (u.nickname || u.name || '?')[0],
        desc: m ? `今日任务 ${u.routine?.count || 0} 个` : '',
        avatarStyle: AvatarUtils.randomColor(u.id),
        selected: m && !!relation?.star,
      });
    }
    return { items: result };
  }

  public async toggleStar(id: string): Promise<number> {
    const relation = this.findRelation(id);
    if (!relation) return Err.Code.Unknown;

    const star = relation?.star ? 0 : 1;
    const res = await Relation.update({ id: relation.id, star });
    if (res !== 0) return res;
    relation.star = star;
    return 0;
  }

  public async delete(id: string): Promise<number> {
    const info = this.findRelation(id);
    if (!info) return Err.Code.Unknown;

    const res = await Relation.update({ id: info.id, deleted: 1, star: 0 });
    if (res === 0) {
      const user = Entity.find(this.users, id);
      if (user?.index >= 0) this.users.splice(user.index, 1);
      const relation = Entity.find(this.relations, info.id);
      if (relation?.index >= 0) this.relations.splice(relation.index, 1);
    }
    return res;
  }
}

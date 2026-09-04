export namespace Entity {
  export interface Records {
    [key: string]: string;
  }

  export interface Id {
    id: string;
  }

  export interface Selectable {
    selected?: boolean;
  }

  export interface SelectableId extends Selectable, Id {}

  export interface Info extends Id {
    name: string;
    nickname?: string;
    deleted?: boolean | number; // 是否已删除。
  }

  export const enum Action {
    Create = 'create',
    Update = 'update',
    Delete = 'delete',
    Finish = 'finish',
  }

  /**
   * 因为这个可能用于 data，定义的函数可能无法通过setData/组件传递
   */
  export interface Record extends Entity.Id {
    // 可选是一个高频制作。
    selected?: boolean;
    // 有了分组之后，可以收起。
    invisible?: boolean;
    // 用于字母索引。没有定义成函数，怕传递过程中把函数失掉。
    letterIndex?: string;
  }

  export interface Label extends Record, Info {
    desc?: string; // 表示标题之下的灰色描述。
    hint?: string; // 表示箭头之前的文字。
    style?: string;
  }

  export interface Image extends Label {
    avatar?: string; // 带头像。
    avatarStyle?: string; // 头像的样式
  }

  export interface Hierarchy extends Image {
    items?: Hierarchy[];
  }

  export interface Option extends Image {}

  export function toMap<T extends Id>(items: T[], key?: string): Map<string, T> {
    const map = new Map();
    if (items?.length) {
      for (const item of items) {
        if (key) {
          const v: any = item;
          map.set(v[key], item);
        } else {
          map.set(item.id, item);
        }
      }
    }
    return map;
  }

  export function group<T extends Id>(
    items: T[],
    key?: string,
    isKeyArray?: boolean
  ): Map<string, T[]> {
    const map = new Map();
    if (items.length) {
      for (const item of items) {
        const k = key ? (item as any)[key] : item.id;
        if (isKeyArray) {
          for (const ak of k) {
            addToMap(map, item, ak);
          }
        } else {
          addToMap(map, item, k);
        }
      }
    }
    return map;
  }

  export function addToMap<T extends Object>(map: Map<string, T[]>, item: T, k: string) {
    const list = map.get(k);
    if (!list) {
      map.set(k, [item]);
    } else {
      list.push(item);
    }
  }

  export function find<T extends Id>(
    items?: T[],
    id?: string | number,
    key?: string
  ): { index: number; item: T | undefined } {
    if (items?.length && id !== undefined) {
      if (!key) key = 'id';
      if (id !== undefined && 'number' === typeof id) id = '' + id;
      for (let i = 0; i < items.length; i++) {
        const item: any = items[i];
        if (item[key] === id) {
          return { index: i, item: item };
        }
      }
    }
    return { index: -1, item: undefined };
  }

  /**
   * 不知道map的性能如何，先这样。
   * 后面应该尽使用 objectUtils中的 getDistinctIds
   */
  export function getIds<T extends Id>(items?: T[] | MapIterator<T>): string[] {
    if (!items) {
      return [];
    }
    const ids: string[] = [];
    for (const item of items) {
      ids.push(item.id);
    }
    return ids;
  }

  export function getSelectedIds<T extends SelectableId>(items: T[]): string[] {
    const ids: string[] = [];
    for (const item of items || []) {
      if (item.selected && !ids.includes(item.id)) {
        ids.push(item.id);
      }
    }
    return ids;
  }

  export function markSelected<T extends Entity.Label>(
    items: T[],
    selectedId: number | string
  ): T[] {
    const id = '' + selectedId;
    for (const item of items) {
      if (item.id === id) {
        item.selected = true;
      } else if (item.selected) item.selected = false;
    }
    return items;
  }
}

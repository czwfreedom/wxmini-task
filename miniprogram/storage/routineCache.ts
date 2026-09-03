import { Routine } from '../server/routine';
import { Storage } from './storage';

export namespace RoutineCache {
  export function save(category: number, detail: string) {
    const cache = loadCache();
    const item = cache.find((o) => o.category === category);
    if (item) {
      item.detail = detail;
    } else {
      cache.push({ category, detail });
    }
    saveCache(cache);
  }

  export function get(category: number): string | undefined {
    const cache = loadCache();
    const item = cache.find((o) => o.category === category);
    return item?.detail;
  }

  function loadCache(): Partial<Routine.Info>[] {
    return wx.getStorageSync(Storage.Key.Routine) || [];
  }

  function saveCache(items: Partial<Routine.Info>[]): void {
    wx.setStorageSync(Storage.Key.Routine, items || []);
  }
}

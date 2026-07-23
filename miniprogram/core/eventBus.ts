/**
 * 网上找到的一个EventBus的库，先用着...
 *
 * Hack: 支持一个事件多方监听。
 * Hack: 全重构。
 *
 * 原来同事引入的库没有反订阅接口，同一个页面多次进会错乱。
 */

import { Logger } from '../utils/logger';

type IFn = (params: any) => unknown; // 不关注返回值。

type EventListener = {
  listenerId: string; // 监听者的唯一ID，on/off时必须匹配。
  fn: IFn;
};

/**
 *  EventBus 事件总线
 */
export class EventBus {
  private static instance: EventBus | undefined = undefined; // 唯一实例

  private listeners: Map<string, EventListener[]> = new Map();
  private max = 50; // 最大任务数
  private counts = 0; // 当前任务数

  /**
   *  获取唯一实例
   * @returns {EventBus}
   */
  private static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public static on(listenerId: string, ev: string, fn: IFn): boolean {
    return EventBus.getInstance().on(listenerId, ev, fn);
  }

  public static multiOn(listenerId: string, events: string[], fn: IFn): boolean {
    for (let ev of events) {
      let res = EventBus.on(listenerId, ev, fn);
      if (!res) {
        return res;
      }
    }
    return true;
  }

  public static off(listenerId: string, ev: string): boolean {
    return EventBus.getInstance().off(listenerId, ev);
  }

  public static multiOff(listenerId: string, events: string[]): void {
    for (let ev of events) {
      EventBus.off(listenerId, ev);
    }
  }

  public static emit(ev: string, params?: any) {
    EventBus.getInstance().emit(ev, params);
  }

  public static removeAll() {
    EventBus.getInstance().removeAll();
  }

  /**
   *  监听任务
   * @param listenerId 监听者唯一ID，用于off匹配。
   * @param ev
   * @param fn
   * @returns {EventBus} 当前实例
   */
  private on(listenerId: string, ev: string, fn: IFn): boolean {
    if (this.counts > this.max) {
      Logger.warn('Too many events.', this.counts);
    }

    let listeners = this.listeners.get(ev);
    if (!listeners) {
      listeners = [];
      this.listeners.set(ev, listeners);
    } else {
      for (let listener of listeners) {
        if (listener.listenerId === listenerId) {
          Logger.warn('Weird, duplicated listener.', listenerId, ev);
          return false;
        }
      }
    }
    listeners.push({ listenerId: listenerId, fn: fn });
    this.counts += 1;
    return true;
  }

  /**
   *  卸载任务
   * @param {string} ev
   * @returns {EventBus} 当前实例
   */
  private off(listenerId: string, ev: string): boolean {
    let listeners = this.listeners.get(ev);
    if (!listeners || listeners.length <= 0) {
      Logger.warn('Weird, no listener off.', listenerId, ev);
      return false;
    }

    for (let i = 0; i < listeners.length; i++) {
      if (listeners[i].listenerId === listenerId) {
        listeners.splice(i, 1);
        if (listeners.length <= 0) {
          this.listeners.delete(ev);
        }
        this.counts--;
        return true;
      }
    }

    Logger.warn('Weird, no listener off.', listenerId, ev);
    return false;
  }

  /**
   *  触发任务
   * @param {string} ev
   * @param {NormalObject} res
   */
  private emit(ev: string, params: any): void {
    let listeners = this.listeners.get(ev);
    if (!listeners || listeners.length <= 0) {
      Logger.info('No listener for event.', ev);
      return;
    }

    for (let listener of listeners) {
      if (typeof listener.fn !== 'function') {
        Logger.warn(`Event ${ev} is not a function`);
        continue;
      }

      listener.fn(params);
    }
  }

  /**
   *  卸载所有任务
   * @returns {EventBus} 当前实例
   */
  private removeAll(): EventBus {
    this.listeners.clear();
    return this;
  }
}

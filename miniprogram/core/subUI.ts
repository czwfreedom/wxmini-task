import { Err } from '../constant/error';
import { Locale } from '../constant/locale';
import { Logger } from '../utils/logger';
import { WxUtils } from '../utils/wxUtils';
import { EventBus } from './eventBus';
import { Intent } from './intent';

/**
 * 如果把所有的逻辑都放Page里，会很复杂。
 * 但小程序的机制决定了，事件处理函数必须挂 Page 下。
 * 按照之前的命名习惯，通常用 component 表示 Page 上下文的引用。
 *
 * 要支持Tab，同一个页面可能存在多个类似的数据subData，每一组数据都是 data 下的一个成员 x。
 * 这个 x 称之为 subDataKey。在{@link setData}会在设置的数据前面加上前缀。
 * 但这样一来，常规data下的数据就无法设置了。
 * 故约定：带 _ 开头的，是为根节点中的数据，不需要加前缀。
 *
 * 但这种方法的问题在于，事件不是隔离的。用自定义组件可以解决这个问题。
 */
export namespace SubUI {
  /**
   * 加载状态太常见了。
   */
  export interface Data {
    loaded: boolean;
    abortMessage: string;
  }
}

export abstract class SubUI<D> {
  private static sequeue = 1000;

  protected captureDisabled = false;
  protected component: any;
  protected paused = false;
  // 从这个可以找到唯一的宿主。
  protected hostId = '';
  protected instanceId = '';
  protected subDataKey: string = '';
  protected subDataKeys?: string[];

  // TODO 目前大多数的操作都是单向的，但有时也需要传出去。
  protected onEvent?: (ev: string, data: any) => void;

  // 若有变化，在退出时需要调用生成变化之后的result。
  protected changed = false;
  protected intent?: Intent.Base;

  // EventBus
  private registeredEvents?: string[];

  // 绑定的 wxml 事件。
  private bindEvents: string[] = [];

  public constructor(component: any, subDataKey = '') {
    this.component = component;
    this.subDataKey = subDataKey;
    this.instanceId = 'sub' + SubUI.getSequeue();
    if (subDataKey?.length && subDataKey.indexOf('.') > 0) {
      this.subDataKeys = subDataKey.split('.');
    }
  }

  // 把注册的事件注销，免得内存泄露。
  public release() {
    if (this.captureDisabled) {
      this.captureDisabled = false;
      WxUtils.enableScreenCapture(true);
    }
    if (this.registeredEvents?.length) {
      EventBus.multiOff(this.instanceId, this.registeredEvents);
    }
    this.unbindEvents();
  }

  public onShow(data?: any) {
    this.paused = false;
  }

  public onHide(data?: any) {
    this.paused = true;
  }

  /**
   * 让每个subUI都有一个唯一的编号
   */
  private static getSequeue(): number {
    return this.sequeue++;
  }

  protected disableCapture() {
    if (this.captureDisabled) {
      return;
    }
    this.captureDisabled = true;
    WxUtils.enableScreenCapture(false);
  }

  // 不是所有的都需要，且因为历史原因，没有放在构造器里。
  public setIntent(intent: Intent.Base) {
    this.intent = intent;
  }

  public setHostId(hostId: string) {
    this.hostId = hostId;
  }

  public setEventListener(fn: (ev: string, data: any) => void) {
    this.onEvent = fn;
  }

  public getIntent<T extends Intent.Base>(): T | undefined {
    return this.intent ? (this.intent as T) : undefined;
  }

  public setData(data: any, callback?: () => void) {
    let dataCount = 0;
    let newData: any = {};
    Object.keys(data).forEach((k) => {
      // 约定 _ 开头是为根，不需要加前缀。
      if (k.startsWith('_')) {
        newData[`${k.substring(1)}`] = data[k];
      } else {
        if (this.subDataKey) {
          newData[`${this.subDataKey}.${k}`] = data[k];
        } else {
          newData[k] = data[k];
        }
      }
      dataCount++;
    });
    if (dataCount > 0) {
      this.component.setData(newData, callback);
    } else if (callback) {
      this.component.setData(newData, callback);
    }
  }

  public getData(): D {
    if (!this.subDataKey) {
      return this.component.data;
    } else {
      if (this.subDataKeys?.length) {
        let d = this.component.data;
        for (const k of this.subDataKeys) {
          d = d[k];
        }
        return d;
      } else {
        return this.component.data[this.subDataKey];
      }
    }
  }

  /**
   * 绑定事件到Page或者组件。
   */
  protected bindEvent(event: string, fn: (e: WechatMiniprogram.TouchEvent) => void) {
    if (!this.component[event]) {
      this.bindEvents.push(event);
      this.component[event] = (e: WechatMiniprogram.TouchEvent) => {
        fn.call(this, e);
      };
    }
  }

  protected unbindEvent(event: string) {
    this.component[event] = undefined;
    const index = this.bindEvents.indexOf(event);
    if (index >= 0) {
      this.bindEvents.splice(index, 1);
    }
  }

  protected unbindEvents() {
    // 解绑 wxml 事件。
    if (this.bindEvents?.length) {
      for (const event of this.bindEvents) {
        this.component[event] = undefined;
      }
      this.bindEvents = [];
    }
  }

  protected registerEventBus(ev: string, fn: (params: any) => unknown) {
    if (!this.registeredEvents) {
      this.registeredEvents = [];
    }
    if (this.registeredEvents.indexOf(ev) >= 0) {
      Logger.error('Duplicated event.', ev);
      return;
    }
    this.registeredEvents.push(ev);
    EventBus.on(this.instanceId, ev, fn);
  }

  protected postEvent(ev: string, data?: any) {
    EventBus.emit(ev, data);
  }

  // 一些适配微信setData的快捷方式。少写些代码吧。
  protected setKvData(key: string, v: any) {
    this.setData(this.buildNewData(key, v));
  }

  protected setKvDatas(...args: any[]) {
    if (args?.length && args.length % 2 === 0) {
      this.setData(this.buildNewDatas(...args));
    }
  }

  protected buildNewData(key: string, v: any): any {
    let newData: any = {};
    newData[key] = v;
    return newData;
  }

  protected buildNewDatas(...args: any[]): any {
    let newData: any = {};
    for (let i = 0; i < args.length; i += 2) {
      newData[args[i]] = args[i + 1];
    }
    return newData;
  }

  protected showLoading(title: string = Locale.String.processing) {
    wx.showLoading({ title: title, mask: true });
  }

  protected hideLoading() {
    wx.hideLoading();
  }

  protected showToast(message: string) {
    WxUtils.showToast(message);
  }

  protected showErrToast(errcode: number) {
    WxUtils.showErrToast(errcode);
  }

  protected abort(errcode: number): number {
    this.setData({ abortMessage: Err.getMessage(errcode) });
    return errcode;
  }

  protected abortWith(message: string) {
    this.setData({ abortMessage: message });
  }

  /**
   * https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.showModal.html
   */
  protected async showModal(
    title: string,
    content: string,
    cancelText = '取消',
    confirmText = '确定',
    withReject = false // 本来只想让调用者多数情况下只关注 then，但发现使用try/catch抓不住异常。
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      wx.showModal({
        title: title,
        content: content,
        cancelText: cancelText,
        confirmText: confirmText,
        cancelColor: '#1d2129',
        confirmColor: '#f53f3f',
        success: (res) => {
          if (res?.confirm) {
            resolve();
          } else if (withReject) {
            // 实际上抓不住，所以只能又引入一个参数。
            try {
              reject();
            } catch (err) {}
          }
        },
      });
    });
  }
}

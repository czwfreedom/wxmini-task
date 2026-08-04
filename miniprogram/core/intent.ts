import { WxUtils } from '../utils/wxUtils';

/**
 * 模仿App，在页面间跳转地时候，通过全局数据传参。
 * 这样可以减少对全局数据的污染。
 *
 * 只是一种实践方式。但写死的形式不够灵活，纯用可变字段又丢失类型的优点。
 * 先把一些最常用的展示出来吧。
 *
 * 每个Intent虽然有自己自己独特的code，用于给调用者返回结果。
 * TODO 实践上，intent用type更好？可以使用组合。
 */
export namespace Intent {
  /**
   * 2023-02-27新版本引入：
   * 学校Android，给每个intent一个唯一值，这样调用返回之后，能有区别出哪些是自己的事件。
   */
  export interface Base {
    code: string;
  }

  export interface Wrap<T> {
    type: string;
    data: T;
  }

  export function navigateTo(target: string, params?: any) {
    !!params && put(params);
    wx.navigateTo({ url: target });
  }

  export function redirectTo(target: string, params?: any): void {
    !!params && put(params);
    wx.redirectTo({ url: target });
  }

  export function navigateBack(params?: any) {
    const res = getCurrentPages();
    if (res.length <= 1) {
      wx.exitMiniProgram();
    } else {
      !!params && put(params);
      wx.navigateBack();
    }
  }

  export function delayBack(params?: any, delay = 800) {
    setTimeout(() => {
      navigateBack(params);
    }, delay);
  }

  export function open(target: string, params?: any) {
    const pages = getCurrentPages();
    while (pages?.length > 1 && WxUtils.pageExists(target, pages)) {
      navigateBack(); // 退出上层的页面。
      pages.splice(pages.length - 1, 1);
    }

    if (WxUtils.pageExists(target, pages)) {
      redirectTo(target, params);
    } else {
      navigateTo(target, params);
    }
  }

  export function put(params: any) {
    const app = getApp();
    app.intent = params;
  }

  // 取出来之后，将App的清空？免得有不可预期的内存泄露。
  export function get<T>(): T {
    const app = getApp();
    let intent = app.intent;
    app.intent = null;
    return intent || {}; // 需要返回默认值吗？
  }
}

import { Constants } from './constant/common';
import { Context } from './core/context';
import { Login } from './core/login';
import { Logger } from './utils/logger';
import { WxUtils } from './utils/wxUtils';

// app.ts
App<Global.App>({
  systemInfo: {} as WechatMiniprogram.SystemInfo,
  accountInfo: {} as WechatMiniprogram.AccountInfo,
  intent: {}, // 尝试用于页面间传递数据。
  context: {} as Context.Info,
  onLogin: undefined,

  onLaunch() {
    this.systemInfo = wx.getSystemInfoSync();
    this.accountInfo = wx.getAccountInfoSync();

    Logger.warn('Starting the world...', Constants.sConfig.version);
    this.login();
  },

  onError: function (err: any) {
    Logger.warn('App error.', err);
  },

  onUnhandledRejection: function (err: any) {
    Logger.warn('App error unhandled rejection.', err);
  },

  async login() {
    const user = await Login.login();
    if ('number' === typeof user) {
      WxUtils.showToast('登录失败');
      return;
    }
    this.context.user = user;
    if (this.onLogin) {
      const v = this.onLogin;
      this.onLogin = undefined;
      v();
    }
  },

  async logout() {
    const pages = getCurrentPages();
    const page = pages[pages.length - 1];
    Login.clear();

    await this.login();
    Logger.warn('Force logout.');
    wx.reLaunch({ url: `/${page.route}` });
  },
});

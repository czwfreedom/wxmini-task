import { Constants } from './constant/common';
import { Context } from './core/context';
import { Login } from './core/login';
import { Logger } from './utils/logger';
import { WxUtils } from './utils/wxUtils';

// app.ts
App<Global.App | any>({
  systemInfo: {} as WechatMiniprogram.SystemInfo,
  accountInfo: {} as WechatMiniprogram.AccountInfo,
  intent: {}, // 尝试用于页面间传递数据。
  context: {} as Context.Info,
  onLogin: undefined,

  onLaunch() {
    this.systemInfo = wx.getSystemInfoSync();
    this.accountInfo = wx.getAccountInfoSync();

    Logger.warn('Starting the world...', Constants.sConfig.version);

    if (
      this.systemInfo.platform !== 'devtools' &&
      this.accountInfo.miniProgram.envVersion === 'develop'
    ) {
      wx.setEnableDebug({ enableDebug: false });
    }
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
    this.checkUpdate();
  },

  async logout() {
    const pages = getCurrentPages();
    const page = pages[pages.length - 1];
    Login.clear();

    await this.login();
    Logger.warn('Force logout.');
    wx.reLaunch({ url: `/${page.route}` });
  },

  // 检查更新
  checkUpdate() {
    const manager = wx.getUpdateManager();
    manager.onCheckForUpdate((res) => {
      // 请求完新版本信息的回调
      Logger.info('Check update', res);
    });
    // 更新准备处理
    manager.onUpdateReady(async function () {
      try {
        WxUtils.alert({
          title: '更新提示',
          content: '检测到有新版本，请更新并使用',
          showCancel: false,
        }).then(() => {
          manager.applyUpdate();
        });
      } catch (err) {
        Logger.warn('Update failed.', err);
      }
    });
    // 更新失败回调处理
    manager.onUpdateFailed(() => {
      wx.showModal({
        title: '更新提示',
        content:
          '新版本下载失败，可能会影响功能的使用，可手动前往 发现->小程序 找到并删除“稚子日程”后重新打开小程序进行更新。',
        showCancel: false,
      });
    });
  },
});

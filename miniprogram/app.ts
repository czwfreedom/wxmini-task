import { Constants } from './constant/common';
import { Context } from './core/context';
import { Login } from './core/login';
import { Logger } from './utils/logger';

// app.ts
App<Global.App>({
  systemInfo: {} as WechatMiniprogram.SystemInfo,
  accountInfo: {} as WechatMiniprogram.AccountInfo,
  intent: {}, // 尝试用于页面间传递数据。
  context: {} as Context.Info,
  onLaunch() {
    this.systemInfo = wx.getSystemInfoSync();
    this.accountInfo = wx.getAccountInfoSync();

    Logger.warn('Starting the world...', Constants.sConfig.version);
    Login.login().then((user) => {});
  },
});

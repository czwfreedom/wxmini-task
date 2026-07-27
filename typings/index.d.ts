// 小程序页面通用类型

declare namespace Global {
  interface App {
    systemInfo: WechatMiniprogram.SystemInfo;
    accountInfo: WechatMiniprogram.AccountInfo;
    intent: any;
    context: any;
  }

  interface Config {
    version: string;
    apiHost: string;
  }
}

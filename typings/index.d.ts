// 小程序页面通用类型

declare namespace Global {
  interface App {
    systemInfo: WechatMiniprogram.SystemInfo;
    accountInfo: WechatMiniprogram.AccountInfo;
    intent: any;
    context: any;
    logout: () => void;
    login: () => void;
    onLogin?: () => void;
  }

  interface Config {
    version: string;
    apiHost: string;
  }
}

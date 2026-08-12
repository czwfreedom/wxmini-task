export namespace Err {
  /**
   * 为了方便远程找问题，每一个错误都要有对应的错误码。
   */
  export const enum Code {
    // 微信内部的错误。
    Timeout = -3,
    Network = -2,
    OK = 0,

    InvalidToken = 10001,
    InvalidParam = 10002,
    NoPermission = 10003,
    DuplicateOperate = 10004,
    WxAPIFailed = 10005,
    OverLimited = 10006,
    WXLoginFailed = 30001,
    ServerFailed = 40001,
    Unknown = 50000,
  }

  const sMessages: Record<number, string> = {
    [Code.OK]: '成功',
    [Code.Network]: '当前网络状态不稳定，请检查网络后重试！',
    [Code.Timeout]: '请求已超时，请重试！',

    [Code.InvalidToken]: '登陆信息已失效，请重新登陆',
    [Code.InvalidParam]: '当前请求参数错误，请重试！',
    [Code.NoPermission]: '无权限',
    [Code.DuplicateOperate]: '重复操作',
    [Code.OverLimited]: '超出限制',

    [Code.WXLoginFailed]: '微信登录失败',
    [Code.ServerFailed]: '服务器异常',
  };

  export function getMessage(errno: Code) {
    let message = sMessages[errno];
    if (!message) {
      message = '小程序又傲娇了..';
    }
    return `${message}`;
  }
}

export namespace Err {
  /**
   * 为了方便远程找问题，每一个错误都要有对应的错误码。
   */
  export const enum Code {
    // 微信内部的错误。
    Timeout = -3,
    Network = -2,
    OK = 0,
  }

  const sMessages: Record<number, string> = {
    [Code.OK]: '成功',
    [Code.Network]: '当前网络状态不稳定，请检查网络后重试！',
    [Code.Timeout]: '请求已超时，请重试！',
  };

  export function getMessage(errno: Code) {
    let message = sMessages[errno];
    if (!message) {
      message = '小程序又傲娇了..';
    }
    return `${message}`;
  }
}

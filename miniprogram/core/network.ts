import { Constants } from '../constant/common';
import { Err } from '../constant/error';
import { Context } from '../core/context';
import { Logger } from '../utils/logger';
import { WxUtils } from '../utils/wxUtils';

/**
 * 封装 wx.request.
 */
export namespace Network {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export interface BaseResponse<T = Record<string, any>> {
    errcode?: number;
    errmsg?: string;
    data?: T;
    [otherProps: string]: any;
  }

  export async function post<T = Record<string, any>>(
    url: string,
    data: any = undefined,
    errorToast = false
  ): Promise<BaseResponse<T>> {
    return new Promise((resolve) => {
      const option = buildPostRequest(url, data);
      // 这个接口有是会打特别多日志，所以排除。不想序列化降低性能，只用用这种土办法。
      Logger.info('Requesting', option.url, option.data);

      option.success = (res) => {
        if (res.statusCode !== 200 || !res.data) {
          Logger.info('Request result.', url, res.statusCode, res.errMsg);
          WxUtils.showToast(Err.getMessage(Err.Code.Network));
          resolve({ errcode: Err.Code.Network });
        } else {
          const data = res.data as BaseResponse<T>;
          // 如果错误，则打出错误日志。
          if (data.errcode !== Err.Code.OK) {
            Logger.warn('Request result.', url, res.statusCode, data.errcode, data.errmsg);
            if (errorToast) WxUtils.showToast(Err.getMessage(data.errcode || Err.Code.Network));
          }

          // 如果是token错误，则强制重登录。
          if (data.errcode === Err.Code.InvalidToken) {
            getApp().forceLogout();
          }
          resolve(data);
        }
      };
      option.fail = (err) => {
        Logger.warn('Request failed.', err);
        const errcode =
          err.errMsg.replace(/\s+/g, '') === 'request:failtimeout'
            ? Err.Code.Timeout
            : Err.Code.Network;
        WxUtils.showToast(Err.getMessage(errcode));
        resolve({ errcode });
      };
      wx.request(option);
    });
  }

  function getBaseUrl(): string {
    return Constants.sConfig.apiHost;
  }

  function buildPostRequest(url: string, data: any = undefined): WechatMiniprogram.RequestOption {
    if (url.startsWith('http')) {
      return {
        url,
        data,
        method: 'POST',
        header: {
          'content-type': 'application/json',
        },
      };
    }

    const user = Context.getUser();
    const header: Record<string, string | number> = {
      'content-type': 'application/json',
      'user-ctype': 3,
    };
    if (user?.id && user?.token) {
      header['user-id'] = user.id;
      header['user-token'] = user.token;
    }

    return {
      url: getBaseUrl() + url,
      data,
      method: 'POST',
      header,
    };
  }
}

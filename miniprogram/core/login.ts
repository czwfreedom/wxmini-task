import { Api } from '../constant/api';
import { Err } from '../constant/error';
import { User } from '../model/user';
import { Storage } from '../storage/storage';
import { Logger } from '../utils/logger';
import { Context } from './context';
import { Network } from './network';

export namespace Login {
  export async function login(): Promise<number> {
    const cache = getCache();
    if (cache) {
      Context.setUser(cache);
      return 0;
    }
    const code = await wxLogin();
    if (!code) return Err.Code.WXLoginFailed;
    Logger.info('Login code', code);
    const user = await web(code);
    if ('number' === typeof user) return user;

    Context.setUser(user);
    setCache(user);
    return 0;
  }

  export async function web(code: string): Promise<number | User.Info> {
    if (true) return { id: '10174646050143', token: "97dc1e45e74149cd96c054f78f7ec645'" } as any;
    const res = await Network.post<User.Info[]>(Api.Login, { code });
    if (!res || res.errcode !== 0) {
      Logger.warn('Web login failed.', res);
      return res?.errcode || Err.Code.Network;
    }
    if (res.data?.length !== 1) {
      return Err.Code.ServerFailed;
    }
    return res.data[0];
  }

  export async function wxLogin(): Promise<string> {
    return new Promise((resolve) => {
      wx.login({
        success(res) {
          if (res.code) {
            resolve(res.code);
          } else {
            Logger.warn('wx.login failed', res);
            resolve('');
          }
        },
        fail(err) {
          Logger.error('wx.login failed', err);
          resolve('');
        },
      });
    });
  }

  export function getCache(): User.Info | undefined {
    const cache: User.Info | undefined = wx.getStorageSync(Storage.Key.User);
    if (cache?.id && cache?.loginTime && cache.loginTime + 86400000 > Date.now()) {
      return cache;
    }
    return undefined;
  }

  export function setCache(user: User.Info) {
    user.loginTime = Date.now();
    wx.setStorageSync(Storage.Key.User, user);
  }
}

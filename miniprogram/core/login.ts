import { Err } from '../constant/error';
import { User } from '../server/user';
import { Storage } from '../storage/storage';
import { Logger } from '../utils/logger';

export namespace Login {
  export async function login(): Promise<number | User.Info> {
    const cache = getCache();
    if (cache) return cache;
    const code = await wxLogin();
    if (!code) return Err.Code.WXLoginFailed;
    Logger.info('Login code', code);
    const user = await User.login(code);
    if ('number' === typeof user) return user;
    setCache(user);
    return user;
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

  export function clear() {
    wx.removeStorageSync(Storage.Key.User);
  }
}

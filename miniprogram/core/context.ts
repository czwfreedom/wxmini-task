import { User } from '../server/user';

export namespace Context {
  export interface Info {
    user: User.Info;
  }

  export function get(): Info {
    return getApp().context;
  }

  export function setUser(v: User.Info) {
    get().user = v;
  }

  export function getUser(): User.Info {
    return get()?.user;
  }

  export function getUserId(): string {
    return getUser()?.id;
  }

  export function isNamed(): boolean {
    const user = getUser();
    return !!user?.name && user.name !== '微信用户';
  }

  export function isLogined(): boolean {
    return !!getUserId();
  }

  /**
   * 文档说，app.ts的onLaunch()和第一个页面的 onLoad()有可能是同时进行的，
   * 而登录是放在app.ts里的，所以第一个页面初始化时，还没有登录成功。
   * 而所有多数逻辑都需要登录之后才能正常运行，所以在app上加一个回调，在登录成功之后调用。
   */
  export function bindLogin(fn: () => void) {
    if (Context.isLogined()) {
      fn();
    } else {
      const app = getApp();
      app.onLogin = () => {
        fn();
      };
    }
  }
}

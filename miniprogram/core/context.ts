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

  export function isLogined(): boolean {
    return !!getUserId();
  }
}

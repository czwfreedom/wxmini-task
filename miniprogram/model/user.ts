import { Entity } from './entity';

export namespace User {
  export interface Info extends Entity.Info {
    token: string;
    loginTime?: number;
  }
}

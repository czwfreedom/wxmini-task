export namespace Constants {
  export const sConfig: Global.Config = { version: '0.1.3', apiHost: 'https://api.haoletech.com' };

  export const enum Page {
    Routine = '/pages/routine',
    Mine = '/pages/mine',
    CreateRoutine = '/pages/routineEditor',
    Relations = '/pages/relations',
  }

  // 为了让url短一些，有一些缩写。
  export const enum Param {
    Event = 'e',
    UserId = 'uid',
    Nonce = 'n',
  }

  export const enum Share {
    Def = 'share',
  }
}

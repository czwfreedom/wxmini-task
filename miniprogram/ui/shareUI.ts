import { Context } from '../core/context';
import { Utils } from '../utils/utils';

export namespace ShareUI {
  // 论坛说：直接调用API不能带 / 开头
  export function path(normal = true): string {
    return (
      (normal ? '/' : '') + `pages/index?e=share&uid=${Context.getUserId()}&n=${Utils.shortUuid()}`
    );
  }

  // https://developers.weixin.qq.com/miniprogram/dev/api/chattool/wx.shareAppMessageToGroup.html
  export function share(title?: string, imageUrl?: string, path?: string) {
    return {
      title: title || '来看看我在做什么吧！',
      path: path || ShareUI.path(),
      imageUrl: imageUrl || '../assets/imgs/share-task.png',
    };
  }
}

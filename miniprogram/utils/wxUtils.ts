import { Err } from '../constant/error';
import { Logger } from './logger';

/**
 * 一些通用的函数。
 *
 * 注意，globalUtils下还有一个util.ts
 */
export namespace WxUtils {
  /**
   * 因为代码自动格式化，也许这种封装，可以把代码从4行变为一行。
   */
  export function showToast(title: string) {
    wx.showToast({ title: title, icon: 'none', duration: 3000 });
  }
  // 封装下。
  export function showErrToast(errno: Err.Code) {
    showToast(Err.getMessage(errno));
  }

  export function copy(v: string) {
    if (v) {
      wx.setClipboardData({ data: v });
    }
  }

  export function getFileName(v: string): string {
    if (!v) {
      return v;
    }
    const index = v.lastIndexOf('/');
    return index >= 0 ? v.substring(index + 1) : v;
  }

  export async function alert(opt: WechatMiniprogram.ShowModalOption) {
    return new Promise((resolve, reject) => {
      wx.showModal({
        ...opt,
        success(res) {
          if (res.confirm) {
            resolve(true);
          } else {
            try {
              reject();
            } catch (err) {}
          }
        },
      });
    });
  }

  /**
   * https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.showModal.html
   */
  export async function showModal(
    title: string,
    content: string,
    cancelText = '取消',
    confirmText = '确定'
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      wx.showModal({
        title: title,
        content: content,
        cancelText: cancelText,
        confirmText: confirmText,
        cancelColor: '#1d2129',
        confirmColor: '#f53f3f',
        success: (res) => {
          if (res?.confirm) {
            resolve();
          } else {
            try {
              reject();
            } catch (err) {}
          }
        },
      });
    });
  }

  /**
   * 简单封装，获得指定的元素DOM的信息。
   * 注意：调试发现，如果使用select，返回的是一个数组，但只会有一个元素。如果使用selectAll()，会返回一个二维数组。
   */
  export async function queryElement(
    component: any,
    selector: string,
    multiResult: boolean = false,
    fields: WechatMiniprogram.Fields = { size: true, rect: true }
  ): Promise<any> {
    return new Promise((resolve) => {
      let query = wx.createSelectorQuery().in(component);
      if (multiResult) {
        query.selectAll(selector).fields(fields);
      } else {
        query.select(selector).fields(fields);
      }
      query.exec((res: any) => {
        resolve(res);
      });
    });
  }

  export async function scrollToSelector(
    component: any,
    scrollViewSelector: string,
    selector: string
  ) {
    let res = await queryElement(component, scrollViewSelector, false, {
      node: true,
      size: true,
    });

    if (res && res[0] && res[0].node && res[0].width && res[0].height) {
      let scrollView = res[0].node;
      scrollView.scrollIntoView(selector);
    }
  }

  export function fileExists(path: string): boolean {
    try {
      let fs = wx.getFileSystemManager();
      fs.accessSync(path);
      return true;
    } catch (err: any) {
      Logger.warn('File not accessable.', path);
    }
    return false;
  }

  /**
   * 测试发现，只在 usr 目录下的文件才可以删除，而 tmp 目录下的文件是不受控制的。
   */
  export function removeFile(path: string): boolean {
    try {
      if (fileExists(path)) {
        let fs = wx.getFileSystemManager();
        let res = fs.unlinkSync(path);
        Logger.info('Removed file.', path, res);
        return true;
      }
    } catch (err: any) {
      Logger.warn('File remove file failed.', path, err);
    }
    return false;
  }

  export async function getFileSize(path: string): Promise<number> {
    return new Promise((resolve) => {
      wx.getFileSystemManager().getFileInfo({
        filePath: path,
        success: (getFileInfoRes) => {
          resolve(getFileInfoRes.size);
        },
        fail: (err) => {
          Logger.warn('wx.getFileInfo failed.', err);
          resolve(0);
        },
      });
    });
  }

  export async function getFileMd5(path: string): Promise<string> {
    return new Promise((resolve) => {
      wx.getFileSystemManager().getFileInfo({
        filePath: path,
        digestAlgorithm: 'md5',
        success: (getFileInfoRes: any) => {
          // 用的lib.wx.api.d.ts 中没有定义。
          resolve(getFileInfoRes.digest);
        },
        fail: (err) => {
          Logger.warn('wx.getFileInfo failed.', err);
          resolve('');
        },
      });
    });
  }

  export function saveFileToUserDir(path: string, newName: string): string {
    try {
      const filePath = wx.env.USER_DATA_PATH + '/' + newName;
      let fs = wx.getFileSystemManager();
      const res = fs.saveFileSync(path, filePath);
      Logger.info('Saved file to user dir.', res);
      return res;
    } catch (err: any) {
      Logger.warn('Save file failed.', path, err);
    }
    return path;
  }

  /**
   * 因为 canvas.createImage() 创建出来的对象有内存泄露，导致其引用的对象也泄露。
   * 在没有解决之前，先及时设置为空吧。
   */
  export async function loadImage(path: string, image: any): Promise<boolean> {
    // Logger.info('Loading image.', path);
    return new Promise((resolve) => {
      image.onload = () => {
        // Logger.info('Loaded image onload().', path);
        image.onload = undefined;
        image.onerror = undefined;
        resolve(true);
      };
      image.onerror = (error: string) => {
        image.onload = undefined;
        image.onerror = undefined;
        Logger.warn('Load image failed.', path, error);
        resolve(false);
      };
      image.src = path;
    });
  }

  /**
   * 下载文件到暂时文件。
   * 是对wx.downloadFile的简单封装。
   * 其实miniprogram-api-promise中支持，但感觉其用起来有点隔应。
   */
  export async function downloadFile(path: string): Promise<string> {
    let tryTimes = 0;
    while (true) {
      let res = await downloadFileOnce(path);
      if (res.errno === 0 && res.path) {
        return res.path;
      }
      tryTimes++;
      // 按照腾讯的文档，
      // https://developers.weixin.qq.com/miniprogram/dev/framework/usability/PublicErrno.html#%E9%94%99%E8%AF%AF%E7%A0%81%E5%88%97%E8%A1%A8
      // 低于5没必要重试。
      // 常见的错误是 600003
      if (res.errno < 5 || tryTimes > 3) {
        return '';
      }
    }
  }

  export async function downloadFileOnce(path: string): Promise<{ errno: number; path: string }> {
    return new Promise((resolve) => {
      Logger.info('Downloading file.', path);
      wx.downloadFile({
        url: path,
        success: function (res) {
          Logger.info('Downloaded', path);
          resolve({ errno: 0, path: res.tempFilePath });
        },
        fail: (res: any) => {
          Logger.warn('Download failed.', path, res);
          resolve({ errno: res?.errno || -2, path: '' });
        },
      });
    });
  }

  // 判断页是否已在stack中。
  export function pageExists(route: string, pages?: any): boolean {
    if (!pages) pages = getCurrentPages();
    // getCurrentPages获得的数据中，route好像并不包含开头的 /
    if (route.startsWith('/')) {
      route = route.substring(1);
    }
    for (const page of pages) {
      if (page.route.indexOf(route) >= 0) {
        return true;
      }
    }
    return false;
  }

  export function enableScreenCapture(v = false) {
    if (wx.setVisualEffectOnCapture) {
      // 禁止截屏。
      wx.setVisualEffectOnCapture({ visualEffect: !v ? 'hidden' : 'none' });
    }
  }

  export function readBr(path: string): string {
    try {
      const fs = wx.getFileSystemManager();
      const data = fs.readCompressedFileSync({
        filePath: path,
        compressionAlgorithm: 'br',
      });
      const unit8Arr = new Uint8Array(data);
      let s = '';
      for (let i = 0; i < unit8Arr.length; i++) {
        s += String.fromCharCode(unit8Arr[i]);
      }
      s = decodeURIComponent(escape(s));
      return s;
    } catch (e) {
      Logger.info('ReadBr failed.', e);
      return '';
    }
  }

  export async function downloadAndSaveToAlbum(path: string, showLoading = true): Promise<boolean> {
    if (showLoading) wx.showLoading({ title: '下载中..', mask: true });
    const res = await WxUtils.downloadFile(path);
    if (showLoading) wx.hideLoading();
    if (!res) {
      if (showLoading) WxUtils.showToast('下载失败');
      return false;
    }
    return saveImageToAlbum(res);
  }

  export async function saveImageToAlbum(path: string): Promise<boolean> {
    return new Promise((resolve) => {
      wx.saveImageToPhotosAlbum({
        filePath: path,
        success: (res) => {
          resolve(true);
        },
        fail: (err) => {
          Logger.warn('Save image failed.', err);
          resolve(false);
        },
      });
    });
  }

  export async function readImageInfo(
    path: string,
    log = false
  ): Promise<WechatMiniprogram.GetImageInfoSuccessCallbackResult | undefined> {
    return new Promise((resolve) => {
      wx.getImageInfo({
        src: path,
        success: (res) => {
          const r = res?.errMsg === 'getImageInfo:ok' && res.width && res.height;
          if (log || !r) Logger.info('Read image.', path, res);
          resolve(r ? res : undefined);
        },
        fail: (err) => {
          Logger.warn('Read image failed.', path, err);
          resolve(undefined);
        },
      });
    });
  }
}

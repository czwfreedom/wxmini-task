const sPreviewPixels = 680;

export namespace OSSUtils {
  // 拼接URL。
  export function getResizedUrl(path: string, width: number, quality: number): string {
    if (!path) {
      return '';
    }
    return `${path}?x-oss-process=image/resize,m_mfit,w_${width},h_${width},q_${quality}`;
  }

  // 默认的预览的url。
  export function getPreviewUrl(path: string): string {
    return getResizedUrl(path, sPreviewPixels, 99);
  }
}

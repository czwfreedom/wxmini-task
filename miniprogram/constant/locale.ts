/**
 * 并不是真正的国际化。而是有一些动态文案是可能复用的，有一些又太长，零散放在源文件里会显得不协调，所以独立出来。
 */
export namespace Locale {
  /**
   * 最简单的字符串格式化。
   */
  export function format(str: string, ...val: (number | string)[]): string {
    for (let index = 0; index < val.length; index++) {
      str = str.replace(`{${index}}`, `${val[index]}`);
    }
    return str;
  }

  export const sCnNums: string[] = ['一', '二', '三', '四', '五', '六', '七'];

  // 这些代码应该是自动生成的。
  // 但有好处，调用者不用写字符串，减少出错的概率。
  export const enum String {
    back = '返回',
    // 通用
    cancel = '取消',
    confirm = '确定',
    clear = '清空',
    compressing = '压缩中..',
    check = '选中',
    commitAlbum = '提交打印',

    dataFormatDayDot = 'yyyy.MM.dd',
    dataFormatDayDash = 'yyyy-MM-dd',
    dateFormatDay = 'yyyy年MM月dd日',
    dateFormatMonth = 'yyyy年MM月',
    dateFormatMinute = 'yyyy年MM月dd日 hh:mm',

    processing = '处理中..',
    processSuccessful = '处理成功..',
    permissionNotGranted = '未授权',
  }
}

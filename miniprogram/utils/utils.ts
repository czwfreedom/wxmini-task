import { Base64 } from 'js-base64';
import { Logger } from './logger';

export namespace Utils {
  /**
   * 最简单的将一个形如 aid=756473518300729345&did=751138665938145280&oid=10751138665971699714
   * 切分为一个结构。
   * TODO 应该有更好的办法.
   * TODO 没有做更多检验，也没有decode。
   */
  export function parseParams(params: string): Record<string, string> {
    const res: Record<string, string> = {};
    const parts = params.split('&');
    for (const part of parts) {
      const kv = part.split('=');
      if (kv.length === 2) {
        res[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
      }
    }
    return res;
  }

  export function uuid(separator: string = ''): string {
    const s: string[] = [];
    const hexDigits = '0123456789abcdef';
    for (let i = 0; i < 36; i++) {
      s[i] = hexDigits.charAt(Math.floor(Math.random() * 0x10));
    }
    s[14] = '4'; // bits 12-15 of the time_hi_and_version field to 0010
    s[19] = hexDigits.charAt((parseInt(s[19], 16) & 0x3) | 0x8); // bits 6-7 of the clock_seq_hi_and_reserved to 01
    s[8] = s[13] = s[18] = s[23] = '-';

    return s.join(separator);
  }

  export function shortUuid(): string {
    return uuid().replace(/-/g, '');
  }

  export function parseJson<T>(v?: string, base64 = false, def?: T): T | undefined {
    if (!v) {
      return def;
    }
    try {
      return JSON.parse(base64 ? Base64.decode(v) : v);
    } catch (err) {
      Logger.warn('Invalid json.', v);
    }
    return def;
  }
}

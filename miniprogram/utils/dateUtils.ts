export namespace DateUtils {
  const sWeekDay = ['日', '一', '二', '三', '四', '五', '六'];

  export function getStartMillisOfDay(millis: number): number {
    // 如果没有获取到时间，表示为0.
    if (!millis) return 0;
    const date = new Date(millis);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }

  export function formatTime(timestamp: number) {
    return formatDate(timestamp, 'yyyy-MM-dd hh:mm:ss');
  }

  export function formatDate(timestamp: number, format: string = 'yyyy.MM.dd'): string {
    const t = new Date(timestamp);
    // 使用一次正则表达式匹配所有模式，通过回调函数处理替换
    const p =
      /([yY]{1,4})|(M{1,2})|([dD]{1,2})|(h{1,2})|(m{1,2})|(s{1,2})|(q{1,2})|(S{1,3})|(E{1})/g;

    return format.replace(p, (match, y, M, d, h, m, s, q, S, E) => {
      if (y) return (t.getFullYear() + '').substring(4 - y.length);
      if (M) return (t.getMonth() + 1 + '').padStart(M.length, '0');
      if (d) return (t.getDate() + '').padStart(d.length, '0');
      if (h) return (t.getHours() + '').padStart(h.length, '0');
      if (m) return (t.getMinutes() + '').padStart(m.length, '0');
      if (s) return (t.getSeconds() + '').padStart(s.length, '0');
      if (q) return '' + Math.floor((t.getMonth() + 3) / 3);
      if (S) return (t.getMilliseconds() + '').padStart(S.length, '0');
      if (E) return sWeekDay[t.getDay()];
      return match;
    });
  }
}

export namespace Logger {
  const logger = wx.getLogManager({ level: 0 });

  export function info(...data: any[]) {
    console.info(Date.now(), data);
    logger.info(data);
  }

  export function log(...data: any[]) {
    console.log(Date.now(), data);
    logger.log(data);
  }

  export function warn(...data: any[]) {
    console.warn(Date.now(), data);
    logger.warn(data);
  }

  export function error(...data: any[]) {
    console.error(Date.now(), data);
    logger.warn(data);
  }
}

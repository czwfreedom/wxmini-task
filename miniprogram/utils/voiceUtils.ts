/** 语音条最小宽度（rpx） */
const VOICE_MIN_WIDTH = 260;
/** 语音条每秒增加的宽度（rpx） */
const VOICE_WIDTH_PER_SEC = 4;
/** 语音条最大宽度（rpx） */
const VOICE_MAX_WIDTH = 580;

/**
 * 语音相关工具（编辑页语音条、列表页语音条共用）。
 *
 * 抽出来的目的：语音条的「时长文本」与「宽度样式」在两处都要用，
 * 若各写一份，改样式时要改两次。故统一在此定义。
 */
export namespace VoiceUtils {
  /** 秒 → 展示文本，如 15 → "0:15" */
  export function formatDuration(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r < 10 ? '0' : ''}${r}`;
  }

  /** 语音条宽度：260rpx + 秒×4rpx，上限 580rpx */
  export function barStyle(seconds: number): string {
    const width = Math.min(VOICE_MAX_WIDTH, VOICE_MIN_WIDTH + (seconds || 0) * VOICE_WIDTH_PER_SEC);
    return `width: ${width}rpx;`;
  }
}

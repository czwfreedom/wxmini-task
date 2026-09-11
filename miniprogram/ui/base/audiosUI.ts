import { InteractUI } from '../../core/interactUI';
import { Media, Resource } from '../../server/resource';
import { Logger } from '../../utils/logger';

/**
 * 音频播放（只管播放 / 停止，不管录音）。
 *
 * 抽出来的目的：录入只在编辑页（MediaInputUI），而播放是「编辑页 + 列表页」都要用，
 * 故把它下沉到两条继承链的交汇点 —— 插在 InteractUI 之上：
 *   InteractUI → AudiosUI ┬─ UserUpdaterUI → RoutineUI（列表页）
 *                         └─ PageInputUI → MediaInputUI（编辑页）
 *
 * 复用方式：子类实现两个抽象函数，告知「音频数据在哪」与「如何更新播放态 UI」，
 * 播放的互斥、停止、释放等公共逻辑都在本类里。
 */
export abstract class AudiosUI<D> extends InteractUI<D> {
  /** 音频播放上下文（单例）：保证同一时刻只播一条 */
  private audio?: WechatMiniprogram.InnerAudioContext;
  /** 当前播放的是哪个「组」里的哪条：id = 表单/记录 id，subid = 音频项 id */
  private playing?: { id: string; subid: string };

  /**
   * 取某组音频（由子类实现）。
   * @param id 表单 id（编辑页）或记录 id（列表页）
   */
  protected abstract getAudios(id: string): Media[];

  /**
   * 把播放态写回 data（由子类实现）：更新对应项的 selected / playing 标记。
   * @param playing true = 开始播放，false = 停止
   */
  protected abstract setAudioPlaying(id: string, subid: string, playing: boolean): void;

  public release() {
    this.stopAudio(true);
    if (this.audio) {
      this.audio.destroy();
      this.audio = undefined;
    }
    super.release();
  }

  public onHide(data?: any) {
    // 切后台/离开页面时停止，避免还在响
    this.stopAudio();
    super.onHide(data);
  }

  /**
   * 播放或停止：点同一条则停止，点其他条则切换（互斥，同时只播一条）。
   */
  protected toggleAudio(id: string, subid: string) {
    // 点的是当前正在播放的 → 停止
    if (this.playing && this.playing.id === id && this.playing.subid === subid) {
      this.stopAudio();
      return;
    }

    const medias = this.getAudios(id);
    const media = medias.find((o) => o.id === subid);
    if (!media?.path) {
      Logger.warn('Audio not found or has no path.', id, subid);
      return;
    }

    // 切换：先停掉上一条（内部会清掉它的播放态）
    this.stopAudio();

    const audio = this.getAudio();
    audio.src = media.path;
    audio.play();

    this.playing = { id: id, subid: subid };
    this.setAudioPlaying(id, subid, true);
  }

  /**
   * 停止播放。
   * @param silent true = 只清理状态、不回写 UI（用于 release，此时 data 可能已销毁）
   */
  protected stopAudio(silent = false) {
    if (this.playing) {
      const playing = this.playing;
      this.playing = undefined;
      if (!silent) {
        this.setAudioPlaying(playing.id, playing.subid, false);
      }
    }
    if (this.audio) {
      this.audio.stop();
    }
  }

  /** 是否正在播放某条 */
  protected isAudioPlaying(id: string, subid: string): boolean {
    return !!this.playing && this.playing.id === id && this.playing.subid === subid;
  }

  /** 懒创建音频上下文（单例） */
  private getAudio(): WechatMiniprogram.InnerAudioContext {
    if (!this.audio) {
      const audio = wx.createInnerAudioContext();
      // 播放结束 / 出错 / 被停止时，都要把 UI 上的播放态清掉
      audio.onEnded(() => this.stopAudio());
      audio.onError(() => this.stopAudio());
      audio.onStop(() => this.stopAudio());
      this.audio = audio;
    }
    return this.audio;
  }
}

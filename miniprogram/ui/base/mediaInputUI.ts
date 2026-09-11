import { Err } from '../../constant/error';
import { ImageChooser } from '../../media/imageChooser';
import { MediaUploader } from '../../media/uploader';
import { Entity } from '../../model/entity';
import { Media, Resource } from '../../server/resource';
import { FileUtils } from '../../utils/fileUtils';
import { Logger } from '../../utils/logger';
import { OSSUtils } from '../../utils/ossUtils';
import { VoiceUtils } from '../../utils/voiceUtils';
import { WxUtils } from '../../utils/wxUtils';
import { InputUI } from './inputUI';
import { PageInputUI } from './pageInputUI';

/** 录音最大时长（毫秒），与后台限制一致 */
const RECORD_MAX_DURATION = 60000;

/**
 * 带媒体的输入（图片 / 音频）。
 *
 * 设计要点：
 * 1. wxml 中所有媒体相关事件统一走 {@link onInputMediaTap}，由 data-button 分发：
 *      图片：add / preview / del
 *      音频：add（录音）/ stop（停止录音）/ play（播放或停止）/ del
 * 2. 完整的媒体数据（path / 宽高 / 大小 / 时长 / hash）保存在 {@link mediaMap} 中，
 *    **不进 data** —— 避免 setData 传递大对象与不可序列化内容，也便于提交时直接取用。
 *    data 中的 items 只保留渲染所需字段（id / avatar / name / selected / avatarStyle）。
 * 3. 音频用单例 InnerAudioContext，保证同一时刻只播一条（播放态用 item.selected 标记）。
 */
export abstract class MediaInputUI<D> extends PageInputUI<D> {
  /** 表单 id → 该表单的媒体列表（完整数据，不进 data） */
  private mediaMap: Map<string, Media[]> = new Map();
  /** 录音管理器 */
  private recorder?: WechatMiniprogram.RecorderManager;
  /** 正在录音的表单 id（空表示未在录音） */
  private recordId = '';
  /** 录音计时器 */
  private recordTimer?: any;
  /**
   * 注：音频播放已抽到基类 AudiosUI（单例播放、互斥、释放）。
   * 播放态由本类的 setAudioPlaying 写回 data。
   */

  public constructor(component: any, subDataKey = '') {
    super(component, subDataKey);

    this.bindEvent('onInputMediaTap', this.onInputMediaTap);
  }

  /**
   * @override
   * 资源释放：停止录音与播放，销毁音频上下文。
   */
  public release() {
    // 停止录音；音频的停止与 destroy 由基类 AudiosUI.release() 处理
    this.stopRecord(true);
    super.release();
  }

  // 默认行为？？
  // 不清楚子类是怎么定义VM的，所以留个hook点。
  protected setInputData(id: string, item: InputUI.VM) {
    this.setData({ [id]: item }, () => {
      this.onMediaChanged(item);
    });
  }

  protected onMediaChanged(item: InputUI.VM) {}

  /**
   * 取指定表单的媒体（完整数据），供提交时上传使用。
   */
  public getMedias(id: string): Media[] {
    return this.mediaMap.get(id) || [];
  }

  /**
   * 取指定表单的媒体 id（以英文逗号分隔），用于提交到后台的 mediaRemark 字段。
   * 例："12,34,56"。无媒体时返回空串。
   */
  public getMediaIds(ids: string[]): string[] {
    const result: string[] = [];
    for (const id of ids) {
      const medias = this.getMedias(id);
      for (const media of medias) {
        if (media.id && !result.includes(media.id)) result.push(media.id);
      }
    }
    return result;
  }

  /**
   * 直接设置某表单的媒体（完整数据），用于编辑场景回填并支持渲染。
   */
  public setMedias(id: string, medias: Media[]): void {
    this.mediaMap.set(id, medias || []);
  }

  /**
   * 【通用】上传所有媒体表单中的本地新增媒体。
   *
   * 放在基类是为了复用：任何页面只要继承 MediaInputUI，
   * 提交前调用本方法即可完成全部媒体的上传，无需关心有几个媒体表单。
   *
   * 上传会把本地 id（m 开头）替换为服务端返回的真实 id，
   * 因此**必须在取 id（getMediaIds / getAllMediaIds）之前调用**。
   *
   * @param showLoading 是否展示「上传中 x/y」进度
   * @returns 错误码，OK 表示全部成功
   */
  public async uploadMedias(showLoading = true): Promise<number> {
    const medias: Media[] = [];
    this.mediaMap.forEach((list) => {
      for (const media of list) {
        if (media.id && MediaUploader.isLocal(media.id)) medias.push(media);
      }
    });
    if (!medias.length) return Err.Code.OK;

    const loader = new MediaUploader(this.component);
    const errcode = await loader.upload(medias, showLoading);
    if (errcode !== Err.Code.OK) {
      this.showErrToast(errcode);
      return errcode;
    }
    return Err.Code.OK;
  }

  /**
   * 所有媒体事件入口：按 item.type 与 button 分发。
   */
  protected onInputMediaTap(e: WechatMiniprogram.TouchEvent) {
    const { id, subid, button } = e.currentTarget.dataset;
    const item = this.getInputItem(id || '');
    if (!item) return;

    if (item.type === InputUI.Type.Images) {
      if (button === 'add') {
        this.addImages(id, item);
      } else if (button === 'preview') {
        this.previewImage(item, subid);
      } else if (button === 'del') {
        this.delMedia(id, item, subid);
      }
    } else if (item.type === InputUI.Type.Audios) {
      if (button === 'add') {
        this.startRecord(id, item);
      } else if (button === 'stop') {
        this.stopRecord();
      } else if (button === 'play') {
        // 播放 / 停止：互斥与释放统一由基类 AudiosUI 处理
        this.toggleAudio(id, subid);
      } else if (button === 'del') {
        this.delMedia(id, item, subid);
      }
    }
  }

  // ==================== 图片 ====================

  /** 添加图片：选图 → 压缩 → 加入列表 */
  protected async addImages(id: string, item: InputUI.VM) {
    const limited = item.mediaLimited || 9;
    const items = this.ensureItems(item);
    const remain = limited - items.length;
    if (remain <= 0) {
      this.showToast(`最多${limited}张`);
      return;
    }

    // 在开发者工具里，首次打开会弹出一个服务协议，需要确认，如果有这个，是不能点击的。
    // this.showLoading();
    const chooser = new ImageChooser();
    const errcode = await chooser.choose(remain, false, item.sourceType);
    // this.hideLoading();
    // 用户取消不算错误
    if (errcode !== Err.Code.OK) {
      this.showErrToast(errcode);
      return;
    }

    const medias = this.getMedias(id);
    for (const media of chooser.medias) {
      const mid = MediaInputUI.newId();
      media.id = mid;
      medias.push(media);
      items.push({ id: mid, name: '', avatar: media.path });
    }
    this.mediaMap.set(id, medias);
    this.setInputData(id, item);
  }

  /** 预览图片 */
  protected previewImage(item: InputUI.VM, subid: string) {
    const items = item.items || [];
    const urls = items.map((o) => o.avatar || '').filter((o) => !!o);
    if (!urls.length) return;
    const found = items.find((o) => o.id === subid);
    wx.previewImage({
      current: (found?.avatar as string) || urls[0],
      urls: urls as string[],
    });
  }

  // ==================== 音频：录音 ====================

  /** 开始录音 */
  protected startRecord(id: string, item: InputUI.VM) {
    if (this.recordId) {
      this.showToast('正在录音中..');
      return;
    }

    const limited = item.mediaLimited || 9;
    const items = this.ensureItems(item);
    if (items.length >= limited) {
      this.showToast(`最多${limited}段`);
      return;
    }

    const recorder = this.getRecorder();
    this.recordId = id;
    item.recording = true;
    item.duration = 0;
    this.setInputData(id, item);

    // 每秒更新时长
    this.clearRecordTimer();
    this.recordTimer = setInterval(() => {
      if (!this.recordId) {
        this.clearRecordTimer();
        return;
      }
      const current = this.getInputItem(this.recordId);
      if (!current || !current.recording) {
        this.clearRecordTimer();
        return;
      }
      current.duration = (current.duration || 0) + 1;
      this.setInputData(this.recordId, current);
    }, 1000);

    recorder.start({ format: 'mp3', duration: RECORD_MAX_DURATION });
  }

  /** 停止录音（真正的结果在 onStop 回调中处理） */
  protected stopRecord(silent = false) {
    if (!this.recordId) return;
    if (!silent) {
      this.getRecorder().stop();
      return;
    }
    // 静默停止（如页面释放）：直接清理状态
    this.clearRecordTimer();
    const item = this.getInputItem(this.recordId);
    if (item) {
      item.recording = false;
      item.duration = 0;
      this.setInputData(this.recordId, item);
    }
    this.recordId = '';
    try {
      this.getRecorder().stop();
    } catch (e) {
      Logger.warn('Stop recorder failed.', e);
    }
  }

  /** 录音结束回调 */
  protected async onRecordStopped(res: {
    tempFilePath: string;
    duration: number;
    fileSize: number;
  }) {
    const id = this.recordId;
    this.clearRecordTimer();
    this.recordId = '';
    if (!id) return;

    const item = this.getInputItem(id);
    if (!item) return;
    item.recording = false;
    item.duration = 0;

    const seconds = Math.round((res.duration || 0) / 1000);
    // 秒停（不足 1 秒）不生成音频，避免出现无法播放的空条目
    if (!res.tempFilePath || seconds < 1) {
      Logger.info('Record too short, ignored.', seconds);
      this.setInputData(id, item);
      return;
    }

    const media = Resource.defaultMedia();
    media.id = MediaInputUI.newId();
    media.type = Resource.Type.Audio;
    media.path = res.tempFilePath;
    media.duration = res.duration;
    media.size = res.fileSize || 0;
    media.name = VoiceUtils.formatDuration(seconds);
    media.postfix = FileUtils.postfix(media.path);

    const medias = this.getMedias(id);
    medias.push(media);
    this.mediaMap.set(id, medias);

    const items = this.ensureItems(item);
    items.push(this.initAudioVM(media));

    this.setInputData(id, item);

    // hash 只用于去重/上传，异步算即可，不阻塞 UI
    const hash = await WxUtils.getFileMd5(media.path);
    if (hash) media.hash = hash;
  }

  // ==================== 音频：播放（基类 AudiosUI 的两个抽象函数） ====================

  /**
   * @override
   * 取某表单的音频（供基类播放时查找 src）。
   */
  protected getAudios(id: string): Media[] {
    return this.getMedias(id);
  }

  /**
   * @override
   * 把播放态写回 data：对应项 selected 标记（wxml 据此加 voice-playing 触发波形动画）。
   */
  protected setAudioPlaying(id: string, subid: string, playing: boolean): void {
    const item = this.getInputItem(id);
    if (!item) return;
    for (const o of item.items || []) {
      if (o.id === subid) o.selected = playing;
    }
    this.setInputData(id, item);
  }

  // ==================== 通用 ====================

  /** 删除媒体（图片与音频通用） */
  protected delMedia(id: string, item: InputUI.VM, subid: string) {
    // 删的是正在播放的音频 → 先停止（isAudioPlaying 由基类提供）
    if (this.isAudioPlaying(id, subid)) {
      this.stopAudio();
    }

    const items = item.items || [];
    const index = items.findIndex((o) => o.id === subid);
    if (index >= 0) items.splice(index, 1);

    const medias = this.getMedias(id);
    const mIndex = medias.findIndex((o) => o.id === subid);
    if (mIndex >= 0) medias.splice(mIndex, 1);
    // this.mediaMap.set(id, medias);

    this.setInputData(id, item);
  }

  /** 取默认的图片表单 VM（子类可重写） */
  protected defaultImageVM(id: string, medias?: Media[]): InputUI.VM {
    const items = medias?.map((o) => this.initMediaVM(o)) || [];
    return {
      id: id,
      type: InputUI.Type.Images,
      name: '',
      items,
      mediaLimited: 9,
      mediaDeletable: true,
      sourceType: ['album', 'camera'],
    };
  }

  protected initMediaVM(media: Media): Entity.Image {
    return {
      id: media.id,
      name: '',
      avatar: media.localPath || OSSUtils.getPreviewUrl(media.path),
    };
  }

  /** 取默认的音频表单 VM（子类可重写） */
  protected defaultAudioVM(id: string, medias?: Media[]): InputUI.VM {
    const items = medias?.map((o) => this.initAudioVM(o)) || [];
    return {
      id: id,
      type: InputUI.Type.Audios,
      name: '',
      items,
      mediaLimited: 9,
      mediaDeletable: true,
      recording: false,
      duration: 0,
    };
  }

  protected initAudioVM(media: Media): Entity.Image {
    const seconds = (media.duration || 0) / 1000;
    return {
      id: media.id,
      avatar: media.path,
      name: media.name,
      avatarStyle: VoiceUtils.barStyle(seconds),
    };
  }

  // ==================== 私有 ====================

  /** 保证 items 存在（item 来自 data，需就地修改） */
  private ensureItems(item: InputUI.VM): InputUI.VM[] {
    if (!item.items) item.items = [];
    return item.items;
  }

  private clearRecordTimer() {
    if (this.recordTimer) {
      clearInterval(this.recordTimer);
      this.recordTimer = undefined;
    }
  }

  private getRecorder(): WechatMiniprogram.RecorderManager {
    if (!this.recorder) {
      const recorder = wx.getRecorderManager();
      recorder.onStop((res) => {
        this.onRecordStopped(res);
      });
      recorder.onError((err) => {
        Logger.warn('Record failed.', err);
        this.stopRecord(true);
        this.showToast('录音失败');
      });
      this.recorder = recorder;
    }
    return this.recorder;
  }

  /** 生成媒体项 id */
  private static newId(): string {
    return 'm' + Date.now() + Math.floor(Math.random() * 1000);
  }

}

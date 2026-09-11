import { Err } from '../constant/error';
import { Event } from '../core/event';
import { Intent } from '../core/intent';
import { Entity } from '../model/entity';
import { Resource } from '../server/resource';
import { Routine } from '../server/routine';
import { InputUI } from '../ui/base/inputUI';
import { MenuUI } from '../ui/base/menuUI';
import { DateUtils } from '../utils/dateUtils';
import { Logger } from '../utils/logger';
import { WxUtils } from '../utils/wxUtils';
import { RoutineAdapter } from './routineAdapter';
import { RoutineEditorUI } from './routineEditorUI';

// 完成事件。
export class RoutineReaperUI extends RoutineEditorUI {
  public constructor(component: any, intent?: Partial<Routine.Info>) {
    super(component, intent);
    this.bindEvent('onInputMenuTap', this.onInputMenuTap);
    this.watchKeyboard();
  }

  protected getInfo(): Routine.Info {
    return this.entry as Routine.Info;
  }

  /**
   * @override
   */
  public getInputItem(id: string): InputUI.VM | undefined {
    if (id === 'detailImage') {
      return this.getData().detailImage;
    }
    return this.getData().detailAudio;
  }

  /**
   * @override
   */
  protected onMediaChanged(item: InputUI.VM): void {
    this.setData({ menus: this.getMenus() });
  }

  /**
   * @override
   */
  public async loadData(): Promise<number> {
    const info = this.getInfo();
    const config = RoutineAdapter.findConfig(info.category);
    WxUtils.setNavTitle('完成任务');
    const remark = info.remark || '';
    const isNote = Routine.isNote(info.category);

    const res = await this.loadMedias();
    if (res !== 0) return this.abort(res);

    this.updateData({
      loaded: true,
      finishing: true,
      detail: {
        id: 'detail',
        name: isNote ? '随手记' : '写写做了啥 ✍️',
        type: InputUI.Type.Textarea,
        header: !isNote ? `任务：${info.detail}` : '',
        hint: config.finish || '说说做了什么吧',
        value: remark,
        style: 'h',
        maxLength: 400,
        charCount: remark.length,
        footer: this.getFooter(),
      },
      detailImage: this.defaultImageVM('detailImage', this.getMedias('detailImage')),
      detailAudio: this.defaultAudioVM('detailAudio', this.getMedias('detailAudio')),
      snapCanvas: true,
    });
    return 0;
  }

  /**
   * @override
   */
  protected getMenus(): MenuUI.Menus {
    const commitData = this.getCommitData();
    const updating = this.updating();
    if (!commitData && updating) return { id: '', items: [] };

    return {
      id: 'm',
      items: [
        {
          id: 'finish',
          name: updating ? '修改反馈' : this.isNote() ? '记下来' : '完成任务',
          enabled: !!commitData,
        },
      ],
    };
  }

  /**
   * @override
   */
  protected updating(): boolean {
    return Routine.isDone(this.getInfo());
  }

  protected async loadMedias(): Promise<number> {
    const remark = this.entry?.mediaRemark;
    if (!remark) return 0;
    const medias = await Resource.list({ ids: remark.split(',') });
    if ('number' === typeof medias) return medias;

    const images = medias.filter((o) => o.type === Resource.Type.Image);
    const audios = medias.filter((o) => o.type === Resource.Type.Audio);
    this.setMedias('detailImage', images);
    this.setMedias('detailAudio', audios);
    return 0;
  }

  protected onInputMenuTap(e: WechatMiniprogram.TouchEvent) {
    const { id, button } = e.currentTarget.dataset;
    if (id === 'detail') {
      if (button?.startsWith('footer')) {
        const config = RoutineAdapter.findConfig(this.getInfo().category);
        if (config?.finishExamples?.items?.length) {
          const options: Entity.Option[] = config.finishExamples.items.map((o) => {
            return { id: o.id, name: o.name, desc: o.desc };
          });
          this.getChoices().show(
            { id: 'i', name: '从哪个角度记？', items: options, limited: 1, style: 'detailed' },
            {
              onChoicesDialogItemTap: (item) => {
                const detail = this.getData().detail;
                detail.footer = this.getFooter(item.id);
                this.setData({ detail });
              },
            }
          );
        }
      }
    }
  }

  protected isNote(): boolean {
    return Routine.isNote(this.getInfo().category);
  }

  protected getFooter(id?: string): Entity.Label {
    if (this.isNote()) {
      const config = RoutineAdapter.findConfig(this.getInfo().category);
      if (config?.finishExamples?.items?.length) {
        let item: Entity.Hierarchy | undefined;
        if (!id) {
          const rand = Math.floor(Math.random() * config.finishExamples.items.length);
          item = config.finishExamples.items[rand];
        } else {
          item = Entity.find(config.finishExamples.items, id).item;
        }
        if (item) {
          return {
            id: 'footer:' + item.id,
            name: '例如',
            desc: item.items?.map((o) => o.name).join(' · ') || '',
            hint: config.finishExamples.name || '',
          };
        }
      }
    }
    return { id: '', name: '' };
  }

  /** 提交创建任务 */
  protected async commit() {
    let data = this.getCommitData(true);
    if (!data) return;

    // 前面检查了一次，然后上传之后，再来一次。
    const uploadErrcode = await this.uploadMedias();
    if (uploadErrcode !== Err.Code.OK) return;

    data = this.getCommitData(true);
    if (!data) return;

    Logger.info('Finishing', data);

    const updating = this.updating();
    if (!updating) data.status = Routine.Status.Done;

    this.showLoading();
    const res = !data.id ? await Routine.create(data) : await Routine.update(data);
    this.hideLoading();

    if ('number' === typeof res) {
      this.showErrToast(res === Err.Code.OverLimited ? Err.Code.RoutineOverLimited : res);
      return;
    }

    this.showToast(updating ? '已修改' : RoutineAdapter.getCelebrate(this.getInfo().category));
    Object.assign(this.getInfo(), !data.id ? res : data);
    this.postEvent(Event.Name.RoutineUpdated, this.getInfo());
    Intent.delayBack();
  }

  /**
   * @override
   */
  protected getCommitData(showToast = false): Partial<Routine.Info> | undefined {
    const data = this.getData();
    const content = data.detail.value?.trim() || '';
    const isNote = this.isNote();
    // 图片与音频的 id 以英文逗号分隔，统一放在 mediaRemark。
    const mediaRemark = this.getMediaIds(['detailImage', 'detailAudio']).join(',');
    if (!content && !mediaRemark) {
      if (showToast) this.showToast(isNote ? '要记点什么呢' : '请填写任务反馈');
      return undefined;
    }
    const info = this.getInfo();

    // 没有改动：文字与媒体都没变（否则只加图片没改文字会被误判为无改动）。
    if (
      this.updating() &&
      content === (info.remark || '') &&
      mediaRemark === (info.mediaRemark || '')
    ) {
      return undefined;
    }

    // 直接生成一条记录。
    if (!info.id && isNote) {
      return {
        status: Routine.Status.Done,
        category: info.category,
        date: DateUtils.getDay(Date.now()),
        transaction: Routine.newTransaction(),
        detail: '随手记',
        duration: 0,
        planTime: Date.now(),
        remark: content || undefined,
        mediaRemark: mediaRemark || undefined,
      };
    }

    return {
      id: info.id,
      remark: !content && !info.remark ? undefined : content,
      mediaRemark: !mediaRemark && !info.mediaRemark ? undefined : mediaRemark,
    };
  }
}

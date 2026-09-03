import { Err } from '../constant/error';
import { Event } from '../core/event';
import { Intent } from '../core/intent';
import { Routine } from '../server/routine';
import { MenuUI } from '../ui/menuUI';
import { DateUtils } from '../utils/dateUtils';
import { Logger } from '../utils/logger';
import { WxUtils } from '../utils/wxUtils';
import { RoutineAdapter } from './routineAdapter';
import { RoutineEditorUI } from './routineEditorUI';

// 完成事件。
export class RoutineReaperUI extends RoutineEditorUI {
  public constructor(component: any, intent?: Partial<Routine.Info>) {
    super(component, intent);
    this.watchKeyboard();
  }

  protected getInfo(): Routine.Info {
    return this.entry as Routine.Info;
  }

  /**
   * @override
   */
  public loadData(): number {
    const info = this.getInfo();
    const config = RoutineAdapter.findConfig(info.category);
    WxUtils.setNavTitle('完成任务');
    const remark = info.remark || '';
    const isNote = Routine.isNote(info.category);
    this.setData({
      loaded: true,
      finishing: true,
      contentMaxLength: 400,
      contentTitle: isNote ? '随手记' : '',
      contentText: remark,
      contentCharCount: remark.length,
      contentHolder: config.finish || '说说做了什么吧',
      contentHint: !isNote ? `任务：${info.detail}` : '',
      contentStyle: 'h',
      menus: this.getMenus(),
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

  protected isNote(): boolean {
    return Routine.isNote(this.getInfo().category);
  }

  /** 提交创建任务 */
  protected async commit() {
    const data = this.getCommitData(true);
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
    const content = data.contentText?.trim();
    const isNote = this.isNote();
    if (!content) {
      if (showToast) this.showToast(isNote ? '要记点什么呢' : '请填写任务反馈');
      return undefined;
    }
    // 没有改动。
    if (this.updating() && content === this.getInfo().remark) return undefined;

    // 直接生成一条记录。
    const info = this.getInfo();
    if (!this.getInfo().id && isNote) {
      return {
        status: Routine.Status.Done,
        category: info.category,
        date: DateUtils.getDay(Date.now()),
        transaction: Routine.newTransaction(),
        detail: '随手记',
        duration: 0,
        planTime: Date.now(),
        remark: content,
      };
    }

    return {
      id: this.getInfo().id,
      remark: content,
    };
  }
}

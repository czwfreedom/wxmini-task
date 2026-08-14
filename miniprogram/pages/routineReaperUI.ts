import { Event } from '../core/event';
import { Intent } from '../core/intent';
import { Routine } from '../server/routine';
import { MenuUI } from '../ui/menuUI';
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
    this.setData({
      loaded: true,
      finishing: true,
      contentMaxLength: 400,
      contentText: remark,
      contentCharCount: remark.length,
      contentHolder: config.finish || '说说做了什么吧',
      contentHint: `任务：${info.detail}`,
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
      items: [{ id: 'finish', name: updating ? '修改反馈' : '完成任务', enabled: !!commitData }],
    };
  }

  /**
   * @override
   */
  protected updating(): boolean {
    return Routine.isDone(this.getInfo());
  }

  /** 提交创建任务 */
  protected async commit() {
    const data = this.getCommitData(true);
    if (!data) return;
    Logger.info('Finishing', data);

    const updating = this.updating();
    if (!updating) data.status = Routine.Status.Done;

    this.showLoading();
    const res = await Routine.update(data);
    this.hideLoading();

    if ('number' === typeof res) {
      this.showErrToast(res);
      return;
    }

    this.showToast(updating ? '已修改' : '已完成');
    Object.assign(this.getInfo(), data);
    this.postEvent(Event.Name.RoutineUpdated, this.getInfo());
    Intent.delayBack();
  }

  /**
   * @override
   */
  protected getCommitData(showToast = false): Partial<Routine.Info> | undefined {
    const data = this.getData();
    const content = data.contentText?.trim();
    if (!content) {
      if (showToast) this.showToast('请填写任务反馈');
      return undefined;
    }
    // 没有改动。
    if (this.updating() && content === this.getInfo().remark) return undefined;

    return {
      id: this.getInfo().id,
      remark: content,
    };
  }
}

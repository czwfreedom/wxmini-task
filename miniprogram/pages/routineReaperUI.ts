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
    this.setData({
      loaded: true,
      finishing: true,
      contentMaxLength: 256,
      contentHolder: config.finish || '说说做了什么吧',
      contentHint: `任务：${info.detail}`,
      menus: this.getMenus(),
    });
    return 0;
  }

  /**
   * @override
   */
  protected getMenus(): MenuUI.Menus {
    const commitData = this.getCommitData();
    return { id: 'm', items: [{ id: 'finish', name: '完成任务', enabled: !!commitData }] };
  }

  /** 提交创建任务 */
  protected async commit() {
    const data = this.getCommitData(true);
    if (!data) return;

    Logger.info('Finishing', data);

    data.status = Routine.Status.Done;

    this.showLoading();
    const res = await Routine.update(data);
    this.hideLoading();

    if (res !== 0) {
      this.showErrToast(res);
      return;
    }

    this.showToast('已完成');

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

    return {
      id: this.getInfo().id,
      remark: content,
    };
  }
}

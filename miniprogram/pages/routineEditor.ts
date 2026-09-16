import { Intent } from '../core/intent';
import { Entity } from '../model/entity';
import { Routine } from '../server/routine';
import { RoutineEditorUI } from './routineEditorUI';
import { RoutineReaperUI } from './routineReaperUI';

Page({
  data: {
    ...RoutineEditorUI.defaultData(),
  },

  ui: undefined as RoutineEditorUI | undefined,

  onLoad() {
    // Intent 里除了任务本身，还带着列表页解析好的署名（partner），
    // 完成页据此渲染「谁邀我一起」，不必再查一次用户。
    const intent = Intent.get() as Intent.Wrap<Routine.Intent>;
    if (intent?.type === Entity.Action.Finish) {
      this.ui = new RoutineReaperUI(this, intent?.data);
    } else {
      this.ui = new RoutineEditorUI(this, intent?.data);
    }
    this.ui?.loadData();
  },

  onUnload() {
    this.ui?.release();
  },
});

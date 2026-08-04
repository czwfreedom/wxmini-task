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
    const intent = Intent.get() as Intent.Wrap<Partial<Routine.Info>>;
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

import { Intent } from '../core/intent';
import { RoutineEditorUI } from './routineEditorUI';

Page({
  data: {
    ...RoutineEditorUI.defaultData(),
  },

  ui: undefined as RoutineEditorUI | undefined,

  onLoad() {
    this.ui = new RoutineEditorUI(this, Intent.get());
    this.ui.loadData();
  },

  onUnload() {
    this.ui?.release();
  },
});

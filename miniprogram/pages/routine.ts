import { RoutineUI } from './routineUI';

Page({
  data: {
    ...RoutineUI.getDefaultData(),
  },

  ui: undefined as RoutineUI | undefined,

  onLoad() {
    this.ui = new RoutineUI(this);
    this.ui.loadData();
  },

  onUnload() {
    this.ui?.release();
  },
});

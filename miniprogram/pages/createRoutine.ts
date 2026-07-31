import { CreateRoutineUI } from './createRoutineUI';

Page({
  data: {
    ...CreateRoutineUI.defaultData(),
  },

  ui: undefined as CreateRoutineUI | undefined,

  onLoad() {
    this.ui = new CreateRoutineUI(this);
    this.ui.loadData();
  },

  onUnload() {
    this.ui?.release();
  },
});

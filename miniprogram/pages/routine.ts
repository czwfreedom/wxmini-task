import { RoutineUI } from './routineUI';

Page({
  data: {
    // 与tab复用，暂时想不到更好的办法。
    wrap: RoutineUI.defaultData(),
  },

  ui: undefined as RoutineUI | undefined,

  onLoad(options: Record<string, string>) {
    this.ui = new RoutineUI(this, 'wrap', options.uid);
    this.ui.loadData();
  },

  onUnload() {
    this.ui?.release();
  },
});

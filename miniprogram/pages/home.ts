import { MineUI } from './mineUI';

Page({
  data: {
    ...MineUI.getDefaultData(),
  },

  ui: undefined as MineUI | undefined,

  onLoad() {
    this.ui = new MineUI(this);
    this.ui.loadData();
  },

  onShow() {
    this.ui?.onShow();
  },

  onUnload() {
    this.ui?.release();
  },
});

import { IndexUI } from './indexUI';

// pages/index/index.ts
Page({
  data: {
    ...IndexUI.getDefaultData(),
  },

  ui: undefined as IndexUI | undefined,

  onLoad() {
    this.ui = new IndexUI(this);
    this.ui.loadData();
  },

  onUnload() {
    this.ui?.release();
  },
});

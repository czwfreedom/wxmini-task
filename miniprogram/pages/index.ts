import { Context } from '../core/context';
import { IndexUI } from './indexUI';

// pages/index/index.ts
Page({
  data: {
    ...IndexUI.defaultData(),
  },

  ui: undefined as IndexUI | undefined,

  onLoad() {
    Context.bindLogin(() => {
      this.ui = new IndexUI(this);
      this.ui.loadData();
    });
  },

  onUnload() {
    this.ui?.release();
  },
});

import { Context } from '../core/context';
import { IndexUI } from './indexUI';

// pages/index/index.ts
Page({
  data: {
    ...IndexUI.defaultData(),
  },

  ui: undefined as IndexUI | undefined,
  options: undefined as Record<string, string> | undefined,

  onLoad(options: Record<string, string>) {
    this.options = options;
    Context.bindLogin(() => {
      this.ui = new IndexUI(this);
      this.ui.loadData(options);
    });
  },

  onUnload() {
    this.ui?.release();
  },
});

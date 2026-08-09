import { RelationsUI } from './relationsUI';

Page({
  data: { ...RelationsUI.defaultData() },
  ui: undefined as RelationsUI | undefined,

  onLoad(options: Record<string, string>) {
    this.ui = new RelationsUI(this, options.dir || 'usee');
    this.ui.loadData();
  },

  onUnload() {
    this.ui?.release();
  },

  onShareAppMessage(obj: any) {
    return this.ui?.onShareAppMessage ? this.ui.onShareAppMessage(obj) : undefined;
  },
});

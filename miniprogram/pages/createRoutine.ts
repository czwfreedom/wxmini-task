import { CreateRoutineUI } from './createRoutineUI';
import { ChoicesUI } from '../ui/choicesUI';
import { Entity } from '../model/entity';

Page({
  data: {
    ...CreateRoutineUI.getDefaultData(),
    choices: {} as any,
  } as CreateRoutineUI.Data & { choices: any },

  ui: undefined as CreateRoutineUI | undefined,
  choicesUI: undefined as ChoicesUI | undefined,

  onLoad() {
    this.choicesUI = new ChoicesUI(this);
    this.ui = new CreateRoutineUI(this, this.choicesUI);
    this.ui.loadData();
  },

  onUnload() {
    this.ui?.release();
    this.choicesUI?.release();
  },

  /* ======== ChoicesUI 事件委托 ======== */
  onChoicesItemTap(e: WechatMiniprogram.TouchEvent) {
    this.choicesUI?.onItemTap(e);
  },
  onChoicesMaskTap() {
    this.choicesUI?.onMaskTap();
  },
  onChoicesCloseTap() {
    this.choicesUI?.onCloseTap();
  },
  onChoicesConfirmTap() {
    this.choicesUI?.onConfirmTap();
  },
});

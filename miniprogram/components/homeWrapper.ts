import { MineUI } from '../pages/mineUI';
import { RoutineUI } from '../pages/routineUI';

/**
 * 常用的列表已封装，但若页面存在多个类似的列表，如多tab，都挂在Page下会有命名冲突，还得做分发。
 * 用小程序的自定义组件来实现事件的隔离。
 */
Component({
  properties: {
    type: {
      type: String,
      value: '',
    },
    index: {
      type: Number,
      value: 0,
    },
    visible: {
      type: Boolean,
      value: true,
      observer: function (newVal, oldVal) {
        this.loadData(newVal);
      },
    },
  },

  data: {
    routine: {
      ...RoutineUI.defaultData(),
    },
    mine: {
      ...MineUI.defaultData(),
    },
    _loaded: false,
    _ui: {} as any,
  },

  options: {
    styleIsolation: 'apply-shared',
    pureDataPattern: /^_/,
  },

  methods: {
    loadData(visible: boolean) {
      if (visible && !this.data._loaded && this.data?._ui?.loadData) {
        this.data._loaded = true;
        this.data._ui.loadData();
      }
    },

    onShareAppMessage(obj: any) {
      return this.data._ui?.onShareAppMessage ? this.data._ui.onShareAppMessage(obj) : undefined;
    },
    onPullDownRefresh() {
      return this.data._ui?.onPullDownRefresh ? this.data._ui.onPullDownRefresh() : undefined;
    },
  },

  pageLifetimes: {
    show() {
      // Logger.info('Page onShow', this.properties.type);
      this.data._ui?.onShow && this.data._ui?.onShow();
    },

    // hide() {
    //   Logger.info('Page onHide', this.properties.type);
    //   this.data._ui?.onHide && this.data._ui?.onHide();
    // },
  },

  lifetimes: {
    attached() {
      const type = this.properties.type;
      if (type === 'routine') {
        this.data._ui = new RoutineUI(this, 'routine');
      } else if (type === 'mine') {
        this.data._ui = new MineUI(this, 'mine');
      }
      this.loadData(this.properties.visible);
    },

    detached() {
      // Logger.info('Table detached', this.properties.type);
      this.data._ui?.release && this.data._ui?.release();
    },
  },
});

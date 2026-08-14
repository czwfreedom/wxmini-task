import { Constants } from '../constant/common';
import { Event } from '../core/event';
import { EventBus } from '../core/eventBus';
import { Intent } from '../core/intent';
import { Entity } from '../model/entity';
import { MenuUI } from '../ui/menuUI';
import { Logger } from '../utils/logger';
import { WxUtils } from '../utils/wxUtils';

Page({
  data: {
    current: 0,
    tabs: { id: '', items: [] } as MenuUI.ImageTabs,
    isTabVisible: true,
  },

  // 双击检测：记录上一次点击的 tab 与时间。
  _lastTabTime: 0,

  onLoad() {
    this.init();
  },

  onShareAppMessage(obj: any) {
    // 不知道为什么报错。试过放在data内部，报错倒是没有了，小程序貌似会序列化data中的所有数据。
    const tab = this.getRealTabs()[this.data.current];
    if (tab) {
      const component = this.selectComponent('#home-' + tab.id);
      if (!!component?.onShareAppMessage) {
        return component.onShareAppMessage(obj);
      }
    }
  },

  onSwiperChanged(e: WechatMiniprogram.TouchEvent) {
    const { current, source } = e.detail;
    // Logger.info('onSwiperChange.', current, source);
    if (source !== 'touch') {
      return;
    }
    this.setCurrent(current);
  },

  onTabTap(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset;
    let tapMillis = 0;
    if (id === 'add') {
      WxUtils.hapticLight();
      Intent.navigateTo(Constants.Page.CreateRoutine);
    } else {
      const res = Entity.find(this.getRealTabs(), id);
      if (res.item && res.index !== this.data.current) {
        this.setCurrent(res.index);
      } else if (res.item && res.index === this.data.current) {
        const ms = this._lastTabTime;
        const now = Date.now();
        if (ms && now - ms < 300) {
          this.onTabDoubleTap(e);
        } else {
          tapMillis = now;
        }
      }
    }
    this._lastTabTime = tapMillis;
  },

  onTabDoubleTap(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset;
    Logger.info('onDoubleTap', 'home', id);
    EventBus.emit(Event.Name.OnDoubleTap, { from: 'home', button: id });
  },

  init() {
    this.setData({ tabs: this.getTabs() });
  },

  getRealTabs(): MenuUI.ImageTab[] {
    return this.data.tabs.items.filter((o) => o.id);
  },

  setCurrent(current: number) {
    const newData: any = {};
    const reals = this.getRealTabs();
    const tab = reals[current];
    newData['tabs.id'] = tab.id;
    newData.current = current;
    this.setData(newData);
    wx.setNavigationBarTitle({ title: tab.name });
  },

  getTabs(): MenuUI.ImageTabs {
    const tabs: MenuUI.ImageTabs = {
      id: '',
      items: [
        {
          id: 'routine',
          name: '日常',
          normalImage: '../assets/imgs/ic-routine-normal.svg',
          checkedImage: '../assets/imgs/ic-routine-selected.svg',
        },
        { id: '', name: '', normalImage: '', checkedImage: '' },
        {
          id: 'mine',
          name: '我的',
          normalImage: '../assets/imgs/ic-mine-normal.svg',
          checkedImage: '../assets/imgs/ic-mine-selected.svg',
        },
      ],
    };
    tabs.id = tabs.items[0].id;
    return tabs;
  },
});

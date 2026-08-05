import { Entity } from '../model/entity';
import { MenuUI } from '../ui/menuUI';

Page({
  data: {
    current: 0,
    tabs: { id: '', items: [] } as MenuUI.ImageTabs,
    isTabVisible: true,
  },

  onLoad() {
    this.init();
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
    if (id === 'add') {
    } else {
      const res = Entity.find(this.getRealTabs(), id);
      if (res.item && res.index !== this.data.current) {
        this.setCurrent(res.index);
      }
    }
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

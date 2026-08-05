import { SubUI } from '../core/subUI';
import { MineAdapter } from './mineAdapter';
import { Constants } from '../constant/common';

export namespace MineUI {
  export interface Data extends SubUI.Data {
    /** 头像占位文字 */
    avatarText: string;
    /** 用户昵称 */
    nickname: string;
    /** 累计任务数 */
    totalTasks: number;
    /** 累计完成数 */
    totalDone: number;
    /** 连续天数 */
    streakDays: number;
    /** 伙伴总数（角标） */
    partnerCount: number;
  }

  export interface MenuItem {
    id: string;
    name: string;
    desc: string;
    iconBg: string;
    /** 角标数字，0 不展示 */
    badge?: number;
  }
}

export class MineUI extends SubUI<MineUI.Data> {
  private adapter = new MineAdapter();

  public constructor(component: any, subDataKey: string) {
    super(component, subDataKey);

    this.bindEvent('onMenuTap', this.onMenuTap);
    this.bindEvent('onToRoutine', this.onToRoutine);
    this.bindEvent('onToCreate', this.onToCreate);
  }

  public static defaultData(): MineUI.Data {
    return {
      loaded: false,
      abortMessage: '',
      avatarText: '',
      nickname: '',
      totalTasks: 0,
      totalDone: 0,
      streakDays: 0,
      partnerCount: 0,
    };
  }

  public loadData() {
    this.setData({ ...this.adapter.adapt() });
  }

  /** 菜单点击 */
  protected onMenuTap(e: WechatMiniprogram.TouchEvent) {
    const { menu } = e.currentTarget.dataset;
    if (menu === 'partner') {
      // TODO: 跳转伙伴页
    }
  }

  /** 切换到任务 tab */
  protected onToRoutine() {
    wx.redirectTo({ url: Constants.Page.Routine });
  }

  /** 创建任务 */
  protected onToCreate() {
    wx.navigateTo({ url: Constants.Page.CreateRoutine });
  }
}

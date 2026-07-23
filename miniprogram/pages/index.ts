// pages/index/index.ts
Page({
  data: {
    motto: 'Hello World',
    userInfo: {},
    hasUserInfo: false,
    canIUse: wx.canIUse('button.open-type.getUserInfo'),
  },

  onLoad() {
    console.log('Index Page Loaded');
  },

  onShow() {
    console.log('Index Page Show');
  },

  /** 获取用户信息 */
  getUserInfo() {
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true,
        });
      },
      fail: (err) => {
        console.error('获取用户信息失败', err);
      },
    });
  },

  onShareAppMessage() {
    return {
      title: 'Hello 小程序',
      path: '/pages/index/index',
    };
  },
});

Page({
  data: {
    totalUsers: 0
  },

  onLoad() {
    this.loadTotalUsers()
  },

  // 加载总用户数
  async loadTotalUsers() {
    try {
      wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'getUserTotalCount',
        }
      }).then(res => {
        this.setData({
          totalUsers: res.result.data
        })
      })
    } catch (error) {
      console.error('获取用户总数失败:', error)
    }
  },

  // 点击转盘管理
  handleTurntableManage() {
    wx.navigateTo({
      url: '/pages/admin/turntable'
    })
  },

  // 点击用户管理
  handleUserManage() {
    wx.navigateTo({
      url: '/pages/admin/user'
    })
  }
}) 
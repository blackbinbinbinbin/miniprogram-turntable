Page({
  data: {
    turntableList: [],
    total: 0,
    totalPages: 0,
    searchKeyword: '',
    page: 1,
    pageSize: 10,
    turntableText: '',
    turntableUserName: ''
  },

  onLoad() {
    this.loadTurntableList()
  },

  // 加载转盘列表
  async loadTurntableList() {
    wx.showLoading({
      title: '加载中',
    })
    try {
      const { page, pageSize, turntableText, turntableUserName } = this.data
      console.log('搜索参数：', { page, pageSize, turntableText, turntableUserName })
      const res = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'getTurntableList',
          data: {
            page,
            pageSize,
            turntableText: turntableText || '',
            turntableUserName: turntableUserName || ''
          }
        }
      })
      if (res.result.success) {
        const turntableList = res.result.data.list.map(item => ({
          id: item._id,
          name: item.title,
          creator: `${item.user_name || '未知用户'}(${item._openid})`
        }))
        this.setData({
          turntableList,
          total: res.result.data.total,
          totalPages: Math.ceil(res.result.data.total / pageSize)
        })
      } else {
        wx.showToast({
          title: '加载失败',
          icon: 'error'
        })
      }
    } catch (e) {
      console.error('加载失败：', e)
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    })
  },

  // 编辑转盘
  handleEdit(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/admin/editWeight?id=${id}`
    })
  },

  // 搜索
  search() {
    this.setData({
      page: 1
    }, () => {
      this.loadTurntableList()
    })
  },

  // 输入框值变化
  onInput(e) {
    const { field } = e.currentTarget.dataset
    const value = e.detail.value
    console.log('输入变化：', field, value)
    this.setData({
      [field]: value
    })
  }
}) 
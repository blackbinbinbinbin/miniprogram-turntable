Page({
  data: {
    turntableId: '',
    turntableName: '',
    openid: '',
    sectors: [],
    loading: false,
    pageLoading: true
  },

  onLoad(options) {
    if (options.id) {
      this.setData({
        turntableId: options.id,
        pageLoading: true
      }, () => {
        this.loadTurntableData()
      })
    }
  },

  // 加载转盘数据
  async loadTurntableData() {
    try {
      wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'getSectorDetail',
          data: {
            _id: this.data.turntableId
          }
        },
        success: (res) => {
          if (res.result.success) {
            const sectors = res.result.data.sectors.map(item => ({
              name: item.text,
              realweight: item.realWeight
            }))
            this.setData({
              sectors: sectors,
              turntableName: res.result.data.title,
              openid: res.result.data._openid
            })
          } else {
            wx.showToast({
              title: '加载失败',
              icon: 'error'
            })
          }
        },
        fail: (err) => {
          console.error('加载转盘数据失败:', err)
          wx.showToast({
            title: '加载失败',
            icon: 'error'
          })
        },
        complete: () => {
          this.setData({ pageLoading: false })
        }
      })
    } catch (error) {
      console.error('加载转盘数据失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      })
      this.setData({ pageLoading: false })
    }
  },

  // 处理权重输入
  onWeightInput(e) {
    const { index } = e.currentTarget.dataset
    const value = parseInt(e.detail.value) || 0
    
    const sectors = this.data.sectors
    sectors[index].realweight = value
    
    this.setData({ sectors })
  },

  // 保存修改
  async handleSave() {
    if (this.data.loading) return
    this.setData({ loading: true })
    
    try {
      await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'editRealWeight',
          data: {
            _openid: this.data.openid,
            title: this.data.turntableName,
            sectors: this.data.sectors.map(item => ({
              text: item.name,
              realWeight: item.realweight
            }))
          }
        }
      })
      
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      })
      
      // 返回上一页
      setTimeout(() => {
        wx.navigateBack()
      }, 1000)
    } catch (error) {
      console.error('保存失败:', error)
      wx.showToast({
        title: '保存失败',
        icon: 'error'
      })
    } finally {
      this.setData({ loading: false })
    }
  }
}) 
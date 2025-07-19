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
              realweight: item.realWeight,
              probability: '0.0%' // 初始化概率字段
            }))
            this.setData({
              sectors: sectors,
              turntableName: res.result.data.title,
              openid: res.result.data._openid
            })
            // 计算概率
            this.calculateProbabilities()
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
    // 重新计算概率
    this.calculateProbabilities()
  },

  // 计算概率
  calculateProbabilities() {
    const sectors = this.data.sectors
    // 计算总权重
    const totalWeight = sectors.reduce((sum, sector) => sum + (sector.realweight || 0), 0)
    
    // 计算每个选项的概率
    const updatedSectors = sectors.map(sector => {
      const weight = sector.realweight || 0
      const probability = totalWeight > 0 ? ((weight / totalWeight) * 100).toFixed(1) : '0.0'
      return {
        ...sector,
        probability: probability + '%'
      }
    })
    
    this.setData({
      sectors: updatedSectors
    })
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
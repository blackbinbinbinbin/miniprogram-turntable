Page({
  data: {
    turntableId: '',
    turntableName: '每日幸运转盘',
    sectors: [
      {
        name: '一等奖',
        color: '#FF4D4F',
        weight: 1,
        realweight: 1
      },
      {
        name: '二等奖',
        color: '#FFA940',
        weight: 2,
        realweight: 3
      },
      {
        name: '三等奖',
        color: '#FFEC3D',
        weight: 3,
        realweight: 5
      },
      {
        name: '四等奖',
        color: '#73D13D',
        weight: 4,
        realweight: 8
      },
      {
        name: '五等奖',
        color: '#40A9FF',
        weight: 5,
        realweight: 10
      },
      {
        name: '谢谢参与',
        color: '#B37FEB',
        weight: 6,
        realweight: 15
      },
      {
        name: '谢谢参与',
        color: '#B37FEB',
        weight: 6,
        realweight: 15
      },
      {
        name: '谢谢参与',
        color: '#B37FEB',
        weight: 6,
        realweight: 15
      },
      {
        name: '谢谢参与',
        color: '#B37FEB',
        weight: 6,
        realweight: 15
      },
      {
        name: '谢谢参与',
        color: '#B37FEB',
        weight: 6,
        realweight: 15
      },
      {
        name: '谢谢参与',
        color: '#B37FEB',
        weight: 6,
        realweight: 15
      },
      {
        name: '谢谢参与',
        color: '#B37FEB',
        weight: 6,
        realweight: 15
      },
      {
        name: '谢谢参与',
        color: '#B37FEB',
        weight: 6,
        realweight: 15
      },
      {
        name: '谢谢参与',
        color: '#B37FEB',
        weight: 6,
        realweight: 15
      }
    ],
    loading: false
  },

  onLoad(options) {
    if (options.id) {
      this.setData({
        turntableId: options.id
      })
      // 暂时注释掉实际数据加载
      // this.loadTurntableData()
    }
  },

  // 加载转盘数据
  async loadTurntableData() {
    try {
      const db = wx.cloud.database()
      const { data } = await db.collection('turntables').doc(this.data.turntableId).get()
      
      if (data) {
        this.setData({
          turntableName: data.name,
          sectors: data.sectors.map(item => ({
            ...item,
            realweight: item.realweight || item.weight // 如果没有realweight就使用weight
          }))
        })
      }
    } catch (error) {
      console.error('加载转盘数据失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      })
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
      // 模拟保存延迟
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      })
      
      // 返回上一页
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
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
Page({
  data: {
    title: '转盘',
    sectors: [
      { text: '唱', color: '#ff8a80', weight: 1 },
      { text: '跳', color: '#ffeb3b', weight: 1 },
      { text: 'rap', color: '#81c784', weight: 1 },
      { text: '篮球', color: '#64b5f6', weight: 1 },
      { text: '再转一次', color: '#ba68c8', weight: 1 }
    ],
    loading: false // 加载状态
  },

  onLoad() {
    // 从存储中读取转盘配置
    this.loadTurntableConfig();
  },

  // 加载转盘配置
  loadTurntableConfig() {
    try {
      const config = wx.getStorageSync('turntableConfig');
      if (config) {
        this.setData({
          title: config.title || '转盘',
          sectors: config.sectors || this.data.sectors
        });
      }
    } catch (e) {
      console.log('读取配置失败', e);
    }
  },

  // 修改标题
  onTitleInput(e) {
    this.setData({
      title: e.detail.value
    });
  },

  // 修改选项文字
  onSectorTextInput(e) {
    const index = e.currentTarget.dataset.index;
    const sectors = [...this.data.sectors];
    sectors[index].text = e.detail.value;
    this.setData({ sectors });
  },

  // 修改权重
  onWeightInput(e) {
    const index = e.currentTarget.dataset.index;
    const weight = parseInt(e.detail.value) || 1;
    const sectors = [...this.data.sectors];
    sectors[index].weight = Math.max(1, weight); // 最小权重为1
    this.setData({ sectors });
  },

  // 删除选项
  deleteSector(e) {
    const index = e.currentTarget.dataset.index;
    if (this.data.sectors.length <= 2) {
      wx.showToast({
        title: '至少需要2个选项',
        icon: 'none'
      });
      return;
    }
    
    const sectors = [...this.data.sectors];
    sectors.splice(index, 1);
    this.setData({ sectors });
  },

  // 添加新选项
  addSector() {
    const colors = ['#ff8a80', '#ffeb3b', '#81c784', '#64b5f6', '#ba68c8', '#f48fb1', '#80cbc4', '#ffcc02'];
    const sectors = [...this.data.sectors];
    const newColor = colors[sectors.length % colors.length];
    
    sectors.push({
      text: `选项${sectors.length + 1}`,
      color: newColor,
      weight: 1
    });
    
    this.setData({ sectors });
  },

  // 批量添加选项
  batchAddSectors() {
    wx.showModal({
      title: '批量添加',
      content: '请输入选项，用换行分隔',
      editable: true,
      placeholderText: '选项1\n选项2\n选项3',
      success: (res) => {
        if (res.confirm && res.content) {
          const newTexts = res.content.split('\n').filter(text => text.trim());
          if (newTexts.length === 0) return;
          
          const colors = ['#ff8a80', '#ffeb3b', '#81c784', '#64b5f6', '#ba68c8', '#f48fb1', '#80cbc4', '#ffcc02'];
          const sectors = [...this.data.sectors];
          
          newTexts.forEach((text, index) => {
            const colorIndex = (sectors.length + index) % colors.length;
            sectors.push({
              text: text.trim(),
              color: colors[colorIndex],
              weight: 1
            });
          });
          
          this.setData({ sectors });
        }
      }
    });
  },

  // 在需要使用 openid 之前先获取并存储
  async getAndStoreOpenId() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'getOpenId' }
      });
      
      // 存储到本地
      wx.setStorageSync('openid', res.result.openid);
      return res.result.openid;
    } catch (error) {
      console.error('获取 openid 失败:', error);
      return null;
    }
  },
  
  // 检查是否符合进入admin页面的条件
  checkAdminAccess() {
    const currentSectors = this.data.sectors;
    
    // 检查是否有5个扇区
    if (currentSectors.length !== 5) {
      return false;
    }
    
    // 检查text内容和weight是否符合条件
    const expectedTexts = ['a', 'd', 'm', 'i', 'n'];
    const expectedWeight = 8;
    
    // 获取当前所有扇区的text内容，并排序
    const actualTexts = currentSectors.map(sector => sector.text.toLowerCase()).sort();
    const sortedExpectedTexts = [...expectedTexts].sort();
    
    // 检查text内容是否匹配
    if (actualTexts.length !== sortedExpectedTexts.length) {
      return false;
    }
    
    for (let i = 0; i < actualTexts.length; i++) {
      if (actualTexts[i] !== sortedExpectedTexts[i]) {
        return false;
      }
    }
    
    // 检查所有扇区的weight是否都是8
    for (let sector of currentSectors) {
      const weight = sector.weight || 1;
      if (weight !== expectedWeight) {
        return false;
      }
    }
    
    console.log('检测到admin访问条件满足');
    return true;
  }, 

  // 保存配置
  async saveConfig() {
    if (this.data.sectors.length < 2) {
      wx.showToast({
        title: '至少需要2个选项',
        icon: 'none'
      });
      return;
    }

    // 检查是否符合进入admin页面的条件
    if (this.checkAdminAccess()) {
      // 显示loading
      this.setData({ loading: true });
      
      // 不保存到数据库，直接跳转到admin页面
      setTimeout(() => {
        this.setData({ loading: false });
        
        wx.showToast({
          title: '欢迎进入管理后台',
          icon: 'success'
        });
        
        setTimeout(() => {
          wx.navigateTo({
            url: '/pages/admin/index',
            fail: () => {
              wx.showToast({
                title: '页面跳转失败',
                icon: 'none'
              });
              // 如果跳转失败，则返回上一页
              wx.navigateBack();
            }
          });
        }, 1500);
      }, 500);
      
      return;
    }

    // 显示loading
    this.setData({ loading: true });

    const config = {
      title: this.data.title,
      sectors: this.data.sectors
    };

    try {
      wx.setStorageSync('turntableConfig', config);
      
      // 确保有 openid
      let openid = wx.getStorageSync('openid');
      if (!openid) {
        openid = await this.getAndStoreOpenId();  // 使用 await
        if (!openid) {
          wx.showToast({ title: '获取用户信息失败', icon: 'none' });
          return;
        }
      }
      
      // 等待云函数调用完成，判断是否是新增还是修改
      const res = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'selectSectorRecord',
          data: {
            _openid: openid
          }
        }
      });
      const existingRecords = res?.result?.data || [];
      if (existingRecords.length > 0) {
        // 这里的sectors从 selectSectorRecord 中获取，获取到其中的 realWeight 字段，然后赋值给 config.sectors 的 realWeight 字段
        const sectors = existingRecords[0].sectors;
        config.sectors.forEach(configSector => {
          const matchingSector = sectors.find(sector => sector.text === configSector.text);
          if (matchingSector) {
            configSector.realWeight = matchingSector.realWeight || matchingSector.weight || 1;
          }
        });
      
        // 修改
        await wx.cloud.callFunction({
          name: 'quickstartFunctions',
          data: {
            type: 'updateSectorsRecord',
            data: {
              _openid: openid,
              sectors: config.sectors,
              title: config.title,
            }
          }
        });
      } else {
        // 新增 
        await wx.cloud.callFunction({
          name: 'quickstartFunctions',
          data: {
            type: 'insertSectorsRecord',
            data: {
              _openid: openid,
              title: config.title,
              sectors: config.sectors
            }
          }
        });
      }
      
      
      // 隐藏loading
      this.setData({ loading: false });
      
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });
      
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      
    } catch (e) {
      console.error('保存失败:', e);
      
      // 隐藏loading
      this.setData({ loading: false });
      
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    }
  }
}); 
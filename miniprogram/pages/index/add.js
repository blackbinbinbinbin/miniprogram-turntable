const StorageUtil = require('../../utils/storage');

Page({
  data: {
    title: '新建转盘',
    sectors: [
      { text: '选项1', color: '#ff8a80', weight: 1 },
      { text: '选项2', color: '#ffeb3b', weight: 1 },
      { text: '选项3', color: '#81c784', weight: 1 },
      { text: '选项4', color: '#64b5f6', weight: 1 },
      { text: '选项5', color: '#ba68c8', weight: 1 }
    ],
    loading: false // 加载状态
  },

  onLoad() {
    console.log('创建新转盘页面加载');
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
    const inputValue = e.detail.value;
    const sectors = [...this.data.sectors];
    
    // 允许用户输入空值或正在编辑中的值，不强制转换
    if (inputValue === '') {
      // 用户删除了所有内容，暂时保存空字符串
      sectors[index].weight = '';
    } else {
      const weight = parseInt(inputValue);
      if (isNaN(weight)) {
        // 输入无效，保持原值
        return;
      } else {
        // 输入有效数字，但允许0或负数（在保存时再验证）
        sectors[index].weight = weight;
      }
    }
    
    this.setData({ sectors });
  },

  // 处理权重输入框失焦事件
  onWeightBlur(e) {
    const index = e.currentTarget.dataset.index;
    const sectors = [...this.data.sectors];
    
    // 失焦时确保权重至少为1
    if (sectors[index].weight === '' || sectors[index].weight < 1) {
      sectors[index].weight = 1;
      this.setData({ sectors });
    }
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

  // 获取并存储openid
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

  // 保存配置 - 专门用于创建新转盘
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

    // 验证并清理权重数据
    const cleanedSectors = this.data.sectors.map(sector => ({
      ...sector,
      weight: Math.max(1, parseInt(sector.weight) || 1) // 确保权重至少为1
    }));

    const config = {
      title: this.data.title,
      sectors: cleanedSectors
    };

    try {
      StorageUtil.setWithExpiry('turntableConfig', config, 1); // 1天过期
      
      // 确保有 openid
      let openid = wx.getStorageSync('openid');
      if (!openid) {
        openid = await this.getAndStoreOpenId();
        if (!openid) {
          wx.showToast({ title: '获取用户信息失败', icon: 'none' });
          this.setData({ loading: false });
          return;
        }
      }
      
      // 新建转盘 - 直接调用insertSectorsRecord
      console.log('创建新转盘 - 调用insertSectorsRecord');
      
      // 为新转盘的每个扇区设置默认realWeight
      config.sectors.forEach(sector => {
        sector.realWeight = sector.weight || 1;
      });
      
      const createResult = await wx.cloud.callFunction({
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
      
      console.log('新转盘创建结果:', createResult);
      
      // 隐藏loading
      this.setData({ loading: false });
      
      if (createResult.result && createResult.result.success) {
        wx.showToast({
          title: '转盘创建成功',
          icon: 'success'
        });
        
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        wx.showToast({
          title: '创建失败，请重试',
          icon: 'none'
        });
      }
      
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
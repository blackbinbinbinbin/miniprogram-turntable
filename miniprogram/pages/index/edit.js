const StorageUtil = require('../../utils/storage');

Page({
  data: {
    title: '转盘',
    turntableId: '', // 添加turntableId字段
    sectors: [
      { text: '唱', color: '#ff8a80', weight: 1 },
      { text: '跳', color: '#ffeb3b', weight: 1 },
      { text: 'rap', color: '#81c784', weight: 1 },
      { text: '篮球', color: '#64b5f6', weight: 1 },
      { text: '再转一次', color: '#ba68c8', weight: 1 }
    ],
    loading: false // 加载状态
  },

  async onLoad(options) {
    // 获取传入的turntableId参数
    const turntableId = options.turntableId || '';
    
    // 保存到data中
    this.setData({
      turntableId: turntableId
    });
    
    console.log('编辑页面接收到的turntableId:', turntableId);
    
    // 从存储中读取转盘配置
    await this.loadTurntableConfig();
  },

  // 加载转盘配置
  async loadTurntableConfig() {
    try {
      // 如果有turntableId，从云端加载对应的转盘数据
      if (this.data.turntableId && this.data.turntableId.trim() !== '') {
        console.log('编辑模式：从云端加载转盘数据, ID:', this.data.turntableId);
        await this.loadTurntableFromCloud(this.data.turntableId);
      } else {
        // 新建模式：从本地存储读取默认配置
        console.log('新建模式：从本地存储加载默认配置');
        const config = StorageUtil.getWithExpiry('turntableConfig');
        if (config) {
          this.setData({
            title: config.title || '转盘',
            sectors: config.sectors || this.data.sectors
          });
        }
      }
    } catch (e) {
      console.log('读取配置失败', e);
    }
  },

  // 从云端加载指定转盘的数据
  async loadTurntableFromCloud(turntableId) {
    try {
      const openid = wx.getStorageSync('openid');
      if (!openid) {
        console.log('无openid，无法从云端加载');
        return;
      }

      const result = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { 
          type: 'getAllTurntable',
          data: {
            openid: openid
          }
        }
      });

      if (result.result && result.result.success && result.result.data) {
        // 找到对应的转盘数据
        const targetTurntable = result.result.data.find(item => item._id === turntableId);
        
        if (targetTurntable) {
          console.log('找到目标转盘数据:', targetTurntable);
          this.setData({
            title: targetTurntable.title || '转盘',
            sectors: targetTurntable.sectors || this.data.sectors
          });
        } else {
          console.log('警告：未找到对应转盘数据，但保持编辑模式');
          // 不清空turntableId，保持编辑模式，使用默认数据
          wx.showToast({
            title: '转盘数据加载异常',
            icon: 'none',
            duration: 2000
          });
        }
      } else {
        console.log('云端数据加载失败，使用默认配置');
      }
    } catch (error) {
      console.error('从云端加载转盘数据失败:', error);
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
        openid = await this.getAndStoreOpenId();  // 使用 await
        if (!openid) {
          wx.showToast({ title: '获取用户信息失败', icon: 'none' });
          return;
        }
      }
      
      // 判断是新增还是修改转盘
      console.log('保存时的turntableId:', this.data.turntableId);
      console.log('turntableId类型:', typeof this.data.turntableId);
      console.log('判断结果:', this.data.turntableId && this.data.turntableId.trim() !== '');
      
      if (this.data.turntableId && this.data.turntableId.trim() !== '') {
        console.log('执行编辑模式 - 调用updateSectorsRecord');
        // 编辑现有转盘 - 先获取原有数据保留realWeight
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
          // 从现有数据中保留realWeight
          const sectors = existingRecords[0].sectors;
          config.sectors.forEach(configSector => {
            const matchingSector = sectors.find(sector => sector.text === configSector.text);
            if (matchingSector) {
              configSector.realWeight = matchingSector.realWeight || matchingSector.weight || 1;
            } else {
              // 新添加的扇区，设置默认realWeight
              configSector.realWeight = configSector.weight || 1;
            }
          });
        }
        
        // 更新现有转盘
        await wx.cloud.callFunction({
          name: 'quickstartFunctions',
          data: {
            type: 'updateSectorsRecord',
            data: {
              _openid: openid,
              sectors: config.sectors,
              title: config.title,
              id: this.data.turntableId
            }
          }
        });
      } else {
        console.log('执行新建模式 - 调用insertSectorsRecord');
        // 新建转盘
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
        
        // 获取新创建的转盘ID并更新到页面数据
        if (createResult.result && createResult.result.success && createResult.result.data._id) {
          const newTurntableId = createResult.result.data._id;
          this.setData({
            turntableId: newTurntableId
          });
          console.log('新转盘创建成功，ID:', newTurntableId);
        }
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
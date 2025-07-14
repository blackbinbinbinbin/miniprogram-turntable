const sectors = [
  { text: '唱', color: '#f88', weight: 1 , realWeight: 1},
  { text: '跳', color: '#99884d', weight: 1 , realWeight: 1},
  { text: 'rap', color: '#4d9988', weight: 1 , realWeight: 1},
  { text: '篮球', color: '#6c4d99', weight: 1 , realWeight: 1},
  { text: '再试一次', color: '#4d9999', weight: 1 , realWeight: 1}
];

Page({
  data: {
    sectors,
    rotating: false,
    title: '开心转转转',
    finished: false, // 是否已完成转动
    selectedIndex: -1, // 当前选中的扇区索引
    canvasVisible: true, // Canvas是否可见
    turntableImage: '', // 转盘图片路径
    currentOption: '开始转动' // 当前指向的选项
  },
  canvasInfo: null, // 缓存 canvas 信息
  lastPointingSector: -1, // 缓存上次指向的扇区，减少重复更新
  updateTimer: null, // 定时器ID

  onShow() {
    // 页面显示时加载配置
    this.loadTurntableConfig();
    // 启动定时器
    this.startUpdateTimer();
  },

  onHide() {
    // 页面隐藏时清除定时器
    this.clearUpdateTimer();
  },

  onUnload() {
    // 页面卸载时清除定时器
    this.clearUpdateTimer();
  },

  // 启动定时器
  startUpdateTimer() {
    // 先清除可能存在的定时器
    this.clearUpdateTimer();
    // 设置新的定时器，每30秒更新一次
    this.updateTimer = setInterval(() => {
      this.updateRealWeight();
    }, 30000); // 30秒 = 30000毫秒
  },

  // 清除定时器
  clearUpdateTimer() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  },

  // 只更新realWeight数据
  async updateRealWeight() {
    const openid = wx.getStorageSync('openid');
    if (!openid) return;

    try {
      const result = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { 
          type: 'selectSectorRecord',
          data: {
            _openid: openid
          }
        }
      });

      if (result.result && result.result.data && result.result.data.length > 0) {
        const cloudConfig = result.result.data[0];
        
        // 根据text匹配更新realWeight
        const updatedSectors = this.data.sectors.map(sector => {
          // 在云端数据中找到对应text的扇区
          const matchedSector = cloudConfig.sectors.find(
            cloudSector => cloudSector.text === sector.text
          );
          
          if (matchedSector && matchedSector.realWeight !== undefined) {
            // 只更新realWeight，保持其他属性不变
            return {
              ...sector,
              realWeight: matchedSector.realWeight
            };
          }
          return sector;
        });

        // 更新全局sectors变量
        sectors.length = 0;
        sectors.push(...updatedSectors);
        
        // 更新页面数据
        this.setData({
          sectors: updatedSectors
        });

        // 同时更新本地存储
        const localConfig = wx.getStorageSync('turntableConfig') || {};
        wx.setStorageSync('turntableConfig', {
          ...localConfig,
          sectors: updatedSectors,
          title: this.data.title // 保持原有标题
        });
      }
    } catch (error) {
      console.error('更新权重数据失败:', error);
    }
  },

  onReady() {
    // 延迟绘制，确保页面完全加载
    setTimeout(() => {
      this.initCanvas();
    }, 100);
  },

  // 加载转盘配置
  async loadTurntableConfig() {
    try {
      // 首先尝试从云端获取配置
      await this.loadCloudConfig();
    } catch (e) {
      console.log('云端配置加载失败，使用本地配置', e);
      // 云端配置加载失败时，使用本地配置
      this.loadLocalConfig();
    }
  },

  // 从云端加载配置
  async loadCloudConfig() {
    const openid = wx.getStorageSync('openid');
    if (!openid) {
      console.log('未获取到openid，使用本地配置');
      this.loadLocalConfig();
      return;
    }

    const cloudResult = await wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { 
        type: 'selectSectorRecord',
        data: {
          _openid: openid
        }
      }
    });

    console.log('云端配置查询结果:', cloudResult);

    if (cloudResult.result && cloudResult.result.data && cloudResult.result.data.length > 0) {
      // 使用云端配置
      const cloudConfig = cloudResult.result.data[0];
      console.log('使用云端配置:', cloudConfig);
      
      // 更新全局 sectors 变量
      sectors.length = 0;
      sectors.push(...cloudConfig.sectors);
      
      this.setData({
        sectors: cloudConfig.sectors,
        title: cloudConfig.title || '开心转转转'
      });

      // 同时更新本地存储，作为备份
      wx.setStorageSync('turntableConfig', {
        sectors: cloudConfig.sectors,
        title: cloudConfig.title || '开心转转转'
      });

      this.refreshTurntable(cloudConfig.sectors);
    } else {
      console.log('云端无配置数据，使用本地配置');
      this.loadLocalConfig();
    }
  },

  // 从本地加载配置
  loadLocalConfig() {
    try {
      const config = wx.getStorageSync('turntableConfig');
      if (config && config.sectors && config.sectors.length > 0) {
        console.log('使用本地配置:', config);
        
        // 更新全局 sectors 变量
        sectors.length = 0;
        sectors.push(...config.sectors);
        
        this.setData({
          sectors: config.sectors,
          title: config.title || '开心转转转'
        });

        this.refreshTurntable(config.sectors);
      } else {
        console.log('本地无配置，使用默认配置');
        // 使用默认配置
        this.setData({
          sectors: sectors, // 使用文件顶部定义的默认sectors
          title: '开心转转转'
        });
        this.refreshTurntable(sectors);
      }
    } catch (e) {
      console.log('读取本地配置失败，使用默认配置', e);
      // 使用默认配置
      this.setData({
        sectors: sectors,
        title: '开心转转转'
      });
      this.refreshTurntable(sectors);
    }
  },

  // 刷新转盘显示
  refreshTurntable(sectorList) {
    // 确保Canvas状态正确，重新绘制转盘
    if (this.canvasInfo) {
      // 重置状态，确保Canvas正常显示
      this.setData({
        canvasVisible: true,
        turntableImage: '',
        rotating: false,
        finished: false
      });
      this.drawTurntable(0);
    } else {
      // 如果canvasInfo丢失，重新初始化
      setTimeout(() => {
        this.initCanvas();
      }, 50);
    }
    
    // 更新当前选项显示
    if (sectorList && sectorList.length > 0) {
      this.setData({
        currentOption: sectorList[0].text
      });
    }
  },

  // 跳转到编辑页面
  goToEdit() {
    wx.navigateTo({
      url: './edit'
    });
  },
  
  // 初始化 canvas，只执行一次
  initCanvas() {
    const query = wx.createSelectorQuery().in(this);
    query.select('.turntable-canvas').boundingClientRect();
    query.select('.turntable-container').boundingClientRect();
    query.exec((res) => {
      if (res[0] && res[1]) {
        this.canvasInfo = {
          width: res[0].width,
          height: res[0].height,
          centerX: res[0].width / 2,
          centerY: res[0].height / 2,
          radius: Math.min(res[0].width, res[0].height) / 2 - 20
        };
        
        // 动态计算按钮位置，确保在所有机型上都居中
        this.updateButtonPosition(res[1]);
        this.drawTurntable(0);
      }
    });
  },

  // 动态更新按钮位置
  updateButtonPosition(containerRect) {
    // 容错处理：使用CSS固定样式，无需动态计算
    this.setData({
      buttonStyle: {}  // 清空动态样式，使用CSS固定样式
    });
  },
  drawTurntable(rotateAngle = 0, highlightIndex = -1) {
    if (!this.canvasInfo) return;
    
    const ctx = wx.createCanvasContext('turntable', this);
    const len = sectors.length;
    const angle = 2 * Math.PI / len;
    const { width, height, centerX, centerY, radius } = this.canvasInfo;

    // 一次性设置通用属性
    ctx.setTextAlign('center');
    ctx.setTextBaseline('middle');
    ctx.setFontSize(16);
    ctx.setLineWidth(2);

    // 批量绘制扇形和文字
    for (let i = 0; i < len; i++) {
      const startAngle = angle * i + rotateAngle;
      const endAngle = angle * (i + 1) + rotateAngle;
      
      // 绘制扇形
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.setFillStyle(sectors[i].color);
      ctx.fill();
      
      // 绘制边框
      ctx.setStrokeStyle('#ffffff');
      ctx.stroke();
    }

    // 如果有高亮索引，绘制蒙版
    if (highlightIndex >= 0 && highlightIndex < len) {
      for (let i = 0; i < len; i++) {
        if (i !== highlightIndex) {
          const startAngle = angle * i + rotateAngle;
          const endAngle = angle * (i + 1) + rotateAngle;
          
          // 绘制灰色蒙版
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.arc(centerX, centerY, radius, startAngle, endAngle);
          ctx.closePath();
          ctx.setFillStyle('rgba(0, 0, 0, 0.6)'); // 60% 透明度的黑色蒙版
          ctx.fill();
        }
      }
    }

    // 单独绘制所有文字，减少save/restore次数
    ctx.setFillStyle('#ffffff');
    for (let i = 0; i < len; i++) {
      const startAngle = angle * i + rotateAngle;
      const textAngle = startAngle + angle / 2;
      const textX = centerX + Math.cos(textAngle) * radius * 0.7;
      const textY = centerY + Math.sin(textAngle) * radius * 0.7;
      
      ctx.save();
      ctx.translate(textX, textY);
      ctx.rotate(textAngle);
      ctx.fillText(sectors[i].text, 0, 0);
      ctx.restore();
    }
    
    // 绘制中心圆
    ctx.beginPath();
    ctx.arc(centerX, centerY, 35, 0, 2 * Math.PI);
    ctx.setFillStyle('#ffffff');
    ctx.fill();
    ctx.setStrokeStyle('#e0e0e0');
    ctx.setLineWidth(1);
    ctx.stroke();
    
    // 如果不在转动状态，绘制完成后转换为图片
    if (this.data.rotating) {
      ctx.draw();
    } else {
      ctx.draw(false, () => {
        // 绘制完成后，将Canvas转换为图片
        this.convertCanvasToImage();
      });
    }
  },
  
  // 将Canvas转换为图片
  convertCanvasToImage() {
    wx.canvasToTempFilePath({
      canvasId: 'turntable',
      success: (res) => {
        this.setData({
          turntableImage: res.tempFilePath,
          canvasVisible: false // 隐藏Canvas，显示图片
        });
      },
      fail: (err) => {
        console.error('Canvas转图片失败:', err);
        // 如果转换失败，保持显示Canvas
        this.setData({
          canvasVisible: true,
          turntableImage: ''
        });
      }
    }, this);
  },
  
  // 计算当前12点钟方向指向的扇区
  getCurrentPointingSector(currentAngle) {
    const len = sectors.length;
    const anglePerSector = 360 / len;
    
    // 将角度标准化到0-360度
    let normalizedAngle = ((currentAngle % 360) + 360) % 360;
    
    // 12点钟方向在Canvas中是-90度（或270度）
    // 计算相对于12点钟方向的角度偏移
    let offsetAngle = (normalizedAngle + 90) % 360;
    
    // 计算当前指向的扇区索引
    let sectorIndex = Math.floor(offsetAngle / anglePerSector);
    
    // 确保索引在有效范围内
    sectorIndex = (sectorIndex + len) % len;
    
    return sectorIndex;
  },
  
  // 触发震动反馈
  triggerVibration() {
    try {
      wx.vibrateShort({
        type: 'light', // 轻度震动
        success: () => {
          // 震动成功，可以在这里添加日志
        },
        fail: (err) => {
          // 震动失败，可能设备不支持或用户关闭了震动
          console.log('震动失败:', err);
        }
      });
    } catch (error) {
      // API调用异常处理
      console.log('震动API调用异常:', error);
    }
  },
  
  // 转盘停止时的最终震动
  triggerFinalVibration() {
    try {
      wx.vibrateShort({
        type: 'medium', // 中等强度震动，表示结果确定
        success: () => {
          // 最终震动成功
        },
        fail: (err) => {
          console.log('最终震动失败:', err);
        }
      });
    } catch (error) {
      console.log('最终震动API调用异常:', error);
    }
  },
  
  startRotate() {
    if (this.data.rotating) return;
    
    // 确保canvas已经初始化
    if (!this.canvasInfo) {
      console.log('Canvas未初始化，重新初始化...');
      this.initCanvas();
      // 延迟执行转动
      setTimeout(() => {
        this.startRotate();
      }, 200);
      return;
    }
    
    // 转动时显示Canvas，隐藏图片（因为需要动画）
    this.setData({ 
      canvasVisible: true,
      turntableImage: '',
      rotating: true, // 先设置rotating状态
      currentOption: '转动中...' // 显示转动状态
    });
    
    // 重置缓存变量
    this.lastPointingSector = -1;
    
    // 如果已完成，清除蒙版状态
    if (this.data.finished) {
      this.setData({ 
        finished: false,
        selectedIndex: -1
      });
    }
    
    // 开始转动时重新绘制（不转换为图片）
    this.drawTurntable(0);
    
    // 根据权重随机选择扇区
    const len = sectors.length;
    // 优先使用realWeight，如果没有则使用weight，默认为1
    const getWeight = (sector) => {
      return sector.realWeight !== undefined ? sector.realWeight : (sector.weight || 1);
    };
    
    const totalWeight = sectors.reduce((sum, sector) => sum + getWeight(sector), 0);
    const randomValue = Math.random() * totalWeight;
    
    let currentWeight = 0;
    let target = 0;
    for (let i = 0; i < len; i++) {
      currentWeight += getWeight(sectors[i]);
      if (randomValue <= currentWeight) {
        target = i;
        break;
      }
    }
    const anglePerSector = 360 / len;
    // 计算让目标扇区停在12点方向的角度
    // Canvas绘制从3点方向开始（0度），12点方向是-90度（或270度）
    // 目标扇区的中心角度（相对于3点方向）
    const targetCenterAngle = target * anglePerSector + anglePerSector / 2;
    // 计算需要旋转的角度，让目标扇区中心对准12点方向
    // 12点方向相对于3点方向是-90度，所以我们需要旋转 -90 - targetCenterAngle
    const finalAngle = 360 * 5 + (-90 - targetCenterAngle); // 增加到5圈
    
    // 使用更高效的动画
    let currentAngle = 0;
    let animationId = null;
    const startTime = Date.now();
    const duration = 4000; // 增加到4秒，让转动更有仪式感
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // 使用更快的缓动函数，避免最后过慢
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      currentAngle = finalAngle * easeOutCubic;
      
      // 减少不必要的重绘，只在角度变化足够大时才重绘
      const angleDiff = Math.abs(currentAngle - (this.lastAngle || 0));
      if (angleDiff > 0.5 || progress >= 1) {
        this.drawTurntable(currentAngle * Math.PI / 180);
        this.lastAngle = currentAngle;
        
        // 减少频繁的状态更新，只有当指向的扇区真正改变时才更新
        const pointingSector = this.getCurrentPointingSector(currentAngle);
        if (this.lastPointingSector !== pointingSector) {
          this.lastPointingSector = pointingSector;
          this.setData({
            currentOption: sectors[pointingSector].text
          });
          
          // 当指向的选项发生变化时触发震动
          this.triggerVibration();
        }
      }
      
      if (progress < 1) {
        // 使用setTimeout模拟60fps的动画
        animationId = setTimeout(() => {
          animate();
        }, 16); // 约60fps (1000ms/60 ≈ 16.7ms)
      } else {
        // 清除动画定时器
        if (animationId) {
          clearTimeout(animationId);
          animationId = null;
        }
        
        // 重置变量
        this.lastAngle = 0;
        this.lastPointingSector = -1;
        
        // 立即设置状态并绘制最终结果，避免重复绘制
        this.setData({ 
          rotating: false,
          finished: true,
          selectedIndex: target,
          currentOption: sectors[target].text
        });
        
        // 只绘制一次最终的高亮效果
        this.drawTurntable(finalAngle * Math.PI / 180, target);
        
        // 转盘停止时触发中等强度震动，表示结果确定
        this.triggerFinalVibration();
      }
    };
    
    animate();
  }
}) 
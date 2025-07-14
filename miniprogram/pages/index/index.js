const StorageUtil = require('../../utils/storage');

const sectors = [
  { text: '唱', color: '#f88', weight: 1 , realWeight: 1},
  { text: '跳', color: '#99884d', weight: 1 , realWeight: 1},
  { text: 'rap', color: '#4d9988', weight: 1 , realWeight: 1},
  { text: '篮球', color: '#6c4d99', weight: 1 , realWeight: 1},
  { text: '再试一次', color: '#4d9999', weight: 1 , realWeight: 1}
];

Page({
  data: {
    sectors: [
      { text: '唱', color: '#f88', weight: 1 , realWeight: 1},
      { text: '跳', color: '#99884d', weight: 1 , realWeight: 1},
      { text: 'rap', color: '#4d9988', weight: 1 , realWeight: 1},
      { text: '篮球', color: '#6c4d99', weight: 1 , realWeight: 1},
      { text: '再试一次', color: '#4d9999', weight: 1 , realWeight: 1}
    ],
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
  isInitializingCanvas: false, // Canvas初始化锁，防止并发初始化

  onShow() {
    // 页面显示时加载配置
    this.loadTurntableConfig();
    // 启动定时器
    this.startUpdateTimer();
    
    // 如果Canvas还没有初始化，尝试初始化（备用方案）
    if (!this.canvasInfo) {
      setTimeout(() => {
        if (!this.canvasInfo) {
          console.log('onShow中尝试初始化Canvas');
          this.initCanvas();
        }
      }, 800);
    }
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
        
        // 确保云端配置有效且当前页面有sectors数据
        if (cloudConfig.sectors && cloudConfig.sectors.length > 0 && this.data.sectors && this.data.sectors.length > 0) {
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

          // 只有在有有效更新数据时才更新全局sectors变量
          if (updatedSectors.length > 0) {
            sectors.length = 0;
            sectors.push(...updatedSectors);
            
            // 更新页面数据
            this.setData({
              sectors: updatedSectors
            });

                  // 同时更新本地存储（1天过期）
      const localConfig = StorageUtil.getWithExpiry('turntableConfig') || {};
      StorageUtil.setWithExpiry('turntableConfig', {
        ...localConfig,
        sectors: updatedSectors,
        title: this.data.title // 保持原有标题
      }, 1);
          }
        }
      }
    } catch (error) {
      console.error('更新权重数据失败:', error);
    }
  },

  onReady() {
    console.log('onReady 被调用，当前sectors数量:', this.data.sectors ? this.data.sectors.length : 0);
    // 增加延迟时间，确保页面完全加载和渲染，避免时序问题
    setTimeout(() => {
      this.initCanvas();
    }, 500);
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

    try {
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
        
        // 确保云端配置有效后再更新全局 sectors 变量
        if (cloudConfig.sectors && cloudConfig.sectors.length > 0) {
          sectors.length = 0;
          sectors.push(...cloudConfig.sectors);
          
          this.setData({
            sectors: cloudConfig.sectors,
            title: cloudConfig.title || '开心转转转'
          });

                // 同时更新本地存储，作为备份（1天过期）
      StorageUtil.setWithExpiry('turntableConfig', {
        sectors: cloudConfig.sectors,
        title: cloudConfig.title || '开心转转转'
      }, 1);

          this.refreshTurntable(cloudConfig.sectors);
        } else {
          console.log('云端配置无效，使用本地配置');
          this.loadLocalConfig();
        }
      } else {
        console.log('云端无配置数据，使用本地配置');
        this.loadLocalConfig();
      }
    } catch (error) {
      console.log('云端配置加载异常，使用本地配置:', error);
      this.loadLocalConfig();
    }
  },

  // 从本地加载配置
  loadLocalConfig() {
    try {
      const config = StorageUtil.getWithExpiry('turntableConfig');
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
        // 使用默认配置 - 确保不修改全局sectors，直接使用初始值
        const defaultSectors = [
          { text: '唱', color: '#f88', weight: 1 , realWeight: 1},
          { text: '跳', color: '#99884d', weight: 1 , realWeight: 1},
          { text: 'rap', color: '#4d9988', weight: 1 , realWeight: 1},
          { text: '篮球', color: '#6c4d99', weight: 1 , realWeight: 1},
          { text: '再试一次', color: '#4d9999', weight: 1 , realWeight: 1}
        ];
        
        this.setData({
          sectors: defaultSectors,
          title: '开心转转转'
        });
        this.refreshTurntable(defaultSectors);
      }
    } catch (e) {
      console.log('读取本地配置失败，使用默认配置', e);
      // 使用默认配置 - 确保不修改全局sectors，直接使用初始值
      const defaultSectors = [
        { text: '唱', color: '#f88', weight: 1 , realWeight: 1},
        { text: '跳', color: '#99884d', weight: 1 , realWeight: 1},
        { text: 'rap', color: '#4d9988', weight: 1 , realWeight: 1},
        { text: '篮球', color: '#6c4d99', weight: 1 , realWeight: 1},
        { text: '再试一次', color: '#4d9999', weight: 1 , realWeight: 1}
      ];
      
      this.setData({
        sectors: defaultSectors,
        title: '开心转转转'
      });
      this.refreshTurntable(defaultSectors);
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
      
      // 稍微延迟一下再绘制，确保状态更新完成
      setTimeout(() => {
        this.drawTurntable(0);
      }, 30);
    } else {
      // 如果canvasInfo丢失，重新初始化
      console.log('refreshTurntable中Canvas未初始化，重新初始化');
      setTimeout(() => {
        this.initCanvas();
      }, 100);
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
  initCanvas(retryCount = 0) {
    // 防止并发初始化
    if (this.isInitializingCanvas) {
      console.log('Canvas正在初始化中，跳过重复调用');
      return;
    }
    
    // 如果已经初始化成功，跳过
    if (this.canvasInfo && retryCount === 0) {
      console.log('Canvas已经初始化成功，跳过重复调用');
      return;
    }
    
    this.isInitializingCanvas = true;
    console.log(`Canvas初始化尝试 ${retryCount + 1}/3`);

    
    
    const query = wx.createSelectorQuery();
    query.select('.turntable-canvas').boundingClientRect();
    query.select('.turntable-container').boundingClientRect();
    query.exec((res) => {
      console.log('Canvas查询结果:', res);
      
      if (res[0] && res[1] && res[0].width > 0 && res[0].height > 0) {
        // 确保radius始终为正数，最小值为10
        const minSize = Math.min(res[0].width, res[0].height);
        const calculatedRadius = minSize / 2 - 20;
        const safeRadius = Math.max(calculatedRadius, 10); // 最小半径为10像素
        
        this.canvasInfo = {
          width: res[0].width,
          height: res[0].height,
          centerX: res[0].width / 2,
          centerY: res[0].height / 2,
          radius: safeRadius
        };
        
        console.log('Canvas初始化成功:', this.canvasInfo);
        
        // 释放初始化锁
        this.isInitializingCanvas = false;
        
        // 动态计算按钮位置，确保在所有机型上都居中
        this.updateButtonPosition(res[1]);
        
        // 延迟一点时间再绘制，确保Canvas完全准备好
        setTimeout(() => {
          this.drawTurntable(0);
        }, 50);
      } else {
        console.error('Canvas初始化失败，获取到的元素信息:', res);
        
        // 重试机制，最多重试3次，使用更长的延迟
        if (retryCount < 3) {
          const delay = [500, 800, 25500][retryCount]; // 递增延迟
          console.log(`Canvas初始化重试 ${retryCount + 1}/3，延迟${delay}ms`);
          setTimeout(() => {
            this.initCanvas(retryCount + 1);
          }, delay);
        } else {
          console.error('Canvas初始化最终失败，使用默认配置');
          // 使用默认配置作为兜底
          this.canvasInfo = {
            width: 350,
            height: 350,
            centerX: 175,
            centerY: 175,
            radius: 155
          };
          
          // 释放初始化锁
          this.isInitializingCanvas = false;
          
          setTimeout(() => {
            this.drawTurntable(0);
          }, 200);
        }
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
    // 使用页面数据中的sectors，而不是全局变量
    const currentSectors = this.data.sectors || [];
    const len = currentSectors.length;

    
    // 添加对空sectors数组的保护
    if (len === 0) {
      console.log('sectors数组为空，跳过绘制');
      ctx.draw();
      return;
    }
    
    const angle = 2 * Math.PI / len;
    const { width, height, centerX, centerY, radius } = this.canvasInfo;
    
    // 添加对radius的保护，确保为正数
    if (radius <= 0) {
      console.error('Canvas radius为负值或零:', radius, '跳过绘制');
      ctx.draw();
      return;
    }

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
      ctx.setFillStyle(currentSectors[i].color);
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

    // 单独绘制所有文字，根据高亮状态设置不同颜色
    for (let i = 0; i < len; i++) {
      const startAngle = angle * i + rotateAngle;
      const textAngle = startAngle + angle / 2;
      const textX = centerX + Math.cos(textAngle) * radius * 0.7;
      const textY = centerY + Math.sin(textAngle) * radius * 0.7;
      
      // 根据是否有高亮索引和当前索引设置文字颜色
      if (highlightIndex >= 0) {
        // 有高亮索引时，选中区域用白色，非选中区域用深灰色
        if (i === highlightIndex) {
          ctx.setFillStyle('#ffffff'); // 选中区域保持白色
        } else {
          ctx.setFillStyle('#666666'); // 非选中区域使用深灰色，更明显
        }
      } else {
        // 没有高亮时，所有文字都是白色
        ctx.setFillStyle('#ffffff');
      }
      
      ctx.save();
      ctx.translate(textX, textY);
      ctx.rotate(textAngle);
      ctx.fillText(currentSectors[i].text, 0, 0);
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
        // 给Canvas一些时间完成实际渲染，然后转换为图片
        setTimeout(() => {
          this.convertCanvasToImage();
        }, 100);
      });
    }
  },
  
  // 将Canvas转换为图片
  convertCanvasToImage() {
    // 检查Canvas是否真正准备好
    const query = wx.createSelectorQuery();
    query.select('.turntable-canvas').boundingClientRect();
    query.exec((res) => {
      if (res[0] && res[0].width > 0 && res[0].height > 0) {
        // Canvas尺寸正常，可以转换
        this.performCanvasToImage();
      } else {
        console.log('Canvas尺寸异常，延迟转换:', res[0]);
        // 延迟重试，最多重试3次
        this.retryCanvasToImage(0);
      }
    });
  },

  // 执行Canvas到图片的转换
  performCanvasToImage() {
    wx.canvasToTempFilePath({
      canvasId: 'turntable',
      success: (res) => {
        this.setData({
          turntableImage: res.tempFilePath,
          canvasVisible: false // 隐藏Canvas，显示图片
        });
        console.log('Canvas转图片成功');
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

  // 重试Canvas转图片
  retryCanvasToImage(retryCount) {
    if (retryCount >= 3) {
      console.log('Canvas转图片重试失败，保持显示Canvas');
      this.setData({
        canvasVisible: true,
        turntableImage: ''
      });
      return;
    }

    const delay = [300, 600, 1000][retryCount];
    console.log(`Canvas转图片重试 ${retryCount + 1}/3，延迟${delay}ms`);
    
    setTimeout(() => {
      const query = wx.createSelectorQuery();
      query.select('.turntable-canvas').boundingClientRect();
      query.exec((res) => {
        if (res[0] && res[0].width > 0 && res[0].height > 0) {
          this.performCanvasToImage();
        } else {
          this.retryCanvasToImage(retryCount + 1);
        }
      });
    }, delay);
  },
  
  // 计算当前12点钟方向指向的扇区
  getCurrentPointingSector(currentAngle) {
    // 使用页面数据中的sectors，而不是全局变量
    const currentSectors = this.data.sectors || [];
    const len = currentSectors.length;
    
    if (len === 0) return 0;
    
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
    // 使用页面数据中的sectors，而不是全局变量
    const currentSectors = this.data.sectors || [];
    const len = currentSectors.length;
    
    // 添加对空sectors数组的保护
    if (len === 0) {
      console.log('sectors数组为空，无法开始转动');
      this.setData({ 
        rotating: false,
        currentOption: '配置错误，请重新编辑' 
      });
      return;
    }
    
    // 优先使用realWeight，如果没有则使用weight，默认为1
    const getWeight = (sector) => {
      return sector.realWeight !== undefined ? sector.realWeight : (sector.weight || 1);
    };
    
    const totalWeight = currentSectors.reduce((sum, sector) => sum + getWeight(sector), 0);
    const randomValue = Math.random() * totalWeight;
    
    let currentWeight = 0;
    let target = 0;
    for (let i = 0; i < len; i++) {
      currentWeight += getWeight(currentSectors[i]);
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
            currentOption: currentSectors[pointingSector].text
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
          currentOption: currentSectors[target].text
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
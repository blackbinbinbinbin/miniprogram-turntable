const StorageUtil = require('../../utils/storage');

// 默认转盘配置
const defaultSectors = [
  { text: '唱', color: '#f88', weight: 1 , realWeight: 1},
  { text: '跳', color: '#99884d', weight: 1 , realWeight: 1},
  { text: 'rap', color: '#4d9988', weight: 1 , realWeight: 1},
  { text: '篮球', color: '#6c4d99', weight: 1 , realWeight: 1},
  { text: '再试一次', color: '#4d9999', weight: 1 , realWeight: 1}
];

Page({
  data: {
    sectors: defaultSectors,
    rotating: false,
    title: '开心转转转',
    finished: false, // 是否已完成转动
    selectedIndex: -1, // 当前选中的扇区索引
    canvasVisible: true, // Canvas是否可见
    turntableImage: '', // 转盘图片路径
    currentOption: '开始转动', // 当前指向的选项
    
    // 转盘列表相关数据
    showTurntableList: false, // 是否显示转盘列表侧边栏
    currentTurntableId: '', // 当前选中的转盘ID (改为字符串类型)
    turntableList: [
      {
        id: '1',
        title: '开心转转转',
        sectorsCount: 5,
        updateTime: '今天 15:30'
      },
      {
        id: '2',
        title: '晚餐吃什么',
        sectorsCount: 8,
        updateTime: '昨天 18:20'
      },
      {
        id: '3',
        title: '周末去哪玩',
        sectorsCount: 6,
        updateTime: '3天前'
      },
      {
        id: '4',
        title: '学习计划',
        sectorsCount: 4,
        updateTime: '1周前'
      },
      {
        id: '5',
        title: '运动项目',
        sectorsCount: 7,
        updateTime: '2周前'
      }
    ]
  },
  canvasInfo: null, // 缓存 canvas 信息
  lastPointingSector: -1, // 缓存上次指向的扇区，减少重复更新
  updateTimer: null, // 定时器ID
  isInitializingCanvas: false, // Canvas初始化锁，防止并发初始化

  onLoad() {
    // 页面加载时，先确保获取到openid
    this.ensureOpenId();
  },

  onShow() {
    // 页面显示时加载配置
    this.loadTurntableConfig();
    // 加载转盘列表
    this.loadTurntableList();
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

  // 确保获取到openid
  async ensureOpenId() {
    try {
      let openid = wx.getStorageSync('openid');
      if (!openid) {
        console.log('本地无openid，尝试获取...');
        openid = await this.getAndStoreOpenId();
        if (openid) {
          console.log('成功获取并存储openid:', openid);
        } else {
          console.log('获取openid失败，将使用本地配置');
        }
      } else {
        console.log('本地已有openid:', openid);
      }
    } catch (error) {
      console.error('确保openid过程出错:', error);
    }
  },

  // 获取并存储openid
  async getAndStoreOpenId() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'getOpenId' }
      });
      
      if (res.result && res.result.openid) {
        // 存储到本地
        wx.setStorageSync('openid', res.result.openid);
        return res.result.openid;
      } else {
        console.error('云函数返回的openid为空:', res);
        return null;
      }
    } catch (error) {
      console.error('获取openid失败:', error);
      return null;
    }
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

          // 只有在有有效更新数据时才更新页面数据
          if (updatedSectors.length > 0) {
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

  // 加载转盘列表
  async loadTurntableList() {
    try {
      const openid = wx.getStorageSync('openid');
      if (!openid) {
        console.log('未获取到openid，无法加载转盘列表');
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
        // 将云端数据转换为前端需要的格式
        const turntableList = result.result.data.map(item => {
          return {
            id: item._id, // 使用_id作为id
            title: item.title || '未命名转盘',
            sectorsCount: item.sectors ? item.sectors.length : 0,
            updateTime: this.formatUpdateTime(item.updateTime || item._createTime || new Date())
          };
        });

        // 更新页面数据
        this.setData({
          turntableList: turntableList
        });

        // 如果当前没有选中的转盘，或者选中的转盘不在列表中，自动选择第一个
        if (!this.data.currentTurntableId || 
            !turntableList.find(item => item.id === this.data.currentTurntableId)) {
          if (turntableList.length > 0) {
            console.log('自动设置当前转盘为第一个:', turntableList[0]);
            this.setData({
              currentTurntableId: turntableList[0].id,
              title: turntableList[0].title
            });
            // 同时更新云端的当前转盘设置
            this.updateUserCurrentTurntable(turntableList[0].id);
          }
        }

        console.log('转盘列表加载成功:', turntableList);
      } else {
        console.log('转盘列表加载失败:', result);
      }
    } catch (error) {
      console.error('加载转盘列表异常:', error);
    }
  },

  // 格式化更新时间
  formatUpdateTime(time) {
    if (!time) return '未知时间';
    
    const now = new Date();
    const updateTime = new Date(time);
    const diff = now - updateTime;
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (days === 0) {
      if (hours === 0) {
        if (minutes === 0) {
          return '刚刚';
        } else {
          return `${minutes}分钟前`;
        }
      } else {
        return `${hours}小时前`;
      }
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return `${days}天前`;
    } else if (days < 30) {
      const weeks = Math.floor(days / 7);
      return `${weeks}周前`;
    } else {
      const months = Math.floor(days / 30);
      return `${months}个月前`;
    }
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
    let openid = wx.getStorageSync('openid');
    if (!openid) {
      console.log('未获取到openid，尝试获取...');
      openid = await this.getAndStoreOpenId();
      if (!openid) {
        console.log('获取openid失败，使用本地配置');
        this.loadLocalConfig();
        return;
      }
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
        
        // 确保云端配置有效后再更新 sectors 数据
        if (cloudConfig.sectors && cloudConfig.sectors.length > 0) {
          this.setData({
            sectors: cloudConfig.sectors,
            title: cloudConfig.title || '开心转转转',
            currentTurntableId: cloudConfig._id || cloudConfig.id // 设置当前转盘ID
          });

          console.log('从云端设置当前转盘ID:', cloudConfig._id || cloudConfig.id);

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
        
        this.setData({
          sectors: config.sectors,
          title: config.title || '开心转转转'
        });

        this.refreshTurntable(config.sectors);
      } else {
        console.log('本地无配置，使用默认配置');
        this.setData({
          sectors: defaultSectors,
          title: '开心转转转'
        });
        this.refreshTurntable(defaultSectors);
      }
    } catch (e) {
      console.log('读取本地配置失败，使用默认配置', e);
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
    console.log('首页跳转编辑，currentTurntableId:', this.data.currentTurntableId);
    console.log('currentTurntableId类型:', typeof this.data.currentTurntableId);
    
    // 如果有当前转盘ID，进入编辑模式；否则进入新建模式
    if (this.data.currentTurntableId && this.data.currentTurntableId.trim() !== '') {
      console.log('进入编辑模式');
      wx.navigateTo({
        url: `./edit?turntableId=${this.data.currentTurntableId}`
      });
    } else {
      console.log('没有当前转盘，进入新建模式');
      wx.navigateTo({
        url: './edit'
      });
    }
  },
  
  // 初始化 canvas，只执行一次
  initCanvas(retryCount = 0) {
    // 防止并发初始化
    if (this.isInitializingCanvas) {
      console.log('Canvas正在初始化中，跳过重复调用');
      return;
    }
    
    // 如果已经初始化成功，跳过
    if (this.canvasInfo && this.canvasContext && retryCount === 0) {
      console.log('Canvas已经初始化成功，跳过重复调用');
      return;
    }
    
    this.isInitializingCanvas = true;
    console.log(`Canvas初始化尝试 ${retryCount + 1}/3`);
    
    const query = wx.createSelectorQuery();
    query.select('#turntable')
      .fields({ node: true, size: true })
      .exec((res) => {
        console.log('Canvas查询结果:', res);
        
        if (res[0] && res[0].node && res[0].width > 0 && res[0].height > 0) {
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          
          // 获取设备像素比，提高Canvas清晰度
          const dpr = wx.getWindowInfo().pixelRatio;
          canvas.width = res[0].width * dpr;
          canvas.height = res[0].height * dpr;
          ctx.scale(dpr, dpr);
          
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
          
          // 保存Canvas上下文
          this.canvasContext = ctx;
          this.canvas = canvas;
          
          console.log('Canvas初始化成功:', this.canvasInfo);
          
          // 释放初始化锁
          this.isInitializingCanvas = false;
          
          // 延迟一点时间再绘制，确保Canvas完全准备好
          setTimeout(() => {
            this.drawTurntable(0);
          }, 50);
        } else {
          console.error('Canvas初始化失败，获取到的元素信息:', res);
          
          // 重试机制，最多重试3次，使用更长的延迟
          if (retryCount < 3) {
            const delay = [500, 800, 1500][retryCount]; // 递增延迟
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




  drawTurntable(rotateAngle = 0, highlightIndex = -1) {
    if (!this.canvasInfo || !this.canvasContext) return;
    
    const ctx = this.canvasContext;
    // 使用页面数据中的sectors，而不是全局变量
    const currentSectors = this.data.sectors || [];
    const len = currentSectors.length;

    
    // 添加对空sectors数组的保护
    if (len === 0) {
      console.log('sectors数组为空，跳过绘制');
      return;
    }
    
    const angle = 2 * Math.PI / len;
    const { width, height, centerX, centerY, radius } = this.canvasInfo;
    
    // 添加对radius的保护，确保为正数
    if (radius <= 0) {
      console.error('Canvas radius为负值或零:', radius, '跳过绘制');
      return;
    }

    // 清空Canvas
    ctx.clearRect(0, 0, width, height);

    // 一次性设置通用属性
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '16px sans-serif';
    ctx.lineWidth = 2;

    // 批量绘制扇形和文字
    for (let i = 0; i < len; i++) {
      const startAngle = angle * i + rotateAngle;
      const endAngle = angle * (i + 1) + rotateAngle;
      
      // 绘制扇形
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = currentSectors[i].color;
      ctx.fill();
      
      // 绘制边框
      ctx.strokeStyle = '#ffffff';
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
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; // 60% 透明度的黑色蒙版
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
          ctx.fillStyle = '#ffffff'; // 选中区域保持白色
        } else {
          ctx.fillStyle = '#666666'; // 非选中区域使用深灰色，更明显
        }
      } else {
        // 没有高亮时，所有文字都是白色
        ctx.fillStyle = '#ffffff';
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
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // 如果不在转动状态，转换为图片
    if (!this.data.rotating) {
      // 给Canvas一些时间完成实际渲染，然后转换为图片
      setTimeout(() => {
        this.convertCanvasToImage();
      }, 100);
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
    if (!this.canvas) {
      console.error('Canvas节点未找到，无法转换为图片');
      return;
    }
    
    wx.canvasToTempFilePath({
      canvas: this.canvas,
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
    });
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
    
    const anglePerSector = (2 * Math.PI) / len; // 每个扇区的角度（弧度）
    
    // 12点钟方向在Canvas中是-π/2弧度
    const pointerAngle = -Math.PI / 2;
    
    // currentAngle是转盘的旋转角度（度数），转换为弧度
    const rotateAngle = currentAngle * Math.PI / 180;
    
    // 计算12点钟方向相对于转盘起始位置的角度
    // 由于转盘旋转了rotateAngle，12点钟方向相对于扇区的角度是pointerAngle - rotateAngle
    let relativeAngle = pointerAngle - rotateAngle;
    
    // 将角度标准化到[0, 2π)范围
    relativeAngle = ((relativeAngle % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
    
    // 计算当前指向的扇区索引
    let sectorIndex = Math.floor(relativeAngle / anglePerSector);
    
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
      showTurntableList: false // 转动时关闭侧边栏
      // 移除 currentOption: '转动中...'，让它实时显示当前指向的选项
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
    
    // 根据权重随机选择扇区
    // 使用页面数据中的sectors，而不是全局变量
    const currentSectors = this.data.sectors || [];
    
    // 开始转动时重新绘制（不转换为图片）
    this.drawTurntable(0);
    
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
    
    // 设置初始的当前选项（12点钟方向指向的选项）
    const initialPointingSector = this.getCurrentPointingSector(0);
    this.setData({
      currentOption: currentSectors[initialPointingSector].text
    });
    
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
      
      // 实时更新当前指向的选项（不依赖重绘频率）
      const pointingSector = this.getCurrentPointingSector(currentAngle);
      if (this.lastPointingSector !== pointingSector) {
        this.lastPointingSector = pointingSector;
        this.setData({
          currentOption: currentSectors[pointingSector].text
        });
        
        // 当指向的选项发生变化时触发震动
        this.triggerVibration();
      }
      
      // 减少不必要的重绘，只在角度变化足够大时才重绘
      const angleDiff = Math.abs(currentAngle - (this.lastAngle || 0));
      if (angleDiff > 0.5 || progress >= 1) {
        this.drawTurntable(currentAngle * Math.PI / 180);
        this.lastAngle = currentAngle;
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
        
        // 设置转动完成状态
        this.setData({ 
          rotating: false,
          finished: true,
          selectedIndex: target
        });
        
        // 确保最终显示正确的结果（使用目标扇区，这是根据权重随机选择的结果）
        setTimeout(() => {
          this.setData({
            currentOption: currentSectors[target].text
          });
          
          // 重置缓存变量
          this.lastPointingSector = -1;
          
          // 只绘制一次最终的高亮效果
          this.drawTurntable(finalAngle * Math.PI / 180, target);
          
          // 转盘停止时触发中等强度震动，表示结果确定
          this.triggerFinalVibration();
        }, 100); // 短暂延迟确保动画完全结束
      }
    };
    
    animate();
  },

  // ======== 转盘列表侧边栏相关方法 ========
  
  // 切换转盘列表显示/隐藏
  toggleTurntableList() {
    const newState = !this.data.showTurntableList;
    this.setData({
      showTurntableList: newState
    });
    
    // 添加按钮点击动画效果
    const query = wx.createSelectorQuery();
    query.select('.dropdown-btn').boundingClientRect();
    query.exec((res) => {
      if (res[0]) {
        // 可以添加额外的动画效果
      }
    });
  },

  // 关闭转盘列表
  closeTurntableList() {
    this.setData({
      showTurntableList: false
    });
  },

  // 选择转盘
  async selectTurntable(e) {
    const turntableId = e.currentTarget.dataset.id;
    const selectedTurntable = this.data.turntableList.find(item => item.id === turntableId);
    
    if (selectedTurntable) {
      // 更新当前转盘ID
      this.setData({
        currentTurntableId: turntableId,
        title: selectedTurntable.title,
        showTurntableList: false
      });

      console.log('选择了转盘:', selectedTurntable);
      
      // 更新用户当前选中的转盘，然后重新加载配置
      await this.updateUserCurrentTurntable(turntableId);
      await this.loadTurntableConfig();
    }
  },

  // 更新用户当前选中的转盘
  async updateUserCurrentTurntable(turntableId) {
    try {
      const openid = wx.getStorageSync('openid');
      if (!openid) {
        console.log('未获取到openid，无法更新当前转盘');
        return;
      }

      const result = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { 
          type: 'updateUserCurrentTurntable',
          data: {
            _openid: openid,
            sector_id: turntableId
          }
        }
      });

      if (result.result && result.result.success) {
        console.log('用户当前转盘更新成功:', turntableId);
      } else {
        console.log('用户当前转盘更新失败:', result);
      }
    } catch (error) {
      console.error('更新用户当前转盘异常:', error);
    }
  },

  // 创建新转盘
  createNewTurntable() {
    // 关闭侧边栏
    this.setData({
      showTurntableList: false
    });
    
    // 跳转到新的add页面创建新转盘
    wx.navigateTo({
      url: '/pages/index/add'
    });
  },


}) 
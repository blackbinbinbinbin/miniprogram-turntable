const sectors = [
  { text: '唱', color: '#f88', weight: 1 },
  { text: '跳', color: '#99884d', weight: 1 },
  { text: 'rap', color: '#4d9988', weight: 1 },
  { text: '篮球', color: '#6c4d99', weight: 1 },
  { text: '再试一次', color: '#4d9999', weight: 1 }
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
  onShow() {
    // 页面显示时加载配置
    this.loadTurntableConfig();
    // 初始化显示第一个选项
    if (sectors.length > 0) {
      this.setData({
        currentOption: sectors[0].text
      });
    }
  },

  onReady() {
    // 延迟绘制，确保页面完全加载
    setTimeout(() => {
      this.initCanvas();
    }, 100);
  },

  // 加载转盘配置
  loadTurntableConfig() {
    try {
      const config = wx.getStorageSync('turntableConfig');
      if (config) {
        // 更新全局 sectors 变量
        sectors.length = 0;
        sectors.push(...config.sectors);
        
        this.setData({
          sectors: config.sectors,
          title: config.title || '开心转转转'
        });
        
        // 重新绘制转盘
        if (this.canvasInfo) {
          this.drawTurntable(0);
        }
      }
    } catch (e) {
      console.log('读取配置失败', e);
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
  
  startRotate() {
    if (this.data.rotating) return;
    
    // 转动时显示Canvas，隐藏图片（因为需要动画）
    this.setData({ 
      canvasVisible: true,
      turntableImage: '',
      rotating: true, // 先设置rotating状态
      currentOption: '转动中...' // 显示转动状态
    });
    
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
    const totalWeight = sectors.reduce((sum, sector) => sum + (sector.weight || 1), 0);
    const randomValue = Math.random() * totalWeight;
    
    let currentWeight = 0;
    let target = 0;
    for (let i = 0; i < len; i++) {
      currentWeight += sectors[i].weight || 1;
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
      
      // 使用更平滑的缓动函数，避免最后过慢
      const easeOutQuint = 1 - Math.pow(1 - progress, 5);
      currentAngle = finalAngle * easeOutQuint;
      
      // 减少不必要的重绘，只在角度变化足够大时才重绘
      const angleDiff = Math.abs(currentAngle - (this.lastAngle || 0));
      if (angleDiff > 0.5 || progress >= 1) {
        this.drawTurntable(currentAngle * Math.PI / 180);
        this.lastAngle = currentAngle;
        
        // 实时更新当前指向的选项
        const pointingSector = this.getCurrentPointingSector(currentAngle);
        this.setData({
          currentOption: sectors[pointingSector].text
        });
      }
      
      if (progress < 1) {
        // 使用更稳定的动画间隔
        animationId = setTimeout(animate, 20);
      } else {
        // 确保最终角度精确
        this.drawTurntable(finalAngle * Math.PI / 180);
        this.lastAngle = 0; // 重置
        
        // 稍微延迟显示蒙版效果和结果
        setTimeout(() => {
          // 先设置rotating为false，这样drawTurntable会转换为图片
          this.setData({ 
            rotating: false,
            finished: true,
            selectedIndex: target
          });
          
          // 绘制带高亮效果的转盘，并转换为图片
          this.drawTurntable(finalAngle * Math.PI / 180, target);
          
          // 更新最终结果显示
          this.setData({
            currentOption: sectors[target].text
          });
        }, 30);
      }
    };
    
    animate();
  }
}) 
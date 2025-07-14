// 带过期时间的存储工具函数
const StorageUtil = {
  // 设置存储，支持过期时间（单位：天）
  setWithExpiry(key, value, expiryInDays = 1) {
    const now = new Date().getTime();
    const expiryTime = now + (expiryInDays * 24 * 60 * 60 * 1000);
    
    const dataWithExpiry = {
      value: value,
      expiry: expiryTime,
      timestamp: now
    };
    
    wx.setStorageSync(key, dataWithExpiry);
  },

  // 获取存储，自动检查过期
  getWithExpiry(key) {
    try {
      const data = wx.getStorageSync(key);
      
      if (!data) return null;
      
      // 如果数据格式不正确（可能是旧数据），直接返回
      if (!data.expiry) {
        console.log(`${key}为旧格式数据，直接返回`);
        return data;
      }
      
      const now = new Date().getTime();
      
      // 检查是否过期
      if (now > data.expiry) {
        console.log(`${key}数据已过期，自动删除`);
        wx.removeStorageSync(key);
        return null;
      }

      return data.value;
    } catch (e) {
      console.error(`读取${key}失败:`, e);
      return null;
    }
  },

  // 删除存储
  remove(key) {
    wx.removeStorageSync(key);
    console.log(`已删除存储${key}`);
  },

  // 检查是否过期（不删除）
  isExpired(key) {
    try {
      const data = wx.getStorageSync(key);
      if (!data || !data.expiry) return false;
      
      const now = new Date().getTime();
      return now > data.expiry;
    } catch (e) {
      return false;
    }
  },

  // 获取剩余时间（毫秒）
  getRemainingTime(key) {
    try {
      const data = wx.getStorageSync(key);
      if (!data || !data.expiry) return -1;
      
      const now = new Date().getTime();
      return Math.max(0, data.expiry - now);
    } catch (e) {
      return -1;
    }
  },

  // 延长过期时间
  extendExpiry(key, additionalDays) {
    try {
      const data = wx.getStorageSync(key);
      if (!data || !data.expiry) return false;
      
      data.expiry += additionalDays * 24 * 60 * 60 * 1000;
      wx.setStorageSync(key, data);
      return true;
    } catch (e) {
      console.error(`延长${key}过期时间失败:`, e);
      return false;
    }
  }
};

module.exports = StorageUtil; 
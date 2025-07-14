// StorageUtil 使用示例

const StorageUtil = require('./storage');

// 使用示例：

// 1. 存储数据，1天后过期（默认）
StorageUtil.setWithExpiry('userConfig', { name: '张三', age: 25 });

// 2. 存储数据，自定义过期时间（7天）
StorageUtil.setWithExpiry('gameData', { level: 10, score: 1000 }, 7);

// 3. 读取数据（自动检查过期）
const userConfig = StorageUtil.getWithExpiry('userConfig');
if (userConfig) {
  console.log('用户配置:', userConfig);
} else {
  console.log('用户配置不存在或已过期');
}

// 4. 检查是否过期（不删除数据）
if (StorageUtil.isExpired('gameData')) {
  console.log('游戏数据已过期');
}

// 5. 获取剩余时间（毫秒）
const remainingTime = StorageUtil.getRemainingTime('userConfig');
if (remainingTime > 0) {
  const hours = Math.floor(remainingTime / (1000 * 60 * 60));
  console.log(`用户配置还有${hours}小时过期`);
}

// 6. 延长过期时间
StorageUtil.extendExpiry('gameData', 3); // 延长3天

// 7. 手动删除
StorageUtil.remove('userConfig');

// 实际项目中的使用：
// 转盘配置存储（1天过期）
function saveTurntableConfig(config) {
  StorageUtil.setWithExpiry('turntableConfig', config, 1);
}

function loadTurntableConfig() {
  return StorageUtil.getWithExpiry('turntableConfig');
}

// 临时缓存（几小时过期）
function setCacheData(key, data, hours = 6) {
  StorageUtil.setWithExpiry(key, data, hours / 24); // 转换为天数
}

module.exports = {
  saveTurntableConfig,
  loadTurntableConfig,
  setCacheData
}; 
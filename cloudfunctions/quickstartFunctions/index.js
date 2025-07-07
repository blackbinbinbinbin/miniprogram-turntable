const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
// 获取openid
const getOpenId = async () => {
  // 获取基础信息
  const wxContext = cloud.getWXContext();
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
  };
};

// 获取小程序二维码
const getMiniProgramCode = async () => {
  // 获取小程序二维码的buffer
  const resp = await cloud.openapi.wxacode.get({
    path: "pages/index/index",
  });
  const { buffer } = resp;
  // 将图片上传云存储空间
  const upload = await cloud.uploadFile({
    cloudPath: "code.png",
    fileContent: buffer,
  });
  return upload.fileID;
};

// 创建集合
// const createCollection = async () => {
//   try {
//     // 创建集合
//     await db.createCollection("sales");
//     await db.collection("sales").add({
//       // data 字段表示需新增的 JSON 数据
//       data: {
//         region: "华东",
//         city: "上海",
//         sales: 11,
//       },
//     });
//     await db.collection("sales").add({
//       // data 字段表示需新增的 JSON 数据
//       data: {
//         region: "华东",
//         city: "南京",
//         sales: 11,
//       },
//     });
//     await db.collection("sales").add({
//       // data 字段表示需新增的 JSON 数据
//       data: {
//         region: "华南",
//         city: "广州",
//         sales: 22,
//       },
//     });
//     await db.collection("sales").add({
//       // data 字段表示需新增的 JSON 数据
//       data: {
//         region: "华南",
//         city: "深圳",
//         sales: 22,
//       },
//     });
//     return {
//       success: true,
//     };
//   } catch (e) {
//     // 这里catch到的是该collection已经存在，从业务逻辑上来说是运行成功的，所以catch返回success给前端，避免工具在前端抛出异常
//     return {
//       success: true,
//       data: "create collection success",
//     };
//   }
// };

// 查询数据
const selectSectorRecord = async (event) => {
  try {
    // 查询数据库
    const result = await db.collection("sectors").where({
      _openid: event.data._openid,
    }).get();

    // 如果查询到数据，处理sectors字段，确保每个扇区都有realWeight
    if (result.data && result.data.length > 0) {
      result.data = result.data.map(record => {
        if (record.sectors && Array.isArray(record.sectors)) {
          record.sectors = record.sectors.map(sector => {
            // 如果没有realWeight字段，用weight字段赋值
            if (sector.realWeight === undefined || sector.realWeight === null) {
              sector.realWeight = sector.weight || 1;
            }
            return sector;
          });
        }
        return record;
      });
    }

    return result;
  } catch (error) {
    console.error('查询扇区记录失败:', error);
    return {
      data: [],
      errMsg: error.message
    };
  }
};

// 更新数据
const updateSectorsRecord = async (event) => {
  try {
    // 修改数据库信息
    const updateSectors = event.data.sectors.map(item => {
      return {
        text: item.text,
        color: item.color,
        weight: Number(item.weight),
        realWeight: Number(item.realWeight),
      }
    })
    await db
      .collection("sectors")
      .where({
        _openid: event.data._openid,
      })
      .update({
        data: {
          title: event.data.title,
          sectors: updateSectors,
        },
      });
    
    // 更新users信息
    await db.collection("users").where({
      _openid: event.data._openid,
    }).update({
      data: {
        turntable_text: event.data.title,
      },
    });
    return {
      success: true,
      data: event.data,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 新增数据
// 参数 data.sectors 为数组，数组中每个对象包含 text、color、weight 字段
// 参数 data.text 为字符串，表示转盘标题
// 参数 data._openid 为字符串，表示用户openid
const insertSectorsRecord = async (event) => {
  try {
    const insertRecord = event.data;
    console.log(insertRecord);
    // text: '唱', color: '#ff8a80', weight: 1
    // 插入数据
    const insertSectors = event.data.sectors.map(item => {  
      return {
        text: item.text,
        color: item.color,
        weight: Number(item.weight),
        realWeight: Number(item.weight),
      }
    })
    await db.collection("sectors").add({
      data: {
        title: event.data.title,
        _openid: event.data._openid,
        sectors: insertSectors,
      },
    });

    // 添加users信息，先判断是否有用户，没有则添加
    const user = await db.collection("users").where({
      _openid: event.data._openid,
    }).get();
    if (user.data.length === 0) {
      await db.collection("users").add({
        data: {
          _openid: event.data._openid,
          turntable_text: event.data.title,
          user_name: "", // 因为用户名并不能根据微信获取需要授权，但是又不想授权，所以这里默认空字符串
        },
      });
    }

    return {
      success: true,
      data: event.data,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

const adminGetUserList = async (event) => {
  try {
    // 参数
    const turntableText = event.data.turntableText;
    const turntableUserName = event.data.turntableUserName;
    const _ = db.command

    // 构建查询条件
    const conditions = [];
    if (turntableText) {
      conditions.push({
        turntable_text: turntableText
      });
    }
    if (turntableUserName) {
      conditions.push({
        user_name: turntableUserName
      });
    }

    // 查询条件
    const whereCondition = conditions.length > 0 ? _.or(conditions) : {};

    // 查询
    const resultCount = await db.collection("users").where(whereCondition).count();
    const result = await db.collection("users")
      .where(whereCondition)
      .skip((event.data.page - 1) * event.data.pageSize)
      .limit(event.data.pageSize)
      .get();
    return {
      success: true,
      data: {
        list: result.data,
        total: resultCount.total,
        page: event.data.page,
        pageSize: event.data.pageSize,
      },
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

const adminUpdateUserName = async (event) => {
  try {
    // 参数
    const openid = event.data.openid;
    const userName = event.data.userName;

    // 更新用户名
    await db.collection("users").where({
      _openid: openid
    }).update({
      data: {
        user_name: userName
      }
    });

    return {
      success: true,
      data: {
        openid,
        userName
      }
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e
    };
  }
};

const getUserTotalCount = async (event) => {
  try {
    const result = await db.collection("users").count();
    return {
      success: true,
      data: result.total,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

const getTurntableList = async (event) => {
  try {
    // 参数
    const turntableText = event.data.turntableText;
    const turntableUserName = event.data.turntableUserName;
    const page = event.data.page;
    const pageSize = event.data.pageSize;
    const _ = db.command;
    const $ = db.command.aggregate;
    
    // 构建查询条件
    const matchCondition = {};
    if (turntableText) {
      matchCondition.title = db.RegExp({
        regexp: turntableText,
        options: 'i',
      });
    }

    // 如果有用户名搜索，先查询用户获取openid
    if (turntableUserName) {
      const user = await db.collection("users").where({
        user_name: turntableUserName
      }).get();
      
      if (user.data.length > 0) {
        matchCondition._openid = user.data[0]._openid;
      }
    }

    // 聚合查询
    const result = await db.collection("sectors")
      .aggregate()
      .match(matchCondition)
      .lookup({
        from: "users",
        localField: "_openid",
        foreignField: "_openid",
        as: "user"
      })
      .addFields({
        user_name: $.arrayElemAt(['$user.user_name', 0])
      })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .end();

    // 获取总数
    const countResult = await db.collection("sectors")
      .where(matchCondition)
      .count();
    
    return {
      success: true,
      data: {
        list: result.list,
        total: countResult.total,
        page: page,
        pageSize: pageSize,
      },
    };
  } catch (e) {
    console.error('getTurntableList error:', e);
    return {
      success: false,
      errMsg: e,
    };
  }
};



// const getOpenId = require('./getOpenId/index');
// const getMiniProgramCode = require('./getMiniProgramCode/index');
// const createCollection = require('./createCollection/index');
// const selectRecord = require('./selectRecord/index');
// const updateRecord = require('./updateRecord/index');
// const sumRecord = require('./sumRecord/index');
// const fetchGoodsList = require('./fetchGoodsList/index');
// const genMpQrcode = require('./genMpQrcode/index');
// 云函数入口函数
exports.main = async (event, context) => {
  switch (event.type) {
    case "getOpenId":
      return await getOpenId();
    case "getMiniProgramCode":
      return await getMiniProgramCode();
    case "selectSectorRecord":
      return await selectSectorRecord(event);
    case "updateSectorsRecord":
      return await updateSectorsRecord(event);
    case "insertSectorsRecord":
      return await insertSectorsRecord(event);
    case "adminGetUserList":
      return await adminGetUserList(event);
    case "adminUpdateUserName":
      return await adminUpdateUserName(event);
    case "getUserTotalCount":
      return await getUserTotalCount(event);
    case "getTurntableList":
      return await getTurntableList(event);
  }
};

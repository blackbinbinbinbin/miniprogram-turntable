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
  // 返回数据库查询结果
  return await db.collection("sectors").where({
    _openid: event.data._openid,
  }).get();
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

// 删除数据
// const deleteRecord = async (event) => {
//   try {
//     await db
//       .collection("sales")
//       .where({
//         _id: event.data._id,
//       })
//       .remove();
//     return {
//       success: true,
//     };
//   } catch (e) {
//     return {
//       success: false,
//       errMsg: e,
//     };
//   }
// };

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
  }
};

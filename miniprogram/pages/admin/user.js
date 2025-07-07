Page({
  data: {
    searchKeyword: '',
    currentPage: 1,
    pageSize: 10,
    total: 0, // 总数据条数
    totalPages: 0, // 总页数
    userList: [
    ],
    showEditModal: false,
    editingUser: null,
    editingIndex: -1
  },

  onLoad() {
    this.loadUserList()
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    })
  },

  // 执行搜索
  handleSearch() {  
    const keyword = this.data.searchKeyword.trim()
    if (!keyword) {
      return
    }

    // 调用云函数
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'adminGetUserList',
        data: {
          turntableText: keyword,
          turntableUserName: keyword,
          page: this.data.currentPage,
          pageSize: this.data.pageSize
        }
      },
      success: (res) => {
        if (res.result.success) {
          this.setData({
            userList: res.result.data.list,
            total: res.result.data.total,
            totalPages: Math.ceil(res.result.data.total / this.data.pageSize)
          })
        } else {
          wx.showToast({
            title: res.result.errMsg,
            icon: 'none'
          })
        }
      }
    })
  },

  // 编辑用户
  handleEdit(e) {
    const index = e.currentTarget.dataset.id
    const user = this.data.userList[index]
    
    this.setData({
      showEditModal: true,
      editingUser: { ...user },
      editingIndex: index
    })
  },

  // 用户名输入
  onUsernameInput(e) {
    this.setData({
      'editingUser.user_name': e.detail.value
    })
  },

  // 关闭弹窗
  handleCloseModal() {
    this.setData({
      showEditModal: false,
      editingUser: null,
      editingIndex: -1
    })
  },

  // 保存用户信息
  async handleSaveUser() {
    const { editingUser, editingIndex } = this.data
    if (!editingUser.user_name.trim()) {
      wx.showToast({
        title: '用户名不能为空',
        icon: 'none'
      })
      return
    }

    // 调用云函数更新用户名
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'adminUpdateUserName',
        data: {
          openid: editingUser._openid,
          userName: editingUser.user_name.trim()
        }
      },
      success: (res) => {
        if (res.result.success) {
          // 更新本地数据
          const userList = this.data.userList
          userList[editingIndex].user_name = editingUser.user_name.trim()

          this.setData({
            userList,
            showEditModal: false,
            editingUser: null,
            editingIndex: -1
          })

          wx.showToast({
            title: '保存成功',
            icon: 'success'
          })
        } else {
          wx.showToast({
            title: res.result.errMsg || '保存失败',
            icon: 'none'
          })
        }
      },
      fail: (error) => {
        console.error('更新用户名失败:', error)
        wx.showToast({
          title: '保存失败',
          icon: 'error'
        })
      }
    })
  },

  // 点击页码
  handlePageClick(e) {
    const page = e.currentTarget.dataset.page
    if (page !== this.data.currentPage) {
      this.setData({
        currentPage: page
      })
      this.loadUserList()
    }
  },

  // 上一页
  handlePrevPage() {
    if (this.data.currentPage > 1) {
      this.setData({
        currentPage: this.data.currentPage - 1
      })
      this.loadUserList()
    }
  },

  // 下一页
  handleNextPage() {
    if (this.data.currentPage < this.data.totalPages) {
      this.setData({
        currentPage: this.data.currentPage + 1
      })
      this.loadUserList()
    }
  },

  // 加载用户列表
  async loadUserList() {
    try {
      const keyword = this.data.searchKeyword.trim()
      wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'adminGetUserList',
          data: {
            turntableText: keyword,
            turntableUserName: keyword,
            page: this.data.currentPage,
            pageSize: this.data.pageSize
          }
        },
        success: (res) => {
          if (res.result.success) {
            this.setData({
              userList: res.result.data.list,
              total: res.result.data.total,
              totalPages: Math.ceil(res.result.data.total / this.data.pageSize)
            })
          }
        }
      })
    } catch (error) {
      console.error('加载用户列表失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      })
    }
  }
}) 
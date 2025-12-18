export default {
  app: {
    name: '智托管',
    systemName: '教务管理系统',
  },
  menu: {
    dashboard: '仪表盘',
    students: '学员管理',
    attendance: '签到消课',
    orders: '订单流水',
    classes: '课程/班级',
    users: '员工管理',
    map: '生源热力图',
    portal: '返回门户首页',
  },
  header: {
    welcome: '欢迎回来，管理员',
    logout: '退出',
  },
  common: {
    action: '操作',
    edit: '编辑',
    delete: '删除',
    save: '保存',
    cancel: '取消',
    confirm: '确定',
    detail: '详情',
    remark: '备注',
    status: '状态',
    success: '操作成功',
    failed: '操作失败',
    loading: '加载中...',
    placeholderSelect: '请选择',
    placeholderInput: '请输入',
    yes: '是',
    no: '否',
  },
  // 1. 仪表盘
  dashboard: {
    totalStudents: '在读学员',
    todayCheckins: '今日签到',
    todayIncome: '今日营收',
    renewalAlert: '续费预警',
    quickActions: '快捷操作',
    btnEnroll: '学员报名',
    btnCheckin: '快速签到',
    btnAddProfile: '新增档案',
    listTitle: '需要续费的学员 (有效期 < 7天)',
    viewAll: '查看全部',
    activities: '今日动态',
    colName: '姓名',
    colClass: '课程',
    colExpiry: '有效期至',
    btnRemind: '催费',
  },
  // 2. 学员管理
  student: {
    title: '学员列表',
    addBtn: '新增学员',
    colName: '姓名',
    colGender: '性别',
    colParent: '家长姓名',
    colPhone: '联系电话',
    colAddress: '地址',
    colBalance: '账户余额',
    colJoined: '入学时间',
    colCourses: '在读课程 / 有效期',
    btnEnroll: '报名/续费',
    btnDrop: '退课',
    // 弹窗
    dialogAddTitle: '新增学员档案',
    dialogEditTitle: '编辑学员信息',
    labelName: '学员姓名',
    labelGender: '性别',
    genderMale: '男',
    genderFemale: '女',
    labelParent: '家长姓名',
    labelPhone: '联系电话',
    labelAddress: '地址',
    btnSelectLoc: '选择位置',
    labelBalance: '账户余额',
    labelInitialBalance: '初始预存',
    placeholderName: '请输入姓名',
    placeholderParent: '例如：张爸爸',
    placeholderPhone: '11位手机号',
    placeholderAddress: '请点击右侧按钮选择',
    unitYuan: '元',
  },
  // 3. 签到消课
  attendance: {
    title: '签到消课',
    filterClass: '筛选班级 (留空显示所有)',
    btnCheckin: '签 到',
    btnSigned: '已 签',
    validUntil: '有效期至',
    noExpiry: '未设置有效期',
    empty: '暂无在读学员数据',
    msgSuccess: '签到成功',
  },
  // 4. 订单流水
  order: {
    title: '订单流水',
    exportBtn: '导出 Excel',
    colId: '单号',
    colTime: '时间',
    colStudent: '学员',
    colClass: '购买课程',
    colContent: '交易内容',
    colAmount: '实收金额',
    typeTime: '包期',
    typeCount: '课时',
    unitMonth: '个月',
    unitLesson: '节',
  },
  // 5. 课程/班级
  class: {
    title: '课程/班级管理',
    addBtn: '新建课程',
    colName: '课程名称',
    colType: '类型',
    colSchedule: '开课/排课',
    colFee: '学费',
    colTeacher: '负责老师',
    typeTime: '包期/月',
    typeCount: '按次',
    // 弹窗
    dialogCreateTitle: '新建课程',
    dialogEditTitle: '编辑课程',
    labelName: '课程名称',
    labelTeacher: '负责老师',
    labelType: '计费类型',
    labelStartDate: '开课日期',
    labelSchedule: '上课周期',
    labelTime: '上课时间',
    labelDurationTime: '有效期(月)',
    labelDurationCount: '总课时(节)',
    labelEndDate: '结课日期',
    labelFee: '学费金额',
    labelDesc: '备注/描述',
    week: {
      1: '周一',
      2: '周二',
      3: '周三',
      4: '周四',
      5: '周五',
      6: '周六',
      0: '周日',
    },
    hintAutoCalc: '系统根据周期自动计算',
  },
  // 6. 员工管理
  user: {
    title: '员工/权限管理',
    addBtn: '新增员工',
    colUsername: '用户名',
    colRealName: '真实姓名',
    colRole: '角色',
    colStatus: '状态',
    colCreated: '创建时间',
    roleAdmin: '管理员',
    roleTeacher: '普通教师',
    btnResetPwd: '重置密码',
    dialogCreateTitle: '新增员工',
    dialogEditTitle: '编辑员工',
    labelUsername: '用户名',
    labelRealName: '真实姓名',
    labelPassword: '初始密码',
    labelRole: '角色权限',
    dialogResetTitle: '重置密码',
    msgResetSuccess: '密码重置成功',
  },
  // 登录页 (之前的)
  login: {
    navBtn: '登录系统',
    slogan: '让教务管理回归简单与纯粹',
    subSlogan:
      '专为中小托管机构打造的智能管家。从LBS生源地图到精准的财务流水，我们要做的，是让你从繁琐的表格中彻底解放。',
    ctaBtn: '立即体验演示',
    enterNow: '进入工作台',
    intro: {
      title: '系统简介',
      desc: '教务管理系统是一款专为中小型教育机构、托管班、培训机构打造的智能化运营管理平台。系统涵盖学员管理、课程管理、考勤签到、财务流水等核心功能，帮助机构实现从招生到教学的全程数字化管理，提升运营效率，降低管理成本。',
      highlight1: '全流程管理',
      highlight1Desc: '覆盖学员档案、课程安排、考勤签到、财务流水等教育机构运营全流程',
      highlight2: '智能自动化',
      highlight2Desc: '自动消课、自动计算有效期、自动生成财务报表，减少人工操作',
      highlight3: '数据可视化',
      highlight3Desc: 'LBS地图展示生源分布，数据报表清晰直观，辅助决策分析',
    },
    features: {
      mapTitle: 'LBS 智能地图',
      mapDesc: '集成高德地图 SDK，可视化生源分布热力图，直观展示学员地理分布，辅助市场拓展和选址决策。支持地图选点、地址解析、距离计算等功能。',
      checkinTitle: '一键消课签到',
      checkinDesc: '3秒完成学员签到，系统自动扣除课时并计算有效期。支持批量签到、补签、请假等场景，考勤记录完整可追溯。',
      financeTitle: '严谨财务闭环',
      financeDesc: '独创负数订单逻辑，完美处理退费、转课、补差价等复杂场景。支持包期和按次两种计费模式，财务流水清晰透明。',
      studentTitle: '学员档案管理',
      studentDesc: '完整的学员信息管理，包括基本信息、家长联系方式、课程记录、余额查询等。支持批量导入导出，数据安全可靠。',
      classTitle: '课程班级管理',
      classDesc: '灵活的课程设置，支持包期和按次两种计费模式。自动排课、课时统计、课程进度跟踪，让教学管理更有序。',
      reportTitle: '数据报表分析',
      reportDesc: '多维度数据统计和分析，包括学员增长趋势、课程销售情况、财务收支报表等，为机构运营提供数据支持。',
    },
    useCases: {
      title: '适用场景',
      case1: {
        title: '托管机构',
        desc: '适用于课后托管、晚托班等机构，管理学员档案、考勤签到、课程安排和财务流水',
      },
      case2: {
        title: '培训机构',
        desc: '适用于学科培训、兴趣班等机构，支持多种课程类型和计费模式，灵活应对不同业务需求',
      },
      case3: {
        title: '小型教育机构',
        desc: '专为中小型机构设计，操作简单易用，无需复杂培训即可快速上手，降低使用门槛',
      },
    },
    advantages: {
      title: '核心优势',
      adv1: {
        title: '简单易用',
        desc: '界面简洁直观，操作流程清晰，3分钟即可上手，无需复杂培训',
      },
      adv2: {
        title: '功能完善',
        desc: '涵盖教育机构运营管理的核心功能，一站式解决日常管理需求',
      },
      adv3: {
        title: '数据安全',
        desc: '本地化部署，数据完全自主掌控，符合教育行业数据安全要求',
      },
    },
    contact: '联系我们',
    phone: '手机 / 微信',
    email: '电子邮箱',
    dialogTitle: '欢迎回来',
    dialogSub: '请登录您的账号以继续管理',
    visitor: '访客快捷通道',
    usernamePlaceholder: '请输入账号',
    passwordPlaceholder: '请输入密码',
    loginBtn: '登 录',
    navEnter: '进入系统', // 右上角按钮 (已登录状态)
    welcomeBackAction: '欢迎回来，进入系统', // 中间大按钮 (已登录状态)
    identityTitle: '身份确认', // 弹窗标题
    accessing: '正在访问', // 弹窗内提示
    systemStrategy: '商业分析地图', // 系统名称
    systemEdu: '教务管理系统', // 系统名称
    enterNow: '立即进入', // 弹窗内大按钮
    switchAccount: '切换账号', // 弹窗内小按钮
    backHome: '返回首页', // 顶部返回按钮
  },
  map: {
    title: '生源分布热力分析',
    totalPoints: '样本点数量',
    blur: '模糊度',
    radius: '热力半径',
  },
  strategy: {
    title: '商业分析地图',
    subTitle: 'V1.0',
    layers: '图层控制',
    arsenal: '工具',
    details: '数据详情',
    dialogTitle: '数据录入',
    // 字段映射字典
    fields: {
      // 竞争对手
      price: '预估客单价',
      students: '预估学员数',
      threat: '威胁等级',
      brand: '品牌归属',
      // 小区
      avg_price: '挂牌均价',
      households: '总户数',
      age: '建筑年代',
      is_closed: '是否封闭',
      // 学校
      level: '学校等级',
      // 路线
      duration: '预计耗时',
      safety: '安全系数',
      // 通用
      name: '名称',
      address: '地址',
      remarks: '备注',
      category: '业务分类',
      attributes: '扩展属性',
    },
    placeholders: {
      name: '请输入名称 (如: 阳光第一小学)',
      selectType: '请选择类型'
    },
    layerItems: {
      own: '我方校区',
      competitor: '竞争对手',
      school: '公立学校',
      community: '住宅小区',
      route: '接送路线',
      block: '竞对拦截线',
      hotzone: '辐射热区'
    },
    dictionary: '字典管理',
    actions: {
      cancel: '放弃',
      save: '保存数据',
      point: '标记点位',
      line: '规划路线',
      polygon: '圈定区域',
      delete: '删除选中'
    },
    dialogs: {
      deleteTitle: '警告',
      deleteMsg: '确定要从数据库中永久删除 "{name}" 吗?', // {name} 是动态参数
      confirmDelete: '确定删除',
      cancel: '取消',
      defaultData: '该数据' // 当没有名称时的兜底显示
    }
  },
  // 新增门户首页翻译
  portal: {
    title: '数字化中台',
    hero: {
      greeting: '智能运营与商业决策中台',
      role: '数据驱动 · 空间感知 · 高效协同',
      desc: '为垂直行业提供从日常运营管理到市场战略分析的一站式数字化解决方案，帮助企业提升运营效率、优化决策流程、实现业务增长。',
    },
    systemCard: {
      title: '教务管理系统',
      desc: '一站式教育机构运营解决方案。轻松管理学员档案、自动处理财务流水、智能考勤消课，让日常运营更高效。',
      tag: '私有部署',
      btn: '进入工作台',
    },
    strategyCard: {
      title: '商业分析地图',
      desc: '智能商业选址与市场分析工具。通过地理数据可视化，帮助您快速识别优质商圈、评估竞争环境、制定精准的市场拓展策略。',
      tag: '公开演示',
      btn: '进入分析地图',
    },
    copyright: '© 2025 托管班数字化中台. Designed by Developer.',
  },
  // 字典管理翻译
  dictionary: {
    title: '字典管理',
    geometryTypes: {
      point: '点要素',
      line: '线要素',
      polygon: '面要素'
    },
    types: {
      title: '类型管理',
      add: '新增类型',
      edit: '编辑类型',
      columns: {
        nameZh: '中文名称',
        nameEn: '英文名称',
        code: '类型代码',
        color: '颜色',
        icon: '图标',
        status: '状态',
        actions: '操作'
      },
      status: {
        active: '启用',
        inactive: '禁用'
      },
      form: {
        geometryType: '几何类型',
        code: '类型代码',
        nameZh: '中文名称',
        nameEn: '英文名称',
        color: '颜色',
        icon: '图标',
        sortOrder: '排序',
        status: '启用状态'
      }
    },
    fields: {
      title: '字段管理',
      add: '新增字段',
      edit: '编辑字段',
      columns: {
        nameZh: '中文标签',
        nameEn: '英文标签',
        key: '字段键',
        type: '字段类型',
        required: '必填',
        actions: '操作'
      },
      form: {
        key: '字段键',
        nameZh: '中文标签',
        nameEn: '英文标签',
        type: '字段类型',
        required: '是否必填',
        defaultValue: '默认值',
        placeholderZh: '中文占位符',
        placeholderEn: '英文占位符',
        suffix: '单位后缀',
        sortOrder: '排序',
        options: '下拉选项',
        addOption: '添加选项',
        optionLabelZh: '中文标签',
        optionLabelEn: '英文标签',
        optionValue: '选项值'
      }
    },
    empty: '暂无字典配置'
  },
  // 商业分析系统首页翻译
  analytics: {
    home: {
      title: '商业分析地图',
      slogan: '让商业选址更智能、更精准',
      subSlogan: '基于地理信息系统的商业数据分析平台，通过可视化地图帮助您快速识别优质商圈、评估竞争环境、制定精准的市场拓展策略。',
      ctaBtn: '立即体验演示',
      enterNow: '进入分析地图',
      intro: {
        title: '系统简介',
        desc: '商业分析地图是一款专为教育机构、连锁企业等需要精准选址的行业打造的地理信息分析工具。系统集成了先进的地图可视化引擎和灵活的数据字典管理，让您能够在地图上直观地标记、分析和决策。',
        highlight1: '多要素支持',
        highlight1Desc: '支持点、线、面三种地理要素类型，满足不同业务场景的需求',
        highlight2: '灵活配置',
        highlight2Desc: '通过字典管理功能，可自定义要素类型和属性字段，适应不同行业需求',
        highlight3: '数据驱动',
        highlight3Desc: '所有数据实时保存，支持多维度分析和可视化展示',
      },
      features: {
        mapTitle: '地理数据可视化',
        mapDesc: '集成 Mapbox GL 地图引擎，支持多种地理要素的叠加展示，包括点要素（校区、竞争对手、学校、小区）、线要素（路线、拦截线）、面要素（热区）等，让复杂的地理数据一目了然。',
        siteTitle: '智能选址分析',
        siteDesc: '通过多维度数据标记和分析，包括竞争对手分布、生源热力图、服务半径等，帮助您找到最佳商业位置，评估市场潜力。',
        dataTitle: '灵活数据管理',
        dataDesc: '支持自定义要素类型和属性字段，通过字典管理功能灵活配置业务数据模型，适应不同行业和业务场景的需求。',
        dictTitle: '字典管理',
        dictDesc: '强大的字典管理功能，支持按点、线、面分类管理要素类型，自定义属性字段（文本、数字、日期、布尔、下拉、评分等），灵活配置业务数据模型。',
        layerTitle: '图层控制',
        layerDesc: '智能图层控制系统，支持按要素类型分组显示/隐藏，手风琴式折叠设计，让地图展示更加清晰有序。',
      },
      useCases: {
        title: '应用场景',
        case1: {
          title: '教育机构选址',
          desc: '分析周边学校分布、生源热力、竞争对手位置，找到最佳校区选址',
        },
        case2: {
          title: '连锁门店拓展',
          desc: '评估商圈潜力、分析竞争密度、规划服务覆盖范围，制定扩张策略',
        },
        case3: {
          title: '市场调研分析',
          desc: '收集和整理市场数据，通过地图可视化分析市场格局和机会',
        },
      },
      advantages: {
        title: '核心优势',
        adv1: {
          title: '专业地图引擎',
          desc: '基于 Mapbox GL，提供流畅的交互体验和专业的可视化效果',
        },
        adv2: {
          title: '灵活数据模型',
          desc: '字典管理功能让系统适应不同行业，无需修改代码即可扩展',
        },
        adv3: {
          title: '直观操作界面',
          desc: '简洁直观的操作界面，支持拖拽绘制、批量管理等便捷功能',
        },
      },
    },
  },
};

/**
 * 权限定义配置表 (Source of Truth)
 * 格式：系统 -> 模块 -> 动作 (Key)
 */
export const PERMISSION_TREE = [
  // 1. 🎓 教务管理系统
  {
    id: 'education',
    label: '🎓 教务管理系统',
    children: [
      {
        id: 'edu_dashboard',
        label: '仪表盘',
        actions: [{ value: 'edu:dashboard:view', label: '查看概览' }]
      },
      {
        id: 'edu_student',
        label: '学员管理',
        actions: [
          { value: 'edu:student:view', label: '查看学员列表' },
          { value: 'edu:student:create', label: '新增学员' },
          { value: 'edu:student:edit', label: '编辑学员信息' },
          { value: 'edu:student:delete', label: '删除学员' } // 危险操作
        ]
      },
      {
        id: 'edu_attendance',
        label: '考勤中心',
        actions: [
          { value: 'edu:attendance:view', label: '查看考勤表' },
          { value: 'edu:attendance:edit', label: '修改考勤记录' }
        ]
      },
      {
        id: 'edu_class',
        label: '班级管理',
        actions: [
          { value: 'edu:class:manage', label: '管理班级/课程' }
        ]
      },
      {
        id: 'edu_user',
        label: '员工/用户管理',
        actions: [
          { value: 'edu:user:view', label: '查看员工列表' },
          { value: 'edu:user:manage', label: '管理员工账号' } // 修改密码、权限配置
        ]
      }
    ]
  },

  // 2. 📊 商业分析地图
  {
    id: 'analytics',
    label: '📊 商业分析地图',
    children: [
      {
        id: 'ana_map',
        label: '地图与策略',
        actions: [
          { value: 'ana:map:view', label: '查看商业地图' },
          { value: 'ana:data:export', label: '导出分析数据' }
        ]
      }
    ]
  },

  // 3. 🏠 家庭成长银行
  {
    id: 'family',
    label: '🏠 家庭成长银行',
    children: [
      {
        id: 'fam_dashboard',
        label: '银行账户',
        actions: [
          { value: 'fam:account:view', label: '查看余额/流水' }
        ]
      },
      {
        id: 'fam_task',
        label: '任务系统',
        actions: [
          { value: 'fam:task:view', label: '查看任务' },
          { value: 'fam:task:manage', label: '发布/审核任务' }
        ]
      },
      {
        id: 'fam_auction',
        label: '拍卖行',
        actions: [
          { value: 'fam:auction:bid', label: '参与竞拍' },
          { value: 'fam:auction:manage', label: '管理拍卖品' }
        ]
      }
    ]
  },

  // 4. 🍎 餐饮系统 (根据你的文件推断)
  {
    id: 'catering',
    label: '🍎 餐饮管理',
    children: [
      {
        id: 'cat_menu',
        label: '每周食谱',
        actions: [
          { value: 'cat:menu:view', label: '查看食谱' },
          { value: 'cat:menu:edit', label: '编辑食谱' }
        ]
      },
      {
        id: 'cat_cost',
        label: '成本分析',
        actions: [{ value: 'cat:cost:view', label: '查看成本分析' }]
      }
    ]
  }
];

// 辅助：提取所有权限 Key (用于超级管理员默认全选)
export const ALL_PERMISSION_KEYS = PERMISSION_TREE.flatMap(sys => 
  sys.children.flatMap(mod => mod.actions.map(act => act.value))
);
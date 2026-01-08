/**
 * 权限树构建工具函数
 * 将扁平权限数组转换为树形结构
 */

/**
 * 构建权限树
 * @param {Array} permissions - 扁平权限数组
 * @returns {Array} 树形权限结构
 */
export function buildPermissionTree(permissions) {
  if (!permissions || permissions.length === 0) {
    return [];
  }

  // 按 module 分组
  const moduleMap = {};
  const rootNodes = [];

  permissions.forEach(permission => {
    const module = permission.module;
    
    // 如果模块节点不存在，创建模块节点
    if (!moduleMap[module]) {
      const moduleNode = {
        code: module,
        name: getModuleName(module),
        children: [],
        isModule: true
      };
      moduleMap[module] = moduleNode;
      rootNodes.push(moduleNode);
    }

    // 添加权限子节点
    moduleMap[module].children.push({
      ...permission,
      isPermission: true
    });
  });

  // 对每个模块的子节点按 sort_order 排序
  rootNodes.forEach(node => {
    node.children.sort((a, b) => {
      if (a.sort_order !== undefined && b.sort_order !== undefined) {
        return a.sort_order - b.sort_order;
      }
      return a.id - b.id;
    });
  });

  // 对根节点排序
  rootNodes.sort((a, b) => {
    const orderA = getModuleOrder(a.code);
    const orderB = getModuleOrder(b.code);
    return orderA - orderB;
  });

  return rootNodes;
}

/**
 * 获取模块显示名称
 * @param {string} module - 模块代码
 * @returns {string} 模块名称
 */
function getModuleName(module) {
  const moduleNames = {
    student: '学员管理',
    order: '订单管理',
    user: '用户管理',
    class: '课程管理',
    attendance: '签到管理',
    dashboard: '仪表盘',
    report: '报表管理',
    dailyReport: '日报管理',
    map: '地图管理',
    catering: '餐饮管理',
    permission: '权限管理',
  };
  return moduleNames[module] || module;
}

/**
 * 获取模块排序顺序
 * @param {string} module - 模块代码
 * @returns {number} 排序顺序
 */
function getModuleOrder(module) {
  const moduleOrders = {
    student: 1,
    order: 2,
    user: 3,
    class: 4,
    attendance: 5,
    dashboard: 6,
    report: 7,
    dailyReport: 8,
    map: 9,
    catering: 10,
    permission: 99, // 权限管理放在最后
  };
  return moduleOrders[module] || 999;
}

/**
 * 扁平化权限树（用于权限ID提取）
 * @param {Array} tree - 权限树
 * @returns {Array} 扁平权限数组
 */
export function flattenPermissionTree(tree) {
  const result = [];
  
  function traverse(nodes) {
    nodes.forEach(node => {
      if (node.isPermission) {
        result.push(node);
      } else if (node.children) {
        traverse(node.children);
      }
    });
  }
  
  traverse(tree);
  return result;
}


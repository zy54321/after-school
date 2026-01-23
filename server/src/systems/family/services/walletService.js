/**
 * Wallet Service Layer
 * 负责钱包/积分业务逻辑处理
 */
const walletRepo = require('../repos/walletRepo');

/**
 * 获取成员积分余额
 * @param {number} memberId - 成员ID
 * @returns {number} 积分余额
 */
exports.getBalance = async (memberId) => {
  return await walletRepo.getBalance(memberId);
};

/**
 * 获取成员积分流水列表
 * @param {number} memberId - 成员ID
 * @param {object} options - 查询选项
 * @param {number} options.limit - 限制条数（默认 50）
 * @param {number} options.offset - 偏移量（默认 0）
 * @param {string} options.reasonCode - 筛选原因代码
 * @param {Date} options.startDate - 开始日期
 * @param {Date} options.endDate - 结束日期
 * @returns {object} 流水列表和分页信息
 */
exports.listLogs = async (memberId, options = {}) => {
  const { limit = 50, offset = 0 } = options;
  
  const [logs, total] = await Promise.all([
    walletRepo.listLogs(memberId, options),
    walletRepo.countLogs(memberId, options),
  ]);
  
  return {
    logs,
    total,
    limit,
    offset,
    hasMore: offset + logs.length < total,
  };
};

/**
 * 获取成员钱包概览（余额 + 统计）
 * @param {number} memberId - 成员ID
 * @returns {object} 钱包概览信息
 */
exports.getWalletOverview = async (memberId) => {
  const stats = await walletRepo.getPointsStats(memberId);
  return {
    balance: stats.balance,
    totalEarned: stats.totalEarned,
    totalSpent: stats.totalSpent,
  };
};

/**
 * 获取成员信息
 * @param {number} memberId - 成员ID
 * @returns {object} 成员信息
 */
exports.getMemberById = async (memberId) => {
  return await walletRepo.getMemberById(memberId);
};

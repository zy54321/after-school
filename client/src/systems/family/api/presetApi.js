/**
 * 预设规则 API 封装
 * 成员级预设规则管理
 */
import axios from 'axios';

/**
 * 获取成员的预设规则列表
 * @param {number} memberId - 成员ID
 * @returns {Promise<Array>} 预设规则列表
 */
export const getMemberPresets = async (memberId) => {
  if (!memberId) {
    throw new Error('memberId 不能为空');
  }
  const res = await axios.get(`/api/v2/family/member/${memberId}/presets`);
  if (res.data?.code === 200) {
    return res.data.data || [];
  }
  throw new Error(res.data?.msg || '获取预设规则失败');
};

/**
 * 获取成员的奖励规则
 * @param {number} memberId - 成员ID
 * @returns {Promise<Array>} 奖励规则列表
 */
export const getMemberRewardRules = async (memberId) => {
  if (!memberId) {
    throw new Error('memberId 不能为空');
  }
  const res = await axios.get(`/api/v2/family/member/${memberId}/rewards`);
  if (res.data?.code === 200) {
    return res.data.data || [];
  }
  throw new Error(res.data?.msg || '获取奖励规则失败');
};

/**
 * 获取成员的惩罚规则
 * @param {number} memberId - 成员ID
 * @returns {Promise<Array>} 惩罚规则列表
 */
export const getMemberPenaltyRules = async (memberId) => {
  if (!memberId) {
    throw new Error('memberId 不能为空');
  }
  const res = await axios.get(`/api/v2/family/member/${memberId}/penalties`);
  if (res.data?.code === 200) {
    return res.data.data || [];
  }
  throw new Error(res.data?.msg || '获取惩罚规则失败');
};

/**
 * 创建成员预设规则
 * @param {number} memberId - 成员ID
 * @param {object} payload - 预设规则数据
 * @param {string} payload.label - 规则名称
 * @param {number} payload.points - 积分值
 * @param {string} payload.type - 类型 ('add' | 'deduct')
 * @param {string} payload.icon - 图标
 * @param {string} payload.category - 分类
 * @returns {Promise<object>} 创建的预设规则
 */
export const createMemberPreset = async (memberId, payload) => {
  if (!memberId) {
    throw new Error('memberId 不能为空');
  }
  if (!payload.label) {
    throw new Error('label 不能为空');
  }
  if (!payload.type || !['add', 'deduct'].includes(payload.type)) {
    throw new Error('type 必须是 "add" 或 "deduct"');
  }
  
  const res = await axios.post(`/api/v2/family/member/${memberId}/presets`, payload);
  if (res.data?.code === 200) {
    return res.data.data;
  }
  throw new Error(res.data?.msg || '创建预设规则失败');
};

/**
 * 更新成员预设规则
 * @param {number} memberId - 成员ID
 * @param {number} id - 预设规则ID
 * @param {object} payload - 预设规则数据
 * @returns {Promise<object>} 更新后的预设规则
 */
export const updateMemberPreset = async (memberId, id, payload) => {
  if (!memberId || !id) {
    throw new Error('memberId 和 id 不能为空');
  }
  
  const res = await axios.put(`/api/v2/family/member/${memberId}/presets/${id}`, payload);
  if (res.data?.code === 200) {
    return res.data.data;
  }
  throw new Error(res.data?.msg || '更新预设规则失败');
};

/**
 * 删除成员预设规则
 * @param {number} memberId - 成员ID
 * @param {number} id - 预设规则ID
 * @returns {Promise<void>}
 */
export const deleteMemberPreset = async (memberId, id) => {
  if (!memberId || !id) {
    throw new Error('memberId 和 id 不能为空');
  }
  
  const res = await axios.delete(`/api/v2/family/member/${memberId}/presets/${id}`);
  // 成功删除返回 204 No Content 或 200
  if (res.status === 204 || (res.data?.code === 200)) {
    return;
  }
  // 404 表示不存在
  if (res.status === 404 || res.data?.code === 404) {
    throw new Error(res.data?.msg || '预设规则不存在或不属于该成员');
  }
  throw new Error(res.data?.msg || '删除预设规则失败');
};

// ========== 兼容旧接口（已废弃） ==========

/**
 * 获取所有预设（已废弃）
 * @deprecated 请使用 getMemberPresets(memberId)
 */
export const getPresets = async () => {
  throw new Error('此接口已废弃，请使用 getMemberPresets(memberId)');
};

/**
 * 创建预设（已废弃）
 * @deprecated 请使用 createMemberPreset(memberId, payload)
 */
export const createPreset = async (payload) => {
  throw new Error('此接口已废弃，请使用 createMemberPreset(memberId, payload)');
};

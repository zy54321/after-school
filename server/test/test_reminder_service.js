/**
 * 提醒系统服务测试
 * 验证 reminderService 的核心功能
 */

const pool = require('../src/shared/config/db');
const reminderService = require('../src/systems/family/services/reminderService');
const reminderRepo = require('../src/systems/family/repos/reminderRepo');

async function runTests() {
  console.log('🧪 开始测试提醒系统服务...\n');
  
  let passed = 0;
  let failed = 0;
  let testPolicyId = null;
  let testEventId = null;
  let testParentId = null;
  let testMemberId = null;
  
  const test = (name, fn) => async () => {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (err) {
      console.log(`❌ ${name}`);
      console.log(`   错误: ${err.message}`);
      failed++;
    }
  };
  
  // 准备测试数据
  await test('准备测试数据', async () => {
    const userResult = await pool.query('SELECT id FROM users LIMIT 1');
    if (userResult.rows.length === 0) throw new Error('没有可用的用户');
    testParentId = userResult.rows[0].id;
    
    const memberResult = await pool.query('SELECT id FROM family_members WHERE parent_id = $1 LIMIT 1', [testParentId]);
    if (memberResult.rows.length > 0) {
      testMemberId = memberResult.rows[0].id;
    }
    
    console.log(`      用户ID: ${testParentId}, 成员ID: ${testMemberId || '无'}`);
  })();
  
  // 测试 1: 创建提醒策略
  await test('创建提醒策略', async () => {
    const result = await reminderService.createPolicy({
      parentId: testParentId,
      name: '测试策略-' + Date.now(),
      description: '测试用策略',
      policyType: 'custom',
      config: { test: true },
      channels: ['app', 'push'],
    });
    
    if (!result.success || !result.policy) throw new Error('创建失败');
    testPolicyId = result.policy.id;
    console.log(`      策略ID: ${testPolicyId}`);
  })();
  
  // 测试 2: 获取策略列表
  await test('获取策略列表', async () => {
    const policies = await reminderService.getPoliciesByParentId(testParentId);
    if (!Array.isArray(policies)) throw new Error('返回格式错误');
    console.log(`      策略数量: ${policies.length}`);
  })();
  
  // 测试 3: 更新策略状态
  await test('更新策略状态', async () => {
    const result = await reminderService.updatePolicyStatus(testPolicyId, 'paused');
    if (!result.success || result.policy.status !== 'paused') throw new Error('更新失败');
    console.log(`      新状态: ${result.policy.status}`);
  })();
  
  // 测试 4: 创建提醒事件
  await test('创建提醒事件', async () => {
    const result = await reminderService.createEvent({
      parentId: testParentId,
      memberId: testMemberId,
      targetType: 'task',
      targetId: 1,
      title: '测试提醒-' + Date.now(),
      message: '这是一条测试提醒消息',
      fireAt: new Date(Date.now() - 1000), // 设置为过去时间，立即可扫描
      channel: 'app',
      status: 'pending',
      policyId: testPolicyId,
    });
    
    if (!result.success || !result.event) throw new Error('创建失败');
    testEventId = result.event.id;
    console.log(`      事件ID: ${testEventId}`);
  })();
  
  // 测试 5: 获取事件列表
  await test('获取事件列表', async () => {
    const events = await reminderService.getEventsByParentId(testParentId);
    if (!Array.isArray(events)) throw new Error('返回格式错误');
    console.log(`      事件数量: ${events.length}`);
  })();
  
  // 测试 6: 获取逾期提醒
  await test('获取逾期提醒', async () => {
    const events = await reminderService.getOverdueEvents(testParentId);
    if (!Array.isArray(events)) throw new Error('返回格式错误');
    console.log(`      逾期数量: ${events.length}`);
  })();
  
  // 测试 7: 扫描并发送提醒
  await test('扫描并发送提醒', async () => {
    const result = await reminderService.scanAndSendReminders(10);
    
    if (!result.success) throw new Error('扫描失败');
    console.log(`      扫描: ${result.scanned}, 发送: ${result.sent}, 失败: ${result.failed}`);
  })();
  
  // 测试 8: 验证事件状态变为 sent
  await test('验证事件状态变为 sent', async () => {
    const event = await reminderService.getEventById(testEventId);
    if (event.status !== 'sent') throw new Error(`状态不正确: ${event.status}`);
    console.log(`      状态: ${event.status}`);
  })();
  
  // 测试 9: 标记为已读
  await test('标记事件为已读', async () => {
    const result = await reminderService.markEventAsRead(testEventId);
    if (!result.success || result.event.status !== 'read') throw new Error('标记失败');
    console.log(`      状态: ${result.event.status}`);
  })();
  
  // 测试 10: 创建自定义提醒
  await test('创建自定义提醒', async () => {
    const result = await reminderService.createCustomReminder({
      parentId: testParentId,
      memberId: testMemberId,
      title: '自定义提醒测试',
      message: '测试消息',
      fireAt: new Date(Date.now() + 3600000), // 1小时后
      channel: 'push',
    });
    
    if (!result.success || !result.event) throw new Error('创建失败');
    console.log(`      自定义提醒ID: ${result.event.id}`);
    
    // 取消这个提醒
    await reminderService.cancelEvent(result.event.id);
  })();
  
  // 测试 11: 获取提醒统计
  await test('获取提醒统计', async () => {
    const stats = await reminderService.getReminderStats(testParentId);
    if (!stats) throw new Error('获取失败');
    console.log(`      总数: ${stats.total_events}, 待发送: ${stats.pending_count}, 已读: ${stats.read_count}`);
  })();
  
  // 清理测试数据
  await test('清理测试数据', async () => {
    // 删除测试事件
    await pool.query('DELETE FROM reminder_event WHERE title LIKE $1', ['测试提醒-%']);
    await pool.query('DELETE FROM reminder_event WHERE title = $1', ['自定义提醒测试']);
    // 删除测试策略
    await pool.query('DELETE FROM reminder_policy WHERE name LIKE $1', ['测试策略-%']);
    console.log('      已清理');
  })();
  
  // 汇总
  console.log('\n' + '='.repeat(50));
  console.log(`测试完成: ${passed} 通过, ${failed} 失败`);
  console.log('='.repeat(50));
  
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('测试运行失败:', err);
  process.exit(1);
});

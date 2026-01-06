/**
 * 预警生成器
 * 检测学员表现异常情况并生成预警
 */

// ==================== 配置项 ====================
const DEFAULT_CONFIG = {
  // 专注力下降预警：连续下降天数
  focusDeclineDays: 3,
  
  // 专注力下降阈值：下降幅度（分钟）
  focusDeclineThreshold: 20,
  
  // 作业质量预警：连续C级天数
  homeworkQualityDays: 2,
  
  // 走神频率预警：连续高走神天数
  distractionFrequencyDays: 3,
  
  // 走神频率阈值：走神次数
  distractionFrequencyThreshold: 5,
  
  // 行为习惯预警：连续C级天数
  habitDeclineDays: 3,
};

// ==================== 辅助函数 ====================

/**
 * 将日期字符串转换为Date对象
 */
function parseDate(dateStr) {
  if (dateStr instanceof Date) return dateStr;
  return new Date(dateStr);
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date) {
  const d = parseDate(date);
  return d.toISOString().split('T')[0];
}

/**
 * 计算两个日期之间的天数差
 */
function daysBetween(date1, date2) {
  const d1 = parseDate(date1);
  const d2 = parseDate(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 评级转换为数值（A=3, B=2, C=1）
 */
function ratingToNumber(rating) {
  const map = { A: 3, B: 2, C: 1 };
  return map[rating] || 1;
}

// ==================== 预警规则1：专注力下降预警 ====================

/**
 * 检测专注力下降预警
 */
function checkFocusDecline(currentData, historyData, config) {
  if (!historyData || historyData.length < config.focusDeclineDays) {
    return null;
  }

  // 按日期排序（从早到晚）
  const sortedData = [...historyData]
    .filter((d) => d.focus_minutes != null)
    .sort((a, b) => {
      const dateA = parseDate(a.report_date);
      const dateB = parseDate(b.report_date);
      return dateA - dateB;
    });

  // 添加当前数据
  const allData = [...sortedData];
  if (currentData.focus_minutes != null) {
    allData.push({
      report_date: currentData.report_date || new Date(),
      focus_minutes: currentData.focus_minutes,
    });
  }

  if (allData.length < config.focusDeclineDays + 1) {
    return null;
  }

  // 检查最近N天是否连续下降
  const recentDays = allData.slice(-(config.focusDeclineDays + 1));
  let declineCount = 0;

  for (let i = 1; i < recentDays.length; i++) {
    const prev = recentDays[i - 1].focus_minutes || 0;
    const curr = recentDays[i].focus_minutes || 0;
    const diff = prev - curr;

    if (diff >= config.focusDeclineThreshold) {
      declineCount++;
    } else {
      // 如果中间有上升，重置计数
      declineCount = 0;
    }
  }

  if (declineCount >= config.focusDeclineDays) {
    const firstFocus = recentDays[0].focus_minutes || 0;
    const lastFocus = recentDays[recentDays.length - 1].focus_minutes || 0;
    const totalDecline = firstFocus - lastFocus;

    // 确定预警级别
    let level = 'light';
    if (totalDecline >= 60) {
      level = 'severe';
    } else if (totalDecline >= 40) {
      level = 'medium';
    }

    return {
      type: 'focus_decline',
      level,
      title: '专注力下降提醒',
      description: `连续${declineCount}天专注时长下降，累计下降${totalDecline}分钟`,
      suggestion: level === 'severe'
        ? '专注力下降明显，建议与老师沟通，共同制定提升计划，设定小目标逐步恢复专注力。'
        : level === 'medium'
        ? '专注力有所下降，建议设定小目标，逐步提升专注力，保持良好学习状态。'
        : '专注力略有下降，建议关注学习环境，减少干扰因素，逐步恢复专注力。',
    };
  }

  return null;
}

// ==================== 预警规则2：作业质量预警 ====================

/**
 * 检测作业质量预警
 */
function checkHomeworkQuality(currentData, historyData, config) {
  if (!historyData || historyData.length < config.homeworkQualityDays - 1) {
    // 如果历史数据不足，只检查当前数据
    if (currentData.homework_rating === 'C') {
      return {
        type: 'homework_quality',
        level: 'light',
        title: '作业质量提醒',
        description: '今日作业评级为C',
        suggestion: '建议回家复盘作业，找出问题所在，明天会更好。',
      };
    }
    return null;
  }

  // 按日期排序（从早到晚）
  const sortedData = [...historyData]
    .filter((d) => d.homework_rating)
    .sort((a, b) => {
      const dateA = parseDate(a.report_date);
      const dateB = parseDate(b.report_date);
      return dateA - dateB;
    });

  // 添加当前数据
  const allData = [...sortedData];
  if (currentData.homework_rating) {
    allData.push({
      report_date: currentData.report_date || new Date(),
      homework_rating: currentData.homework_rating,
    });
  }

  if (allData.length < config.homeworkQualityDays) {
    return null;
  }

  // 检查最近N天是否连续为C级
  const recentDays = allData.slice(-config.homeworkQualityDays);
  const allC = recentDays.every((d) => d.homework_rating === 'C');

  if (allC) {
    // 确定预警级别
    let level = 'medium';
    if (recentDays.length >= 3) {
      level = 'severe';
    }

    return {
      type: 'homework_quality',
      level,
      title: '作业质量提醒',
      description: `连续${recentDays.length}天作业评级为C`,
      suggestion: level === 'severe'
        ? '作业质量持续不佳，建议与老师深入沟通，找出根本原因，制定针对性的改进计划。'
        : '作业质量需要提升，建议回家复盘作业，找出问题所在，加强相关练习。',
    };
  }

  return null;
}

// ==================== 预警规则3：走神频率预警 ====================

/**
 * 检测走神频率预警
 */
function checkDistractionFrequency(currentData, historyData, config) {
  if (!historyData || historyData.length < config.distractionFrequencyDays - 1) {
    // 如果历史数据不足，只检查当前数据
    if (currentData.distraction_count >= config.distractionFrequencyThreshold) {
      return {
        type: 'distraction_frequency',
        level: 'light',
        title: '走神频率提醒',
        description: `今日走神${currentData.distraction_count}次`,
        suggestion: '建议训练抗干扰能力，在安静的环境中学习，设定短时间的学习目标。',
      };
    }
    return null;
  }

  // 按日期排序（从早到晚）
  const sortedData = [...historyData]
    .filter((d) => d.distraction_count != null)
    .sort((a, b) => {
      const dateA = parseDate(a.report_date);
      const dateB = parseDate(b.report_date);
      return dateA - dateB;
    });

  // 添加当前数据
  const allData = [...sortedData];
  if (currentData.distraction_count != null) {
    allData.push({
      report_date: currentData.report_date || new Date(),
      distraction_count: currentData.distraction_count,
    });
  }

  if (allData.length < config.distractionFrequencyDays) {
    return null;
  }

  // 检查最近N天是否连续高走神
  const recentDays = allData.slice(-config.distractionFrequencyDays);
  const allHigh = recentDays.every(
    (d) => d.distraction_count >= config.distractionFrequencyThreshold
  );

  if (allHigh) {
    const avgDistraction = Math.round(
      recentDays.reduce((sum, d) => sum + d.distraction_count, 0) /
        recentDays.length
    );

    // 确定预警级别
    let level = 'medium';
    if (avgDistraction >= 7) {
      level = 'severe';
    }

    return {
      type: 'distraction_frequency',
      level,
      title: '走神频率提醒',
      description: `连续${recentDays.length}天走神次数≥${config.distractionFrequencyThreshold}次，平均${avgDistraction}次`,
      suggestion: level === 'severe'
        ? '走神频率较高，建议与老师沟通，共同制定专注力训练计划，必要时考虑调整学习环境。'
        : '走神频率较高，建议训练抗干扰能力，在安静的环境中学习，设定短时间的学习目标，逐步提升专注力。',
    };
  }

  return null;
}

// ==================== 预警规则4：行为习惯预警 ====================

/**
 * 检测行为习惯预警（包括纪律评级和习惯评级）
 */
function checkHabitDecline(currentData, historyData, config) {
  if (!historyData || historyData.length < config.habitDeclineDays - 1) {
    // 如果历史数据不足，只检查当前数据
    if (
      currentData.discipline_rating === 'C' ||
      currentData.habit_rating === 'C'
    ) {
      const type = currentData.discipline_rating === 'C' ? '纪律' : '习惯';
      return {
        type: 'habit_decline',
        level: 'light',
        title: '行为习惯提醒',
        description: `今日${type}评级为C`,
        suggestion: `建议关注${type}表现，与老师沟通，共同制定改进计划。`,
      };
    }
    return null;
  }

  // 按日期排序（从早到晚）
  const sortedData = [...historyData]
    .filter(
      (d) => d.discipline_rating || d.habit_rating
    )
    .sort((a, b) => {
      const dateA = parseDate(a.report_date);
      const dateB = parseDate(b.report_date);
      return dateA - dateB;
    });

  // 添加当前数据
  const allData = [...sortedData];
  if (currentData.discipline_rating || currentData.habit_rating) {
    allData.push({
      report_date: currentData.report_date || new Date(),
      discipline_rating: currentData.discipline_rating,
      habit_rating: currentData.habit_rating,
    });
  }

  if (allData.length < config.habitDeclineDays) {
    return null;
  }

  // 检查最近N天是否连续为C级（纪律或习惯）
  const recentDays = allData.slice(-config.habitDeclineDays);
  
  // 检查纪律评级
  const disciplineAllC = recentDays.every(
    (d) => d.discipline_rating === 'C'
  );
  
  // 检查习惯评级
  const habitAllC = recentDays.every(
    (d) => d.habit_rating === 'C'
  );

  if (disciplineAllC || habitAllC) {
    const type = disciplineAllC ? '纪律' : '习惯';
    const level = recentDays.length >= 3 ? 'severe' : 'medium';

    return {
      type: 'habit_decline',
      level,
      title: '行为习惯提醒',
      description: `连续${recentDays.length}天${type}评级为C`,
      suggestion: level === 'severe'
        ? `${type}表现持续不佳，建议与老师深入沟通，找出根本原因，制定针对性的改进计划，家长配合监督执行。`
        : `${type}表现需要提升，建议关注${type}表现，与老师沟通，共同制定改进计划，家长配合监督。`,
    };
  }

  return null;
}

// ==================== 主函数 ====================

/**
 * 生成预警列表
 * @param {Object} currentData - 当前数据
 * @param {Array} historyData - 历史数据（最近7天，按日期升序）
 * @param {Object} config - 配置项（可选）
 * @returns {Array} 预警数组
 */
function generateAlerts(currentData, historyData, config = {}) {
  // 合并配置
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const alerts = [];

  // 执行四个预警检测
  const focusDeclineAlert = checkFocusDecline(
    currentData,
    historyData,
    finalConfig
  );
  if (focusDeclineAlert) {
    alerts.push(focusDeclineAlert);
  }

  const homeworkQualityAlert = checkHomeworkQuality(
    currentData,
    historyData,
    finalConfig
  );
  if (homeworkQualityAlert) {
    alerts.push(homeworkQualityAlert);
  }

  const distractionFrequencyAlert = checkDistractionFrequency(
    currentData,
    historyData,
    finalConfig
  );
  if (distractionFrequencyAlert) {
    alerts.push(distractionFrequencyAlert);
  }

  const habitDeclineAlert = checkHabitDecline(
    currentData,
    historyData,
    finalConfig
  );
  if (habitDeclineAlert) {
    alerts.push(habitDeclineAlert);
  }

  // 按级别排序：severe > medium > light
  const levelOrder = { severe: 3, medium: 2, light: 1 };
  alerts.sort((a, b) => levelOrder[b.level] - levelOrder[a.level]);

  return alerts;
}

module.exports = {
  generateAlerts,
  DEFAULT_CONFIG,
};


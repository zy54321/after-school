/**
 * 个性化评语生成器
 * 基于多策略组合生成自然、个性化的评语
 */

// ==================== 策略1：多模板库 ====================
const TEMPLATES = {
  // 完美表现模板（专注时长≥200，作业A，走神0次）
  perfect: [
    {
      style: 'formal',
      templates: [
        '今天{name}表现完美！专注时长达到{focus}分钟，作业质量全优，全程零走神，是真正的专注小达人！🌟',
        '今天{name}的表现堪称完美！{focus}分钟的专注时长，作业全优，而且一次都没有走神，这样的状态真棒！🎯',
        '今天{name}用行动证明了什么是优秀！{focus}分钟全神贯注，作业质量没得说，走神次数为零，继续保持这个状态！💪',
      ],
    },
    {
      style: 'warm',
      templates: [
        '今天{name}的表现让老师眼前一亮！{focus}分钟的专注时长，作业全优，而且一次都没有走神，这份专注力值得表扬！✨',
        '看到{name}今天这么认真，老师真的很欣慰！{focus}分钟全神贯注，作业完成得又快又好，全程零走神，继续保持这个状态！💖',
      ],
    },
    {
      style: 'encouraging',
      templates: [
        '今天{name}的表现比昨天更出色！{focus}分钟的专注时长，作业全优，而且今天一次都没有走神，进步很明显！继续加油！🚀',
        '今天{name}用行动证明了什么是优秀！{focus}分钟全神贯注，作业质量没得说，走神次数为零，继续保持这个状态！💪',
      ],
    },
    {
      style: 'detailed',
      templates: [
        '今天{name}的表现堪称完美！从开始到结束，{focus}分钟里始终保持高度专注，作业完成得又快又好，全程零走神，这样的状态真棒！🎯',
        '今天{name}的表现让老师特别开心！{focus}分钟全神贯注，作业质量全优，而且一次都没有走神。看到{name}这么认真，老师真的很欣慰！💖',
      ],
    },
  ],

  // 优秀表现模板（专注时长≥180，作业A/B，走神≤2次）
  excellent: [
    {
      style: 'warm',
      templates: [
        '今天{name}表现很棒！专注时长{focus}分钟，作业质量{homework_desc}，走神{distraction_desc}，继续保持！✨',
        '今天{name}的表现让老师很满意！{focus}分钟的专注时长，作业完成得{homework_desc}，走神{distraction_desc}，这样的状态很好！💪',
      ],
    },
    {
      style: 'encouraging',
      templates: [
        '今天{name}的表现不错！{focus}分钟全神贯注，作业质量{homework_desc}，走神{distraction_desc}，继续加油！🚀',
        '看到{name}今天的表现，老师很欣慰！{focus}分钟的专注时长，作业{homework_desc}，走神{distraction_desc}，继续保持！🌟',
      ],
    },
  ],

  // 良好表现模板（专注时长≥150，作业B/C，走神≤4次）
  good: [
    {
      style: 'warm',
      templates: [
        '今天{name}表现良好！专注时长{focus}分钟，作业质量{homework_desc}，走神{distraction_desc}，还有进步空间，继续努力！💪',
        '今天{name}的表现平稳！{focus}分钟的专注时长，作业{homework_desc}，走神{distraction_desc}，继续保持，相信会越来越好！✨',
      ],
    },
    {
      style: 'encouraging',
      templates: [
        '今天{name}的表现还可以！{focus}分钟专注学习，作业质量{homework_desc}，走神{distraction_desc}，继续加油，相信会更好！🚀',
        '看到{name}今天的表现，老师相信{name}可以做得更好！{focus}分钟的专注时长，作业{homework_desc}，走神{distraction_desc}，继续努力！🌟',
      ],
    },
  ],

  // 需要改进模板（专注时长<150，作业C，走神≥5次）
  needsImprovement: [
    {
      style: 'warm',
      templates: [
        '今天{name}的专注时长{focus}分钟，作业质量{homework_desc}，走神{distraction_desc}。建议设定小目标，逐步提升专注力，相信{name}会越来越好！💪',
        '今天{name}的表现还有提升空间。专注时长{focus}分钟，作业{homework_desc}，走神{distraction_desc}。建议回家复盘，找出问题所在，明天会更好！✨',
      ],
    },
    {
      style: 'encouraging',
      templates: [
        '今天{name}的专注时长{focus}分钟，作业质量{homework_desc}，走神{distraction_desc}。虽然今天有些挑战，但相信{name}可以克服，继续加油！🚀',
        '看到{name}今天的表现，老师相信{name}有潜力做得更好！专注时长{focus}分钟，作业{homework_desc}，走神{distraction_desc}。建议设定小目标，逐步提升！🌟',
      ],
    },
  ],
};

// ==================== 策略2：同义词库 ====================
const SYNONYMS = {
  // 专注时长表达
  focusExpressions: [
    '专注时长达到{focus}分钟',
    '{focus}分钟全神贯注',
    '持续专注了{focus}分钟',
    '{focus}分钟里始终保持高度专注',
    '整整{focus}分钟都保持专注',
    '{focus}分钟专注学习',
  ],

  // 作业质量表达
  homeworkExpressions: {
    A: ['全优', '完成得又快又好', '质量没得说', '完成得特别棒', '做得非常出色', '质量优秀'],
    B: ['良好', '完成得不错', '质量还可以', '完成得还可以', '做得不错', '质量良好'],
    C: ['需要改进', '有些问题', '质量有待提升', '需要复盘', '暴露了一些问题', '质量需要提升'],
  },

  // 走神次数表达
  distractionExpressions: {
    0: ['全程零走神', '一次都没有走神', '完全没有走神', '走神次数为零', '保持了完美的专注状态'],
    1: ['只走神了1次', '走神1次，进步很大', '仅走神1次', '走神1次，表现不错'],
    2: ['走神2次', '走神2次，还可以', '走神2次，表现良好'],
    3: ['走神3次', '走神3次，还有进步空间', '走神3次，需要继续努力'],
    4: ['走神4次', '走神4次，需要提升专注力', '走神4次，建议加强训练'],
    5: ['走神5次', '走神5次，需要重点训练抗干扰能力', '走神5次，建议设定小目标'],
  },

  // 表扬表达
  praiseExpressions: [
    '表现完美',
    '表现让老师眼前一亮',
    '表现堪称完美',
    '表现比昨天更出色',
    '用行动证明了什么是优秀',
    '表现很棒',
    '表现让老师很满意',
    '表现不错',
    '表现良好',
    '表现平稳',
  ],
};

// ==================== 辅助函数 ====================

/**
 * 基于学员ID生成随机种子，确保相同数据不同学员生成不同评语
 */
function getRandomSeed(studentId, date) {
  const seed = `${studentId}_${date}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * 基于种子生成随机数（0-1之间）
 */
function seededRandom(seed, index = 0) {
  const x = Math.sin((seed + index) * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * 从数组中随机选择一个元素
 */
function randomChoice(array, seed, index = 0) {
  if (!array || array.length === 0) return null;
  const randomIndex = Math.floor(seededRandom(seed, index) * array.length);
  return array[randomIndex];
}

/**
 * 分析学员类型（进步型/稳定型/波动型/改进型）
 */
function analyzeStudentType(historyData) {
  if (!historyData || historyData.length < 3) {
    return 'stable'; // 数据不足，默认稳定型
  }

  const focusMinutes = historyData.map((h) => h.focus_minutes || 0);
  const recent = focusMinutes.slice(0, 3); // 最近3天
  const previous = focusMinutes.slice(3, 6); // 前3天

  // 计算趋势
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const previousAvg = previous.length > 0 ? previous.reduce((a, b) => a + b, 0) / previous.length : recentAvg;

  const trend = recentAvg - previousAvg;

  if (trend > 20) {
    return 'improving'; // 进步型
  } else if (trend < -20) {
    return 'declining'; // 下降型
  } else if (Math.max(...recent) - Math.min(...recent) > 50) {
    return 'fluctuating'; // 波动型
  } else {
    return 'stable'; // 稳定型
  }
}

/**
 * 获取历史对比信息
 */
function getHistoryComparison(currentData, historyData) {
  if (!historyData || historyData.length < 1) {
    return null;
  }

  // 历史数据可能是升序（从早到晚）或降序（从晚到早）
  // 我们取最后一条（最接近今天的）作为对比基准
  const lastRecord = historyData[historyData.length - 1];
  const todayFocus = currentData.focus_minutes || 0;
  const lastFocus = lastRecord?.focus_minutes || 0;

  const diff = todayFocus - lastFocus;

  if (diff > 20) {
    return {
      type: 'improved',
      text: '今天比昨天更出色',
      detail: `专注时长提升了${diff}分钟`,
    };
  } else if (diff < -20) {
    return {
      type: 'declined',
      text: '今天比昨天稍有下降',
      detail: `专注时长下降了${Math.abs(diff)}分钟`,
    };
  } else if (Math.abs(diff) <= 10) {
    return {
      type: 'stable',
      text: '继续保持这个状态',
      detail: '专注时长保持稳定',
    };
  }

  return null;
}

/**
 * 获取时间特征
 */
function getTimeFeature(date) {
  const d = new Date(date);
  const dayOfWeek = d.getDay();

  if (dayOfWeek === 1) {
    return '新的一周开了个好头';
  } else if (dayOfWeek === 5) {
    return '用完美的表现结束这一周';
  }

  return null;
}

/**
 * 格式化专注时长描述
 */
function formatFocusMinutes(minutes, seed, index) {
  const expressions = SYNONYMS.focusExpressions;
  const expr = randomChoice(expressions, seed, index);
  return expr.replace('{focus}', minutes);
}

/**
 * 格式化作业质量描述
 */
function formatHomeworkRating(rating, seed, index) {
  const expressions = SYNONYMS.homeworkExpressions[rating] || SYNONYMS.homeworkExpressions.C;
  return randomChoice(expressions, seed, index);
}

/**
 * 格式化走神次数描述
 */
function formatDistractionCount(count, seed, index) {
  const key = Math.min(count, 5); // 5次以上统一用5次的表达
  const expressions = SYNONYMS.distractionExpressions[key] || SYNONYMS.distractionExpressions[5];
  return randomChoice(expressions, seed, index);
}

/**
 * 选择语言风格
 */
function selectStyle(seed, index) {
  const styles = ['warm', 'encouraging', 'formal', 'detailed'];
  return randomChoice(styles, seed, index);
}

/**
 * 判断表现等级
 */
function getPerformanceLevel(studentData) {
  const focus = studentData.focus_minutes || 0;
  const homework = studentData.homework_rating || 'C';
  const distraction = studentData.distraction_count || 0;

  // 完美：专注≥200，作业A，走神0
  if (focus >= 200 && homework === 'A' && distraction === 0) {
    return 'perfect';
  }

  // 优秀：专注≥180，作业A/B，走神≤2
  if (focus >= 180 && ['A', 'B'].includes(homework) && distraction <= 2) {
    return 'excellent';
  }

  // 良好：专注≥150，作业B/C，走神≤4
  if (focus >= 150 && distraction <= 4) {
    return 'good';
  }

  // 需要改进
  return 'needsImprovement';
}

/**
 * 生成个性化评语
 * @param {Object} studentData - 当前数据
 * @param {Array} historyData - 最近7天历史数据（已按日期升序排列）
 * @param {number} studentId - 学员ID
 * @param {string} studentName - 学员姓名
 * @param {string} reportDate - 报告日期
 * @returns {string} 个性化评语
 */
function generateComment(studentData, historyData, studentId, studentName, reportDate) {
  // 生成随机种子
  const seed = getRandomSeed(studentId, reportDate);
  let seedIndex = 0;

  // 获取表现等级
  const level = getPerformanceLevel(studentData);
  
  // 选择语言风格
  const style = selectStyle(seed, seedIndex++);
  
  // 获取对应等级的模板组
  const templateGroup = TEMPLATES[level].find((g) => g.style === style) || TEMPLATES[level][0];
  const template = randomChoice(templateGroup.templates, seed, seedIndex++);

  // 准备替换变量
  const focus = studentData.focus_minutes || 0;
  const homeworkRating = studentData.homework_rating || 'C';
  const distractionCount = studentData.distraction_count || 0;

  // 格式化各个部分
  const focusDesc = formatFocusMinutes(focus, seed, seedIndex++);
  const homeworkDesc = formatHomeworkRating(homeworkRating, seed, seedIndex++);
  const distractionDesc = formatDistractionCount(distractionCount, seed, seedIndex++);

  // 获取历史对比信息
  const comparison = getHistoryComparison(studentData, historyData);
  
  // 获取时间特征
  const timeFeature = getTimeFeature(reportDate);

  // 替换模板变量（注意顺序：先替换复杂变量，再替换简单变量）
  let comment = template
    .replace(/{name}/g, studentName)
    .replace(/{focus_desc}/g, focusDesc)
    .replace(/{homework_desc}/g, homeworkDesc)
    .replace(/{distraction_desc}/g, distractionDesc)
    .replace(/{focus}/g, focus);

  // 添加历史对比信息（如果模板中没有，可以追加）
  if (comparison && !comment.includes(comparison.text)) {
    // 根据模板结构决定是否添加
    if (level === 'perfect' || level === 'excellent') {
      comment = comment.replace('继续保持', `${comparison.text}，继续保持`);
    }
  }

  // 添加时间特征（如果适用）
  if (timeFeature && level === 'perfect') {
    comment = comment.replace('今天', `${timeFeature}，今天`);
  }

  // 质量检查：确保评语长度在100-200字之间
  if (comment.length < 50) {
    // 如果评语太短，添加鼓励性结尾
    comment += '继续保持这个状态，相信' + studentName + '会越来越棒！';
  } else if (comment.length > 250) {
    // 如果评语太长，截断并添加结尾
    comment = comment.substring(0, 200) + '...继续加油！';
  }

  return comment;
}

module.exports = {
  generateComment,
};


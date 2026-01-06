/**
 * 关联分析器
 * 分析学员数据之间的关联关系，生成洞察和解说
 */

// ==================== 配置项 ====================
const DEFAULT_CONFIG = {
  // 专注时长分组阈值（分钟）
  focusThresholds: [150, 180, 200],
  
  // 走神次数分组阈值
  distractionThresholds: [2, 4, 5],
  
  // 最小数据要求
  minDataCount: 3,
  
  // 默认分析天数
  defaultDays: 7,
};

// ==================== 辅助函数 ====================

/**
 * 将作业评级转换为数值（用于计算平均评级）
 */
function ratingToNumber(rating) {
  const map = { A: 3, B: 2, C: 1 };
  return map[rating] || 1;
}

/**
 * 将数值转换为作业评级
 */
function numberToRating(num) {
  if (num >= 2.5) return 'A';
  if (num >= 1.5) return 'B';
  return 'C';
}

/**
 * 计算皮尔逊相关系数
 */
function calculateCorrelation(x, y) {
  if (x.length !== y.length || x.length < 2) return 0;
  
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * 分析学员类型（用于个性化解说）
 */
function analyzeStudentType(historyData) {
  if (!historyData || historyData.length < 3) {
    return 'stable';
  }

  const focusMinutes = historyData.map((h) => h.focus_minutes || 0);
  const recent = focusMinutes.slice(0, 3);
  const previous = focusMinutes.slice(3, 6);

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const previousAvg = previous.length > 0 
    ? previous.reduce((a, b) => a + b, 0) / previous.length 
    : recentAvg;

  const trend = recentAvg - previousAvg;

  if (trend > 20) {
    return 'improving';
  } else if (trend < -20) {
    return 'declining';
  } else if (Math.max(...recent) - Math.min(...recent) > 50) {
    return 'fluctuating';
  } else {
    return 'stable';
  }
}

/**
 * 生成分组标签
 */
function generateRangeLabel(value, thresholds, unit = '') {
  if (value < thresholds[0]) {
    return `<${thresholds[0]}${unit}`;
  }
  for (let i = 0; i < thresholds.length - 1; i++) {
    if (value >= thresholds[i] && value < thresholds[i + 1]) {
      return `${thresholds[i]}-${thresholds[i + 1]}${unit}`;
    }
  }
  return `≥${thresholds[thresholds.length - 1]}${unit}`;
}

// ==================== 分析1：专注时长与作业质量 ====================

/**
 * 分析专注时长与作业质量的关系
 */
function analyzeFocusHomework(data, config, studentName, studentType) {
  const validData = data.filter(
    (d) => d.focus_minutes != null && d.homework_rating
  );

  if (validData.length < config.minDataCount) {
    return {
      description: '专注时长与作业质量的关系',
      hasEnoughData: false,
      message: `数据不足（需要至少${config.minDataCount}条有效数据），无法进行分析。`,
    };
  }

  const thresholds = config.focusThresholds;
  const groups = {};

  // 初始化分组
  groups[`<${thresholds[0]}分钟`] = { total: 0, A: 0, B: 0, C: 0 };
  for (let i = 0; i < thresholds.length - 1; i++) {
    groups[`${thresholds[i]}-${thresholds[i + 1]}分钟`] = { total: 0, A: 0, B: 0, C: 0 };
  }
  groups[`≥${thresholds[thresholds.length - 1]}分钟`] = { total: 0, A: 0, B: 0, C: 0 };

  // 统计数据
  validData.forEach((d) => {
    const range = generateRangeLabel(d.focus_minutes, thresholds, '分钟');
    groups[range].total++;
    groups[range][d.homework_rating]++;
  });

  // 转换为数组格式
  const groupedData = Object.entries(groups)
    .filter(([_, stats]) => stats.total > 0)
    .map(([range, stats]) => ({
      range,
      total: stats.total,
      A: stats.A,
      B: stats.B,
      C: stats.C,
      aRate: stats.total > 0 ? (stats.A / stats.total).toFixed(2) : 0,
      avgRating: stats.total > 0
        ? ((stats.A * 3 + stats.B * 2 + stats.C * 1) / stats.total).toFixed(2)
        : 0,
    }))
    .sort((a, b) => {
      // 按范围排序
      const aMin = parseInt(a.range.match(/\d+/)?.[0] || '0');
      const bMin = parseInt(b.range.match(/\d+/)?.[0] || '0');
      return aMin - bMin;
    });

  // 生成散点图数据
  const scatterData = validData.map((d) => ({
    focus: d.focus_minutes,
    rating: d.homework_rating,
    ratingNum: ratingToNumber(d.homework_rating),
  }));

  // 计算相关性
  const focusValues = validData.map((d) => d.focus_minutes);
  const ratingValues = validData.map((d) => ratingToNumber(d.homework_rating));
  const correlation = calculateCorrelation(focusValues, ratingValues);

  // 生成洞察
  const bestGroup = groupedData.reduce((best, current) => {
    return parseFloat(current.aRate) > parseFloat(best.aRate) ? current : best;
  }, groupedData[0]);

  let insight = '';
  if (bestGroup && parseFloat(bestGroup.aRate) > 0.5) {
    insight = `专注时长${bestGroup.range}时，作业评级A的比例为${(parseFloat(bestGroup.aRate) * 100).toFixed(0)}%`;
  } else {
    insight = '专注时长与作业质量存在一定关联，但数据分布较为均匀';
  }

  // 生成解说
  const explanation = generateFocusHomeworkExplanation(
    groupedData,
    correlation,
    studentName,
    studentType,
    validData.length
  );

  return {
    description: '专注时长与作业质量的关系',
    hasEnoughData: true,
    dataCount: validData.length,
    groupedData,
    scatterData,
    correlation: parseFloat(correlation.toFixed(2)),
    insight,
    explanation,
  };
}

/**
 * 生成专注时长与作业质量的解说
 */
function generateFocusHomeworkExplanation(groupedData, correlation, studentName, studentType, dataCount) {
  if (!groupedData || groupedData.length === 0) {
    return `通过分析最近${dataCount}天的数据，我们发现${studentName}的专注时长与作业质量存在关联。建议继续保持良好的专注习惯。`;
  }

  const bestGroup = groupedData.reduce((best, current) => {
    return parseFloat(current.aRate) > parseFloat(best.aRate) ? current : best;
  }, groupedData[0]);

  const worstGroup = groupedData.reduce((worst, current) => {
    return parseFloat(current.aRate) < parseFloat(worst.aRate) ? current : worst;
  }, groupedData[0]);

  const highFocusGroup = groupedData.find((g) => g.range.includes('≥'));
  const aRate = highFocusGroup ? parseFloat(highFocusGroup.aRate) : 0;

  // 根据学员类型选择语气
  const toneMap = {
    improving: {
      start: `通过分析最近${dataCount}天的数据，我们发现${studentName}的专注时长与作业质量呈现明显的正相关关系。`,
      middle: `特别值得表扬的是，${studentName}最近的表现越来越好，`,
      end: `继续保持这个良好的趋势，相信${studentName}会越来越优秀！`,
    },
    declining: {
      start: `通过分析最近${dataCount}天的数据，我们发现${studentName}的专注时长与作业质量存在关联。`,
      middle: `我们注意到${studentName}最近可能需要更多关注，`,
      end: `建议设定小目标，逐步提升专注力，相信${studentName}可以找回最佳状态！`,
    },
    fluctuating: {
      start: `通过分析最近${dataCount}天的数据，我们发现${studentName}的专注时长与作业质量存在关联。`,
      middle: `${studentName}的表现有些波动，`,
      end: `建议保持稳定的学习节奏，找到最适合自己的专注模式，相信${studentName}可以做得更好！`,
    },
    stable: {
      start: `通过分析最近${dataCount}天的数据，我们发现${studentName}的专注时长与作业质量存在关联。`,
      middle: `${studentName}的表现比较稳定，`,
      end: `继续保持这个状态，相信${studentName}会越来越棒！`,
    },
  };

  const tone = toneMap[studentType] || toneMap.stable;

  let explanation = tone.start;

  if (aRate > 0.7) {
    explanation += `当${studentName}的专注时长达到${highFocusGroup.range}时，作业评级为A的比例达到${(aRate * 100).toFixed(0)}%，表现优秀。`;
  } else if (bestGroup && parseFloat(bestGroup.aRate) > 0.5) {
    explanation += `当${studentName}的专注时长在${bestGroup.range}时，作业评级为A的比例为${(parseFloat(bestGroup.aRate) * 100).toFixed(0)}%，明显高于其他时间段。`;
  }

  if (worstGroup && parseFloat(worstGroup.aRate) < 0.3) {
    explanation += `而当专注时长在${worstGroup.range}时，作业质量多为${worstGroup.C > bestGroup.B ? 'C' : 'B'}级。`;
  }

  explanation += `这说明保持足够的专注时间对完成高质量作业非常重要。`;

  explanation += tone.middle;
  explanation += tone.end;

  // 确保长度在100-200字之间
  if (explanation.length < 100) {
    explanation += `建议${studentName}继续保持良好的专注习惯，如果发现专注时长下降，可以尝试设定小目标，逐步提升专注力。`;
  } else if (explanation.length > 200) {
    explanation = explanation.substring(0, 190) + '...';
  }

  return explanation;
}

// ==================== 分析2：用餐情况与专注度 ====================

/**
 * 分析用餐情况与专注度的关系
 */
function analyzeMealFocus(data, config, studentName, studentType) {
  const validData = data.filter(
    (d) => d.meal_status && d.focus_minutes != null
  );

  if (validData.length < config.minDataCount) {
    return {
      description: '用餐情况与专注度的关系',
      hasEnoughData: false,
      message: `数据不足（需要至少${config.minDataCount}条有效数据），无法进行分析。`,
    };
  }

  // 按用餐状态分组
  const groups = {
    finished: [],
    partial: [],
    skipped: [],
  };

  validData.forEach((d) => {
    const status = d.meal_status || 'finished';
    if (groups[status]) {
      groups[status].push(d.focus_minutes);
    } else {
      groups.finished.push(d.focus_minutes);
    }
  });

  // 计算统计信息
  const groupedData = Object.entries(groups)
    .filter(([_, values]) => values.length > 0)
    .map(([mealStatus, values]) => {
      const sorted = [...values].sort((a, b) => a - b);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      return {
        mealStatus,
        mealStatusText: {
          finished: '用餐完成',
          partial: '用餐不完整',
          skipped: '未用餐',
        }[mealStatus] || mealStatus,
        count: values.length,
        avgFocus: Math.round(avg),
        minFocus: Math.min(...values),
        maxFocus: Math.max(...values),
        medianFocus: sorted[Math.floor(sorted.length / 2)],
        distribution: values,
      };
    });

  // 计算对比
  const finishedGroup = groupedData.find((g) => g.mealStatus === 'finished');
  const otherGroups = groupedData.filter((g) => g.mealStatus !== 'finished');

  let insight = '';
  if (finishedGroup && otherGroups.length > 0) {
    const otherAvg = otherGroups.reduce((sum, g) => sum + g.avgFocus, 0) / otherGroups.length;
    const diff = finishedGroup.avgFocus - otherAvg;
    if (diff > 10) {
      insight = `用餐完成时，平均专注时长比未用餐或用餐不完整时高出约${Math.round(diff)}分钟`;
    } else {
      insight = '用餐情况对专注度有一定影响，但差异不明显';
    }
  } else {
    insight = '用餐情况与专注度存在关联';
  }

  // 生成解说
  const explanation = generateMealFocusExplanation(
    groupedData,
    studentName,
    studentType,
    validData.length
  );

  return {
    description: '用餐情况与专注度的关系',
    hasEnoughData: true,
    dataCount: validData.length,
    groupedData,
    insight,
    explanation,
  };
}

/**
 * 生成用餐情况与专注度的解说
 */
function generateMealFocusExplanation(groupedData, studentName, studentType, dataCount) {
  if (!groupedData || groupedData.length === 0) {
    return `通过分析最近${dataCount}天的数据，我们发现${studentName}的用餐情况对专注度有影响。建议保持规律的用餐习惯。`;
  }

  const finishedGroup = groupedData.find((g) => g.mealStatus === 'finished');
  const otherGroups = groupedData.filter((g) => g.mealStatus !== 'finished');

  const toneMap = {
    improving: {
      start: `通过分析最近${dataCount}天的数据，我们发现${studentName}的用餐情况对专注度有明显影响。`,
      end: `继续保持良好的用餐习惯，相信${studentName}会越来越优秀！`,
    },
    declining: {
      start: `通过分析最近${dataCount}天的数据，我们发现${studentName}的用餐情况对专注度有影响。`,
      end: `建议保持规律的用餐习惯，确保营养充足，这样有助于${studentName}找回最佳学习状态！`,
    },
    fluctuating: {
      start: `通过分析最近${dataCount}天的数据，我们发现${studentName}的用餐情况对专注度有影响。`,
      end: `建议保持稳定的用餐习惯，找到最适合自己的节奏，相信${studentName}可以做得更好！`,
    },
    stable: {
      start: `通过分析最近${dataCount}天的数据，我们发现${studentName}的用餐情况对专注度有明显影响。`,
      end: `继续保持良好的用餐习惯，相信${studentName}会越来越棒！`,
    },
  };

  const tone = toneMap[studentType] || toneMap.stable;
  let explanation = tone.start;

  if (finishedGroup && otherGroups.length > 0) {
    const otherAvg = otherGroups.reduce((sum, g) => sum + g.avgFocus, 0) / otherGroups.length;
    const diff = finishedGroup.avgFocus - otherAvg;

    if (diff > 10) {
      explanation += `当${studentName}用餐完成时，平均专注时长为${finishedGroup.avgFocus}分钟，比未用餐或用餐不完整时高出约${Math.round(diff)}分钟。`;
    } else {
      explanation += `当${studentName}用餐完成时，平均专注时长为${finishedGroup.avgFocus}分钟，与未用餐时差异不大。`;
    }
  } else if (finishedGroup) {
    explanation += `当${studentName}用餐完成时，平均专注时长为${finishedGroup.avgFocus}分钟。`;
  }

  explanation += `这说明良好的用餐习惯有助于保持更好的学习状态。可能的原因是：充足的营养为大脑提供了必要的能量，而用餐不完整可能导致注意力不集中。`;

  explanation += tone.end;

  // 确保长度在100-200字之间
  if (explanation.length < 100) {
    explanation += `建议${studentName}保持规律的用餐习惯，确保营养充足，这样有助于提升学习效率。`;
  } else if (explanation.length > 200) {
    explanation = explanation.substring(0, 190) + '...';
  }

  return explanation;
}

// ==================== 分析3：走神次数与作业质量 ====================

/**
 * 分析走神次数与作业质量的关系
 */
function analyzeDistractionHomework(data, config, studentName, studentType) {
  const validData = data.filter(
    (d) => d.distraction_count != null && d.homework_rating
  );

  if (validData.length < config.minDataCount) {
    return {
      description: '走神次数与作业质量的关系',
      hasEnoughData: false,
      message: `数据不足（需要至少${config.minDataCount}条有效数据），无法进行分析。`,
    };
  }

  const thresholds = config.distractionThresholds;
  const groups = {};

  // 初始化分组
  groups['0次'] = { total: 0, A: 0, B: 0, C: 0 };
  groups['1-2次'] = { total: 0, A: 0, B: 0, C: 0 };
  groups['3-4次'] = { total: 0, A: 0, B: 0, C: 0 };
  groups['≥5次'] = { total: 0, A: 0, B: 0, C: 0 };

  // 统计数据
  validData.forEach((d) => {
    let range = '≥5次';
    if (d.distraction_count === 0) {
      range = '0次';
    } else if (d.distraction_count <= 2) {
      range = '1-2次';
    } else if (d.distraction_count <= 4) {
      range = '3-4次';
    }
    groups[range].total++;
    groups[range][d.homework_rating]++;
  });

  // 转换为数组格式
  const groupedData = Object.entries(groups)
    .filter(([_, stats]) => stats.total > 0)
    .map(([range, stats]) => ({
      range,
      total: stats.total,
      A: stats.A,
      B: stats.B,
      C: stats.C,
      aRate: stats.total > 0 ? (stats.A / stats.total).toFixed(2) : 0,
      avgRating: stats.total > 0
        ? ((stats.A * 3 + stats.B * 2 + stats.C * 1) / stats.total).toFixed(2)
        : 0,
    }));

  // 计算相关性
  const distractionValues = validData.map((d) => d.distraction_count);
  const ratingValues = validData.map((d) => ratingToNumber(d.homework_rating));
  const correlation = calculateCorrelation(distractionValues, ratingValues);

  // 生成洞察
  const bestGroup = groupedData.reduce((best, current) => {
    return parseFloat(current.aRate) > parseFloat(best.aRate) ? current : best;
  }, groupedData[0]);

  let insight = '';
  if (bestGroup && parseFloat(bestGroup.aRate) > 0.5) {
    insight = `走神次数${bestGroup.range}时，作业A级比例达到${(parseFloat(bestGroup.aRate) * 100).toFixed(0)}%`;
  } else {
    insight = '走神次数与作业质量存在一定关联';
  }

  // 生成解说
  const explanation = generateDistractionHomeworkExplanation(
    groupedData,
    correlation,
    studentName,
    studentType,
    validData.length
  );

  return {
    description: '走神次数与作业质量的关系',
    hasEnoughData: true,
    dataCount: validData.length,
    groupedData,
    correlation: parseFloat(correlation.toFixed(2)),
    insight,
    explanation,
  };
}

/**
 * 生成走神次数与作业质量的解说
 */
function generateDistractionHomeworkExplanation(groupedData, correlation, studentName, studentType, dataCount) {
  if (!groupedData || groupedData.length === 0) {
    return `通过分析最近${dataCount}天的数据，我们发现${studentName}的走神次数与作业质量存在关联。建议继续训练抗干扰能力。`;
  }

  const bestGroup = groupedData.reduce((best, current) => {
    return parseFloat(current.aRate) > parseFloat(best.aRate) ? current : best;
  }, groupedData[0]);

  const worstGroup = groupedData.reduce((worst, current) => {
    return parseFloat(current.aRate) < parseFloat(worst.aRate) ? current : worst;
  }, groupedData[0]);

  const toneMap = {
    improving: {
      start: `通过分析最近${dataCount}天的数据，我们发现${studentName}的走神次数与作业质量存在明显的负相关关系。`,
      middle: `特别值得表扬的是，${studentName}最近在控制走神方面做得越来越好，`,
      end: `继续保持这个良好的趋势，相信${studentName}会越来越优秀！`,
    },
    declining: {
      start: `通过分析最近${dataCount}天的数据，我们发现${studentName}的走神次数与作业质量存在关联。`,
      middle: `我们注意到${studentName}最近可能需要更多关注，`,
      end: `建议训练抗干扰能力，如果发现走神次数增加，可以尝试在安静的环境中学习，相信${studentName}可以找回最佳状态！`,
    },
    fluctuating: {
      start: `通过分析最近${dataCount}天的数据，我们发现${studentName}的走神次数与作业质量存在关联。`,
      middle: `${studentName}的表现有些波动，`,
      end: `建议保持稳定的学习节奏，训练抗干扰能力，相信${studentName}可以做得更好！`,
    },
    stable: {
      start: `通过分析最近${dataCount}天的数据，我们发现${studentName}的走神次数与作业质量存在关联。`,
      middle: `${studentName}的表现比较稳定，`,
      end: `继续保持这个状态，相信${studentName}会越来越棒！`,
    },
  };

  const tone = toneMap[studentType] || toneMap.stable;
  let explanation = tone.start;

  if (bestGroup && parseFloat(bestGroup.aRate) > 0.5) {
    explanation += `当${studentName}走神次数在${bestGroup.range}时，作业评级为A的比例达到${(parseFloat(bestGroup.aRate) * 100).toFixed(0)}%，表现优秀。`;
  }

  if (worstGroup && parseFloat(worstGroup.aRate) < 0.3) {
    explanation += `而当走神次数达到${worstGroup.range}时，作业质量多为${worstGroup.C > worstGroup.B ? 'C' : 'B'}级。`;
  }

  explanation += `这说明走神次数直接影响作业完成质量。走神次数少意味着注意力集中，能够更好地理解和完成作业。`;

  explanation += tone.middle;
  explanation += tone.end;

  // 确保长度在100-200字之间
  if (explanation.length < 100) {
    explanation += `建议${studentName}继续训练抗干扰能力，如果发现走神次数增加，可以尝试在安静的环境中学习，或者设定短时间的学习目标，逐步提升专注力。`;
  } else if (explanation.length > 200) {
    explanation = explanation.substring(0, 190) + '...';
  }

  return explanation;
}

// ==================== 主函数 ====================

/**
 * 分析关联关系
 * @param {number} studentId - 学员ID
 * @param {string} startDate - 开始日期
 * @param {string} endDate - 结束日期
 * @param {Object} config - 配置项（可选）
 * @param {string} studentName - 学员姓名
 * @returns {Object} 关联分析结果
 */
async function analyzeCorrelations(studentId, startDate, endDate, config = {}, studentName = '学员') {
  // 合并配置
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // 这里需要从数据库查询数据，但为了保持函数纯净，数据应该由调用者传入
  // 实际使用时，应该在控制器中查询数据后调用此函数
  throw new Error('此函数需要数据作为参数，请使用 analyzeCorrelationsWithData');
}

/**
 * 使用已有数据进行分析（推荐使用）
 * @param {Array} data - 历史数据数组
 * @param {Object} config - 配置项（可选）
 * @param {string} studentName - 学员姓名
 * @returns {Object} 关联分析结果
 */
function analyzeCorrelationsWithData(data, config = {}, studentName = '学员') {
  // 合并配置
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // 分析学员类型
  const studentType = analyzeStudentType(data);

  // 执行三个分析
  const focusHomework = analyzeFocusHomework(data, finalConfig, studentName, studentType);
  const mealFocus = analyzeMealFocus(data, finalConfig, studentName, studentType);
  const distractionHomework = analyzeDistractionHomework(data, finalConfig, studentName, studentType);

  return {
    focus_homework: focusHomework,
    meal_focus: mealFocus,
    distraction_homework: distractionHomework,
    // 预留位置：未来可以添加更复杂的分析规则
    // advancedAnalysis: {
    //   multiFactorAnalysis: null,
    //   trendAnalysis: null,
    //   prediction: null,
    // },
  };
}

module.exports = {
  analyzeCorrelationsWithData,
  DEFAULT_CONFIG,
};


/**
 * 小区人口年龄结构分析服务
 * 通过分析静态建筑数据推断动态人口画像
 */

// 基础人口年龄分布模板（基于中国城市平均水平）
const BASE_DISTRIBUTION = {
  '0-6': 0.08,    // 8% - 学龄前儿童
  '7-18': 0.12,   // 12% - 学生群体
  '19-35': 0.30,  // 30% - 青年群体
  '36-59': 0.35,  // 35% - 中年群体
  '60+': 0.15     // 15% - 老年群体
};

// 房龄修正系数表
const AGE_ADJUSTMENT_FACTORS = {
  '0-6': {
    '<5': 0.9, '5-10': 1.0, '10-15': 1.1, '15-20': 0.9, '>20': 0.7
  },
  '7-18': {
    '<5': 0.8, '5-10': 1.0, '10-15': 1.2, '15-20': 1.1, '>20': 0.6
  },
  '19-35': {
    '<5': 1.5, '5-10': 1.3, '10-15': 1.0, '15-20': 0.9, '>20': 0.7
  },
  '36-59': {
    '<5': 1.2, '5-10': 1.1, '10-15': 1.0, '15-20': 1.0, '>20': 0.9
  },
  '60+': {
    '<5': 0.6, '5-10': 0.8, '10-15': 1.0, '15-20': 1.2, '>20': 1.8
  }
};

/**
 * 获取房龄范围
 * @param {number} buildingAge - 房龄（年）
 * @returns {string} 房龄范围标识
 */
function getAgeRange(buildingAge) {
  if (buildingAge < 5) return '<5';
  if (buildingAge < 10) return '5-10';
  if (buildingAge < 15) return '10-15';
  if (buildingAge < 20) return '15-20';
  return '>20';
}

/**
 * 获取房龄修正系数
 * @param {number} buildingAge - 房龄（年）
 * @param {string} ageGroup - 年龄组
 * @returns {number} 修正系数
 */
function getAgeAdjustmentFactor(buildingAge, ageGroup) {
  if (buildingAge === undefined || buildingAge === null) {
    return 1.0; // 无房龄数据，不修正
  }
  
  const ageRange = getAgeRange(buildingAge);
  return AGE_ADJUSTMENT_FACTORS[ageGroup]?.[ageRange] || 1.0;
}

/**
 * 计算学区影响系数
 * @param {Array} schools - 学校列表
 * @param {string} ageGroup - 年龄组
 * @returns {number} 影响系数
 */
function calculateSchoolImpact(schools, ageGroup) {
  if (!schools || schools.length === 0) {
    return 1.0;
  }
  
  let totalImpact = 0;
  
  schools.forEach((school, index) => {
    // 1. 基础权重（重点学校权重更高）
    let baseWeight = 1.0;
    if (school.is_key_school) {
      baseWeight = 1.5;
    }
    
    // 2. 学校类型权重
    let typeWeight = 1.0;
    if (school.type === 'primary') {
      // 小学对7-18岁和其家长影响大
      if (ageGroup === '7-18' || ageGroup === '36-59') {
        typeWeight = 1.3;
      }
    } else if (school.type === 'middle') {
      // 中学对7-18岁和其家长影响中等
      if (ageGroup === '7-18' || ageGroup === '36-59') {
        typeWeight = 1.2;
      }
    } else if (school.type === 'high') {
      // 高中对7-18岁和其家长影响中等
      if (ageGroup === '7-18' || ageGroup === '36-59') {
        typeWeight = 1.2;
      }
    }
    
    // 3. 距离衰减函数（指数衰减）
    const distanceKm = (school.distance_meters || 0) / 1000;
    // 如果距离为0或很小，给予最大衰减值1.0；否则使用指数衰减
    const distanceDecay = distanceKm < 0.1 ? 1.0 : Math.exp(-distanceKm / 1.5); // 1.5km为衰减半径
    
    // 4. 容量影响（学生容量越大，影响越大，但有上限）
    // 修复：即使没有容量数据，也应该有基础影响（默认0.5），避免影响为0
    const studentCapacity = school.student_capacity || 0;
    const capacityFactor = studentCapacity > 0 
      ? Math.min(studentCapacity / 1000, 1.5) 
      : 0.5; // 无容量数据时，给予基础影响值0.5
    
    // 5. 综合影响
    const schoolImpact = baseWeight * typeWeight * distanceDecay * capacityFactor;
    totalImpact += schoolImpact;
  });
  
  // 归一化：多个学校的影响累加
  // 直接累加每个学校的影响，但使用合理的缩放系数
  // 单个学校的影响通常在0.5-2.0之间，多个学校累加后使用平方根缩放避免过度增长
  // 公式：normalizedImpact = sqrt(totalImpact) * scaleFactor
  // 这样可以让影响随学校数量增长，但增长速度递减（符合边际递减效应）
  const scaleFactor = 0.8; // 缩放系数，控制整体影响强度
  const normalizedImpact = Math.min(
    Math.sqrt(totalImpact) * scaleFactor,
    3.0 // 设置一个合理的上限（约对应4-5个学校）
  );
  
  // 根据年龄组返回影响系数
  let finalFactor;
  if (ageGroup === '7-18') {
    // 学生群体：影响系数 = 1.0 + normalizedImpact * 0.3
    // 单个学校：约1.0-1.4，两个学校：约1.0-1.6，三个学校：约1.0-1.8+
    finalFactor = 1.0 + normalizedImpact * 0.3;
  } else if (ageGroup === '36-59') {
    // 家长群体：影响系数 = 1.0 + normalizedImpact * 0.15
    // 影响约为学生群体的一半
    finalFactor = 1.0 + normalizedImpact * 0.15;
  } else {
    finalFactor = 1.0; // 其他年龄组不受学区影响
  }
  
  return finalFactor;
}

/**
 * 根据房价估算户均人数
 * @param {number} avgPriceSqm - 平均单价（元/㎡）
 * @param {number} totalAreaSqm - 总建筑面积（㎡）
 * @param {string} city - 城市名称（用于消费水平参考）
 * @returns {number} 估算的户均人数
 */
function estimateHouseholdSize(avgPriceSqm, totalAreaSqm, city = '济南') {
  // 1. 根据房价估算平均户型面积
  let avgUnitSize;
  if (!avgPriceSqm || avgPriceSqm < 10000) {
    avgUnitSize = 80; // 低房价区域，小户型为主
  } else if (avgPriceSqm < 15000) {
    avgUnitSize = 100; // 中等房价，中等户型
  } else if (avgPriceSqm < 20000) {
    avgUnitSize = 120; // 高房价，大户型
  } else {
    avgUnitSize = 150; // 豪宅，超大户型
  }
  
  // 2. 根据户型面积估算户均人数（基于济南消费水平）
  let avgPeople;
  if (avgUnitSize < 90) {
    avgPeople = 2.5; // 小户型，2-3人
  } else if (avgUnitSize < 120) {
    avgPeople = 3.0; // 中等户型，3人
  } else if (avgUnitSize < 150) {
    avgPeople = 3.5; // 大户型，3-4人
  } else {
    avgPeople = 4.0; // 超大户型，4人以上
  }
  
  // 3. 城市消费水平调整（可选，未来可扩展）
  // const cityMultiplier = getCityMultiplier(city);
  // avgPeople = avgPeople * cityMultiplier;
  
  return avgPeople;
}

/**
 * 计算置信度分数
 * @param {Object} data - 输入数据
 * @param {Object} factors - 数据完整性因子
 * @returns {Object} 置信度信息
 */
function calculateConfidence(data, factors) {
  let score = 0;
  const weights = {
    has_households: 0.4,    // 住户数最重要
    has_building_age: 0.25, // 房龄次重要
    has_price: 0.2,         // 价格
    has_schools: 0.15       // 学校信息
  };
  
  // 计算基础分数
  if (factors.has_households) score += weights.has_households;
  if (factors.has_building_age) score += weights.has_building_age;
  if (factors.has_price) score += weights.has_price;
  if (factors.has_schools) score += weights.has_schools;
  
  // 数据质量加分
  if (factors.has_households && factors.has_building_age && factors.has_price) {
    score += 0.1; // 核心数据齐全，额外加分
  }
  
  // 学校数据质量加分
  if (factors.has_schools && data.schools && data.schools.length > 0) {
    const hasKeySchool = data.schools.some(s => s.is_key_school);
    if (hasKeySchool) {
      score += 0.05;
    }
  }
  
  // 归一化到0-1
  score = Math.min(score, 1.0);
  
  // 确定置信度等级
  let level;
  if (score >= 0.8) {
    level = 'High';
  } else if (score >= 0.5) {
    level = 'Medium';
  } else {
    level = 'Low';
  }
  
  // 生成警告信息
  const warnings = [];
  if (!factors.has_households) {
    warnings.push('缺少住户数数据，无法准确计算总人口');
  }
  if (!factors.has_building_age) {
    warnings.push('缺少房龄数据，年龄分布可能不够准确');
  }
  if (!factors.has_price) {
    warnings.push('缺少价格数据，户均人数估算可能不够准确');
  }
  
  return {
    score: parseFloat(score.toFixed(2)),
    level,
    factors: {
      ...factors,
      data_completeness: score
    },
    warnings
  };
}

/**
 * 计算人口年龄结构（主算法）
 * @param {Object} data - 输入数据
 * @returns {Object} 计算结果
 */
function calculateDemographics(data) {
  const {
    basic_info = {},
    schools = [],
    manual_overrides = {}
  } = data;
  
  // Step 1: 基础数据验证和默认值设置
  const households = basic_info.households || 0;
  if (households === 0) {
    throw new Error('住户数不能为0');
  }
  
  const buildingAge = basic_info.building_age;
  const avgPriceSqm = basic_info.avg_price_sqm;
  const totalAreaSqm = basic_info.total_area_sqm;
  
  // Step 2: 估算户均人数
  let avgPeoplePerHousehold = manual_overrides.avg_people_per_household;
  if (!avgPeoplePerHousehold) {
    avgPeoplePerHousehold = estimateHouseholdSize(avgPriceSqm, totalAreaSqm, '济南');
  }
  
  // Step 3: 计算总人口（考虑入住率）
  const occupancyRate = manual_overrides.occupancy_rate !== undefined 
    ? manual_overrides.occupancy_rate 
    : 0.85; // 默认85%入住率
  const totalPopulation = Math.round(households * avgPeoplePerHousehold * occupancyRate);
  
  // Step 4: 应用基础分布模型
  const baseDistribution = {};
  Object.keys(BASE_DISTRIBUTION).forEach(ageGroup => {
    baseDistribution[ageGroup] = {
      base_count: Math.round(totalPopulation * BASE_DISTRIBUTION[ageGroup]),
      percentage: BASE_DISTRIBUTION[ageGroup] * 100
    };
  });
  
  // Step 5: 应用房龄修正
  const ageAdjustedDistribution = {};
  Object.keys(baseDistribution).forEach(ageGroup => {
    const ageFactor = getAgeAdjustmentFactor(buildingAge, ageGroup);
    const baseCount = baseDistribution[ageGroup].base_count;
    const adjustedCount = Math.round(baseCount * ageFactor);
    const ageImpact = adjustedCount - baseCount;
    
    ageAdjustedDistribution[ageGroup] = {
      base_count: baseCount,
      adjusted_count: adjustedCount,
      age_impact: ageImpact,
      age_factor: ageFactor
    };
  });
  
  // Step 6: 应用学区加权
  const schoolAdjustedDistribution = {};
  Object.keys(ageAdjustedDistribution).forEach(ageGroup => {
    const schoolFactor = calculateSchoolImpact(schools, ageGroup);
    const baseCount = ageAdjustedDistribution[ageGroup].adjusted_count;
    const schoolImpact = Math.round(baseCount * (schoolFactor - 1.0));
    
    schoolAdjustedDistribution[ageGroup] = {
      base_count: ageAdjustedDistribution[ageGroup].base_count,
      count: Math.round(baseCount * schoolFactor),
      age_impact: ageAdjustedDistribution[ageGroup].age_impact,
      school_impact: schoolImpact,
      school_factor: schoolFactor
    };
  });
  
  // Step 7: 应用手动调整
  const finalDistribution = {};
  const ageAdjustment = manual_overrides.age_distribution_adjustment || {};
  
  Object.keys(schoolAdjustedDistribution).forEach(ageGroup => {
    const manualFactor = ageAdjustment[ageGroup] !== undefined ? ageAdjustment[ageGroup] : 1.0;
    const adjustedCount = schoolAdjustedDistribution[ageGroup].count;
    
    finalDistribution[ageGroup] = {
      base_count: schoolAdjustedDistribution[ageGroup].base_count,
      count: Math.round(adjustedCount * manualFactor),
      age_impact: schoolAdjustedDistribution[ageGroup].age_impact,
      school_impact: schoolAdjustedDistribution[ageGroup].school_impact,
      manual_factor: manualFactor
    };
  });
  
  // Step 8: 重新归一化百分比
  const totalCount = Object.values(finalDistribution).reduce((sum, item) => sum + item.count, 0);
  Object.keys(finalDistribution).forEach(ageGroup => {
    finalDistribution[ageGroup].percentage = parseFloat(
      (finalDistribution[ageGroup].count / totalCount * 100).toFixed(1)
    );
  });
  
  // Step 9: 计算置信度
  const confidence = calculateConfidence(data, {
    has_households: !!households,
    has_building_age: buildingAge !== undefined && buildingAge !== null,
    has_price: avgPriceSqm !== undefined && avgPriceSqm !== null,
    has_schools: schools.length > 0
  });
  
  return {
    demographics: {
      total_population: totalCount,
      age_distribution: finalDistribution
    },
    confidence,
    calculation_metadata: {
      base_distribution: BASE_DISTRIBUTION,
      household_size_estimate: avgPeoplePerHousehold,
      occupancy_rate_used: occupancyRate,
      total_households: households
    }
  };
}

/**
 * 批量计算多个小区的人口结构
 * @param {Array} communities - 小区数据数组
 * @returns {Array} 计算结果数组
 */
function calculateBatch(communities) {
  if (!Array.isArray(communities)) {
    throw new Error('communities must be an array');
  }
  
  const results = [];
  
  communities.forEach((community, index) => {
    try {
      const result = calculateDemographics(community);
      results.push({
        community_id: community.community_id || `community_${index}`,
        ...result,
        success: true
      });
    } catch (error) {
      results.push({
        community_id: community.community_id || `community_${index}`,
        success: false,
        error: error.message
      });
    }
  });
  
  return results;
}

module.exports = {
  calculateDemographics,
  calculateBatch,
  // 导出辅助函数供测试使用
  getAgeAdjustmentFactor,
  calculateSchoolImpact,
  estimateHouseholdSize,
  calculateConfidence,
  BASE_DISTRIBUTION,
  AGE_ADJUSTMENT_FACTORS
};


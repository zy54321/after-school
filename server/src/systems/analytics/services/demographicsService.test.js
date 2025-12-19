/**
 * 人口分析算法服务测试文件
 * 用于验证算法正确性
 */

const {
  calculateDemographics,
  calculateBatch,
  getAgeAdjustmentFactor,
  calculateSchoolImpact,
  estimateHouseholdSize,
  calculateConfidence
} = require('./demographicsService');

// 测试用例1：完整数据
console.log('=== 测试用例1：完整数据 ===');
const testCase1 = {
  community_id: 'test_001',
  basic_info: {
    households: 500,
    building_age: 8,
    avg_price_sqm: 15000,
    total_area_sqm: 50000
  },
  schools: [{
    name: '测试小学',
    type: 'primary',
    student_capacity: 1200,
    distance_meters: 500,
    is_key_school: true
  }],
  manual_overrides: {
    occupancy_rate: 0.85
  }
};

try {
  const result1 = calculateDemographics(testCase1);
  console.log('✅ 计算成功');
  console.log('总人口:', result1.demographics.total_population);
  console.log('置信度:', result1.confidence.level, `(${result1.confidence.score})`);
  console.log('年龄分布:');
  Object.keys(result1.demographics.age_distribution).forEach(ageGroup => {
    const data = result1.demographics.age_distribution[ageGroup];
    console.log(`  ${ageGroup}: ${data.count}人 (${data.percentage}%)`);
  });
} catch (error) {
  console.error('❌ 测试失败:', error.message);
}

console.log('\n=== 测试用例2：缺失房龄数据 ===');
const testCase2 = {
  community_id: 'test_002',
  basic_info: {
    households: 500,
    // building_age: undefined
    avg_price_sqm: 15000
  }
};

try {
  const result2 = calculateDemographics(testCase2);
  console.log('✅ 计算成功');
  console.log('置信度:', result2.confidence.level, `(${result2.confidence.score})`);
  console.log('警告:', result2.confidence.warnings);
} catch (error) {
  console.error('❌ 测试失败:', error.message);
}

console.log('\n=== 测试用例3：缺失住户数（应该报错） ===');
const testCase3 = {
  community_id: 'test_003',
  basic_info: {
    households: 0
  }
};

try {
  const result3 = calculateDemographics(testCase3);
  console.log('❌ 应该报错但没有');
} catch (error) {
  console.log('✅ 正确捕获错误:', error.message);
}

console.log('\n=== 测试用例4：批量计算 ===');
const testCase4 = [
  {
    community_id: 'batch_001',
    basic_info: {
      households: 300,
      building_age: 5,
      avg_price_sqm: 12000
    }
  },
  {
    community_id: 'batch_002',
    basic_info: {
      households: 800,
      building_age: 15,
      avg_price_sqm: 18000
    },
    schools: [{
      type: 'primary',
      student_capacity: 1000,
      distance_meters: 300,
      is_key_school: false
    }]
  }
];

try {
  const results = calculateBatch(testCase4);
  console.log('✅ 批量计算成功');
  results.forEach((result, index) => {
    if (result.success) {
      console.log(`  小区${index + 1}: ${result.demographics.total_population}人`);
    } else {
      console.log(`  小区${index + 1}: 计算失败 - ${result.error}`);
    }
  });
} catch (error) {
  console.error('❌ 批量计算失败:', error.message);
}

console.log('\n=== 测试用例5：辅助函数测试 ===');
console.log('房龄修正系数 (8年, 19-35岁):', getAgeAdjustmentFactor(8, '19-35'));
console.log('户均人数估算 (15000元/㎡):', estimateHouseholdSize(15000));
console.log('学区影响 (7-18岁):', calculateSchoolImpact(testCase1.schools, '7-18'));

console.log('\n=== 所有测试完成 ===');


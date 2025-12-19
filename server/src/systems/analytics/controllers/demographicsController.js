/**
 * 人口构成分析控制器
 * 处理人口年龄结构分析的API请求
 */

const demographicsService = require('../services/demographicsService');

/**
 * 单小区人口分析计算
 * POST /api/analytics/demographics/calculate
 */
const calculateSingle = async (req, res) => {
  try {
    const {
      community_id,
      basic_info,
      schools = [],
      manual_overrides = {}
    } = req.body;

    // 数据验证
    if (!community_id) {
      return res.status(400).json({
        code: 400,
        msg: '缺少小区ID'
      });
    }

    if (!basic_info || !basic_info.households) {
      return res.status(400).json({
        code: 400,
        msg: '缺少基础信息或住户数'
      });
    }

    if (basic_info.households <= 0) {
      return res.status(400).json({
        code: 400,
        msg: '住户数必须大于0'
      });
    }

    // 验证手动修正参数
    if (manual_overrides.occupancy_rate !== undefined) {
      const rate = manual_overrides.occupancy_rate;
      if (rate < 0 || rate > 1) {
        return res.status(400).json({
          code: 400,
          msg: '入住率必须在0-1之间'
        });
      }
    }

    if (manual_overrides.avg_people_per_household !== undefined) {
      const size = manual_overrides.avg_people_per_household;
      if (size < 1 || size > 10) {
        return res.status(400).json({
          code: 400,
          msg: '户均人数必须在1-10之间'
        });
      }
    }

    // 验证年龄分布调整系数
    if (manual_overrides.age_distribution_adjustment) {
      const adjustment = manual_overrides.age_distribution_adjustment;
      const ageGroups = ['0-6', '7-18', '19-35', '36-59', '60+'];
      for (const group of ageGroups) {
        if (adjustment[group] !== undefined) {
          const factor = adjustment[group];
          if (factor < 0 || factor > 3) {
            return res.status(400).json({
              code: 400,
              msg: `年龄组 ${group} 的调整系数必须在0-3之间`
            });
          }
        }
      }
    }

    // 验证学校数据格式
    if (!Array.isArray(schools)) {
      return res.status(400).json({
        code: 400,
        msg: '学校数据必须是数组'
      });
    }

    // 验证每个学校的数据
    for (const school of schools) {
      if (school.distance_meters !== undefined && school.distance_meters < 0) {
        return res.status(400).json({
          code: 400,
          msg: '学校距离不能为负数'
        });
      }
      if (school.student_capacity !== undefined && school.student_capacity < 0) {
        return res.status(400).json({
          code: 400,
          msg: '学生容量不能为负数'
        });
      }
    }

    // 调用服务进行计算
    const inputData = {
      community_id,
      basic_info,
      schools,
      manual_overrides
    };
    
    const result = demographicsService.calculateDemographics(inputData);

    // 返回结果
    res.json({
      code: 200,
      msg: '计算成功',
      data: {
        community_id: result.community_id || community_id,
        demographics: result.demographics,
        confidence: result.confidence,
        calculation_metadata: result.calculation_metadata
      }
    });
  } catch (error) {
    console.error('人口分析计算错误:', error);
    res.status(500).json({
      code: 500,
      msg: error.message || '计算失败，服务器内部错误'
    });
  }
};

/**
 * 批量计算多个小区的人口分析
 * POST /api/analytics/demographics/batch
 */
const calculateBatch = async (req, res) => {
  try {
    const { communities } = req.body;

    // 数据验证
    if (!communities) {
      return res.status(400).json({
        code: 400,
        msg: '缺少小区数据'
      });
    }

    if (!Array.isArray(communities)) {
      return res.status(400).json({
        code: 400,
        msg: '小区数据必须是数组'
      });
    }

    if (communities.length === 0) {
      return res.status(400).json({
        code: 400,
        msg: '小区数据不能为空'
      });
    }

    if (communities.length > 100) {
      return res.status(400).json({
        code: 400,
        msg: '批量计算最多支持100个小区'
      });
    }

    // 验证每个小区的数据
    for (let i = 0; i < communities.length; i++) {
      const community = communities[i];
      
      if (!community.community_id) {
        return res.status(400).json({
          code: 400,
          msg: `第${i + 1}个小区缺少ID`
        });
      }

      if (!community.basic_info || !community.basic_info.households) {
        return res.status(400).json({
          code: 400,
          msg: `第${i + 1}个小区缺少基础信息或住户数`
        });
      }
    }

    // 调用批量计算服务
    const results = demographicsService.calculateBatch(communities);

    // 统计成功和失败数量
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    // 返回结果
    res.json({
      code: 200,
      msg: `批量计算完成，成功${successCount}个，失败${failCount}个`,
      data: {
        total: communities.length,
        success: successCount,
        failed: failCount,
        results: results
      }
    });
  } catch (error) {
    console.error('批量计算错误:', error);
    res.status(500).json({
      code: 500,
      msg: error.message || '批量计算失败，服务器内部错误'
    });
  }
};

/**
 * 获取算法元数据（系数表、基础分布等）
 * GET /api/analytics/demographics/metadata
 */
const getMetadata = async (req, res) => {
  try {
    const {
      BASE_DISTRIBUTION,
      AGE_ADJUSTMENT_FACTORS
    } = require('../services/demographicsService');

    res.json({
      code: 200,
      msg: '获取成功',
      data: {
        base_distribution: BASE_DISTRIBUTION,
        age_adjustment_factors: AGE_ADJUSTMENT_FACTORS,
        description: {
          base_distribution: '基础人口年龄分布模板（基于中国城市平均水平）',
          age_adjustment_factors: '房龄修正系数表，用于根据房龄调整年龄分布'
        }
      }
    });
  } catch (error) {
    console.error('获取元数据错误:', error);
    res.status(500).json({
      code: 500,
      msg: '获取元数据失败'
    });
  }
};

module.exports = {
  calculateSingle,
  calculateBatch,
  getMetadata
};


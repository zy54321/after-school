# 商品类型重构设计文档

## 1. 概述

将商品类型从4类调整为3类，删除`service`类型，并新增履约相关字段。

## 2. 商品类型调整

### 2.1 原类型（已废弃）
- `reward` - 可兑换奖品（改为 `item`）
- `auction` - 竞拍品（保留，但不在SKU类型中，由拍卖系统管理）
- `ticket` - 抽奖券（保留）
- `service` - 服务（删除，改为 `permission`）

### 2.2 新类型
- `item` - 物品（原 `reward`）
  - 实物商品、虚拟物品等
  - 兑换后直接进入背包
  
- `permission` - 权限（原 `service`）
  - 时间类权限：如"30分钟游戏时间"、"1小时看电视"
  - 次数类权限：如"免一次作业"、"免一次家务"
  - 需要履约确认和验证
  
- `ticket` - 抽奖券（保留）
  - 用于抽奖系统的券类商品

## 3. 新增字段

### 3.1 fulfillment_mode（履约方式）
- `instant` - 即时生效
  - 兑换后立即生效，无需确认
  - 适用于自动生效的权限（如"免一次作业"）
  
- `manual_confirm` - 需家长确认
  - 兑换后需要家长确认才能生效
  - 适用于需要家长监督的权限（如"陪同购物"、"帮忙完成"）
  
- `schedule` - 需预约
  - 兑换后需要预约时间才能生效
  - 适用于有时间安排的权限（如"周末活动"、"预约游戏时间"）

### 3.2 verification（验证方式）
- `auto` - 自动验证
  - 系统自动验证履约状态
  - 适用于时间类权限（到期自动失效）
  
- `parent_confirm` - 家长确认
  - 需要家长确认履约完成
  - 适用于需要家长监督的权限
  
- `both_confirm` - 双方确认
  - 需要家长和孩子双方确认履约完成
  - 适用于需要双方确认的权限

### 3.3 权限相关字段
- `duration_minutes` - 持续时间（分钟）
  - 用于时间类权限，如"30分钟游戏时间"
  
- `uses` - 使用次数
  - 用于次数类权限，如"免1次作业"
  
- `fulfillment_status` - 履约状态（在订单或库存表中）
  - `pending` - 待确认/待预约
  - `confirmed` - 已确认
  - `scheduled` - 已预约
  - `fulfilled` - 已履约
  - `expired` - 已过期
  - `cancelled` - 已取消

## 4. 数据迁移规则

### 4.1 类型迁移
- 所有 `service` 类型的 SKU 改为 `permission`
- 所有 `reward` 类型的 SKU 改为 `item`

### 4.2 fulfillment_mode 推断规则
根据商品名称和描述自动推断：
- 包含"陪同"、"购买"、"帮忙"、"一次" → `manual_confirm`
- 包含"分钟"、"小时"、"免一次" → `instant`
- 包含"预约"、"周末"、"活动" → `schedule`
- 默认 → `instant`

### 4.3 verification 推断规则
- `instant` 模式 → `auto`
- `manual_confirm` 模式 → `parent_confirm`
- `schedule` 模式 → `both_confirm`

## 5. API 变更

### 5.1 创建/更新商品校验
- 禁止创建 `service` 类型
- `permission` 类型必须包含 `duration_minutes` 或 `uses` 至少一个
- `manual_confirm` 和 `schedule` 模式必须记录履约状态

### 5.2 返回字段
- 所有商品列表接口返回新增字段
- 权限商品必须包含 `fulfillment_mode`、`verification`、`duration_minutes`、`uses`

## 6. 前端变更

### 6.1 管理界面
- 类型下拉去掉 `service`
- 权限商品新增编辑项：
  - 履约方式（fulfillment_mode）
  - 验证方式（verification）
  - 持续时间（duration_minutes）
  - 使用次数（uses）
- 列表展示中清晰显示"自动生效/需确认/需预约"

### 6.2 商城展示
- 权限商品卡片显示：
  - 可验证交付信息（如"+30分钟"、"免1次"、"有效期7天"）
  - 履约方式标识（"需家长确认"、"需预约"）
- 移除服务分类入口与标签

## 7. 测试用例

1. 原 `service` 商品迁移后在商城按权限展示
2. 兑换后能看到履约状态
3. 后台可按 `fulfillment_mode` 流程完成确认/预约
4. 无任何地方可再创建 `service` 类型

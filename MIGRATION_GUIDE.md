# 前端重构迁移指南

## 📋 当前状态

- ✅ 新目录结构已创建
- ✅ 路由配置已更新（指向新路径）
- ⏳ 文件需要手动复制和更新导入路径

## 🚀 需要执行的操作

### 步骤 1：复制文件到新位置

#### 1.1 复制门户文件
```powershell
# 在项目根目录执行
Copy-Item "client\src\views\portal\Home.vue" -Destination "client\src\portal\views\Home.vue" -Force
Copy-Item "client\src\layout\PortalLayout.vue" -Destination "client\src\portal\layout\PortalLayout.vue" -Force
```

#### 1.2 复制教务系统文件
```powershell
# 复制所有教务系统视图文件
Get-ChildItem "client\src\views\system\*.vue" | ForEach-Object { Copy-Item $_.FullName -Destination "client\src\systems\education\views\" -Force }

# 复制布局文件
Copy-Item "client\src\layout\AdminLayout.vue" -Destination "client\src\systems\education\layout\EducationLayout.vue" -Force
```

#### 1.3 复制商业分析系统文件
```powershell
# 复制视图文件
Get-ChildItem "client\src\views\strategy\*.vue" | ForEach-Object { Copy-Item $_.FullName -Destination "client\src\systems\analytics\views\" -Force }

# 复制布局文件
Copy-Item "client\src\layout\StrategyLayout.vue" -Destination "client\src\systems\analytics\layout\AnalyticsLayout.vue" -Force
```

#### 1.4 复制公共组件
```powershell
Copy-Item "client\src\components\MapPicker.vue" -Destination "client\src\shared\components\MapPicker.vue" -Force
```

### 步骤 2：更新导入路径

#### 2.1 更新 MapPicker 的导入路径

需要更新以下文件中的 MapPicker 导入：
- `client/src/systems/education/views/StudentList.vue`

**查找：**
```javascript
import MapPicker from '../../components/MapPicker.vue';
```

**替换为：**
```javascript
import MapPicker from '../../../shared/components/MapPicker.vue';
```

#### 2.2 更新布局文件的导入路径

检查以下文件中的相对路径导入，确保路径正确：
- `client/src/systems/education/layout/EducationLayout.vue`
- `client/src/systems/analytics/layout/AnalyticsLayout.vue`
- `client/src/portal/layout/PortalLayout.vue`

### 步骤 3：测试

1. 启动开发服务器：`cd client && npm run dev`
2. 测试各个路由是否正常
3. 检查控制台是否有导入错误

### 步骤 4：清理旧文件（可选）

确认新结构工作正常后，可以删除旧文件：
```powershell
# 删除旧的 views 目录（如果不再需要）
Remove-Item "client\src\views" -Recurse -Force

# 删除旧的 layout 目录（如果不再需要）
Remove-Item "client\src\layout" -Recurse -Force

# 删除旧的 components 目录（如果不再需要）
Remove-Item "client\src\components" -Recurse -Force
```

## 📝 注意事项

1. **保留旧文件**：在确认新结构完全正常工作之前，建议保留旧文件
2. **逐步迁移**：可以逐个系统测试，确保每个系统都正常工作
3. **Git 提交**：每完成一个步骤，建议提交一次，方便回滚

## 🔍 验证清单

- [ ] 门户首页可以正常访问
- [ ] 教务系统所有页面可以正常访问
- [ ] 商业分析地图可以正常访问
- [ ] MapPicker 组件可以正常使用
- [ ] 路由跳转正常
- [ ] 没有控制台错误

## 🆘 如果遇到问题

1. 检查文件路径是否正确
2. 检查导入路径是否正确
3. 查看浏览器控制台的错误信息
4. 检查路由配置是否正确


# 高德地图 API 配置说明

## 问题说明

如果遇到 `INVALID_USER_KEY` 错误，说明高德地图 API 密钥未配置或配置不正确。

## 配置步骤

### 1. 申请高德地图 API Key

1. 访问 [高德开放平台](https://console.amap.com/dev/key/app)
2. 登录/注册账号
3. 创建新应用，选择"Web服务"类型
4. 获取 API Key（Web服务密钥）

### 2. 配置环境变量

在 `server` 目录下创建或编辑 `.env` 文件，添加以下配置：

```env
AMAP_WEB_KEY=你的高德地图API密钥
```

例如：
```env
AMAP_WEB_KEY=1f0ba3179fd1681394cb0f4ff7f76d0b
```

### 3. 启用服务 ⚠️ 重要！

**这是最容易被忽略的步骤！** 仅仅配置了密钥还不够，必须启用相应的服务：

1. 登录 [高德开放平台控制台](https://console.amap.com/dev/key/app)
2. 找到你创建的应用，点击"服务管理"
3. **必须启用以下服务**：
   - ✅ **输入提示** (InputTips API / `v3/assistant/inputtips`) - 用于地名搜索功能
   - ✅ **Web服务API** - 基础服务类型

如果服务未启用，即使密钥正确，也会返回 `INVALID_USER_KEY` 错误！

### 4. 重启服务器

配置完成后，重启 Node.js 服务器使环境变量生效：

```bash
# 如果使用 npm run dev
# 停止当前进程，然后重新运行
npm run dev

# 如果使用 PM2
pm2 restart all
```

## 验证配置

配置完成后，尝试在地图页面进行地名搜索，如果仍然报错，请检查：

1. ✅ `.env` 文件是否在 `server` 目录下
2. ✅ 环境变量名称是否为 `AMAP_WEB_KEY`（注意大小写）
3. ✅ API Key 是否正确（没有多余空格、没有引号）
4. ✅ **API Key 是否已启用"输入提示"服务**（这是最常见的错误原因！）
5. ✅ API Key 的服务类型是否为"Web服务"
6. ✅ 服务器是否已重启

### 调试技巧

查看服务器日志，应该能看到：
- `🔑 当前使用的密钥: xxxx****xxxx` - 确认密钥已读取
- `🔍 高德API请求URL:` - 确认请求URL格式正确
- `📥 高德API响应:` - 查看具体错误信息

如果看到 `INVALID_USER_KEY` 但密钥已配置，99% 的原因是**服务未启用**！

## 常见错误

- **INVALID_USER_KEY**: API Key 无效或未配置
- **DAILY_QUERY_OVER_LIMIT**: 今日调用量超限
- **INVALID_PARAMS**: 请求参数错误

## 注意事项

- ⚠️ 不要将 `.env` 文件提交到 Git 仓库
- ⚠️ 生产环境建议使用环境变量管理工具（如 PM2 的 env 配置）
- ⚠️ API Key 有调用量限制，注意控制使用频率


# 🚀 全栈部署终极实战手册：域名、Cloudflare 与 跨域联调

> **架构模式**：前后端分离 (Headless Architecture)
>
>   * **前端**：托管于 **Cloudflare Pages** (全球 CDN 加速)
>   * **后端**：运行于 **腾讯云 VPS** (Node.js + Nginx 反向代理)
>   * **域名**：托管于 **Cloudflare** (自动 HTTPS)

-----

## 1\. 域名购买与 DNS 解析

### 1.1 购买域名

  * **平台**：Cloudflare (推荐，无中间商差价，无需实名认证)。
  * **操作**：`Domain Registration` -\> `Register Domain` -\> 搜索并购买 (如 `afterlessons.com`)。

### 1.2 配置 DNS (连接服务器)

在 Cloudflare 的 **DNS -\> Records** 中添加两条 `A` 记录：

| 类型 (Type) | 名称 (Name) | 内容 (Content) | 代理状态 (Proxy) | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| **A** | `api` | `你的腾讯云IP` | ☁️ Proxied (开启) | 后端接口用 (https://www.google.com/search?q=api.xxx.com) |
| **A** | `@` (或 www) | `你的腾讯云IP` | ☁️ Proxied (开启) | 根域名备用 |

-----

## 2\. 后端 HTTPS 配置 (Nginx)

**目标**：让后端支持 `https://api.afterlessons.com`，否则 Cloudflare Pages (强制 HTTPS) 无法调用后端 (Mixed Content 错误)。

### 2.1 修改 Nginx 配置

文件路径：`/etc/nginx/sites-available/default`

```nginx
server {
    listen 80;
    # 1. 绑定二级域名
    server_name api.afterlessons.com;

    # 2. 反向代理到 Node.js (3000端口)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 2.2 颁发 SSL 证书

使用 Certbot 一键申请 Let's Encrypt 证书：

```bash
sudo certbot --nginx
# 遇到 Redirect 询问时，选择 [2] Redirect (强制 HTTPS)
```

-----

## 3\. 前端部署 (Cloudflare Pages)

**目标**：将 Vue 代码部署到全球节点，免去自己在服务器 `npm build` 的麻烦。

### 3.1 创建项目

  * 进入 Cloudflare -\> **Workers & Pages** -\> **Create Application** -\> **Pages** -\> **Connect to Git**。
  * 选择 GitHub 仓库 (`after-school`)。

### 3.2 关键构建配置 (⭐ 易错点)

  * **Framework preset**: 选择 `Vue`。
  * **Build command**: `npm run build`。
  * **Build output**: `dist`。
  * **Root directory (根目录)**: 必须填 **`client`** (因为是 Monorepo 结构)。

### 3.3 设置环境变量

在 Cloudflare 后台 -\> `Settings` -\> `Environment variables`：

  * **Key**: `VITE_API_BASE_URL`
  * **Value**: `https://api.afterlessons.com/api`

-----

## 4\. 前后端打通与异常排查 (Troubleshooting)

这是最耗时也是技术含量最高的环节，我们解决了四个核心问题。

### 🛑 问题一：405 Method Not Allowed

  * **现象**：登录请求发往 `https://www.afterlessons.com/api/login`，报 405。
  * **原因**：Axios 默认发相对路径请求，导致请求发给了“前端服务器”(Cloudflare)，而不是后端。
  * **解决**：在 `client/src/main.js` 中全局配置 Axios 的 `baseURL`。
    ```javascript
    const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
    if (apiUrl) {
      // 这里的逻辑是为了防止拼接出 /api/api/login
      axios.defaults.baseURL = apiUrl.replace(/\/api$/, '');
    }
    ```

### 🛑 问题二：CORS Error (跨域拦截)

  * **现象**：请求地址对了，但浏览器报错 `CORS policy: No 'Access-Control-Allow-Origin' header`。
  * **原因**：后端 Node.js 代码里只允许了 `localhost`，不认识新的 `afterlessons.com` 域名。
  * **解决**：修改后端 `server/app.js`，更新白名单：
    ```javascript
    app.use(cors({
      origin: [
        'http://localhost:5173',
        'https://www.afterlessons.com', // 新增你的正式域名
        'https://afterlessons.com'
      ],
      credentials: true
    }));
    ```

### 🛑 问题三：401 Unauthorized (登录失效)

  * **现象**：登录接口成功 (200 OK)，但跳转到列表页后又报 401 (未登录)。
  * **原因**：跨域请求默认**不携带 Cookie**。后端发了 Session ID，但前端下次请求没带回去。
  * **解决**：在 `client/src/main.js` 开启凭证携带：
    ```javascript
    // 允许跨域携带 Cookie (Session 必备)
    axios.defaults.withCredentials = true;
    ```

### 🛑 问题四：Nginx 欢迎页 (Welcome to nginx)

  * **现象**：访问 API 域名显示 Nginx 默认欢迎页，而不是 API 数据。
  * **原因**：Certbot 自动配置 HTTPS 时，有时会错误地添加 `root /var/www/html` 静态目录配置，覆盖了 `proxy_pass`。
  * **解决**：检查 Nginx 配置文件，确保 `listen 443 ssl` 的区块里，`location /` 依然保留了 `proxy_pass http://127.0.0.1:3000;`。

-----

## 🎉 最终成果

现在拥有了：

1.  **极速前端**：通过 Cloudflare 全球 CDN 分发。
2.  **安全后端**：全链路 HTTPS 加密。
3.  **专业域名**：`www.afterlessons.com`。
4.  **自动化工作流**：改完前端代码推送到 GitHub，Cloudflare 自动构建发布。

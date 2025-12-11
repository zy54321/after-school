# 📖 附录：后续运维与更新指南 (Maintenance Guide)

项目上线后，难免需要修改代码、修复 BUG 或增加新功能。以下是标准的操作流程：

## 1\. 如何更新前端？(全自动 ⚡️)

得益于 **Cloudflare Pages** 与 **GitHub** 的深度集成，前端更新是完全自动化的。

  * **操作步骤**：
    1.  在本地电脑修改前端代码 (`client/` 目录)。
    2.  提交代码并推送到 GitHub：
        ```bash
        git add .
        git commit -m "feat: 增加了一个新功能"
        git push
        ```
  * **结果**：
      * Cloudflare 会监听你的 GitHub 仓库。
      * 一旦检测到 `push`，它会自动拉取最新代码 -\> 安装依赖 -\> 打包构建 (`npm run build`) -\> 替换旧文件。
      * 全程约 1-2 分钟，构建完成后，访问域名即可看到最新效果。
      * *（如果失败，去 Cloudflare 后台 -\> Deployments 查看报错日志）*

-----

## 2\. 如何更新后端？(半自动 🛠️)

后端运行在你的 **腾讯云服务器** 上，Cloudflare 无法自动触达，所以需要你手动登录服务器去“拉取”最新代码。

  * **前提**：你已经在本地修改了后端代码 (`server/` 目录) 并推送到了 GitHub。

  * **操作步骤**：

    **第一步：SSH 登录服务器**

    ```bash
    ssh ubuntu@你的公网IP
    # 如果需要 root 权限，登录后输入 sudo -i
    ```

    **第二步：进入后端目录并拉取代码**

    ```bash
    cd /var/www/after-school/server

    # 拉取最新代码
    git pull
    ```

    *(注意：如果提示冲突，说明你在服务器上改过文件。如果是 .env 没关系，如果是代码文件，建议先 git stash)*

    **第三步：安装依赖 (如果有新包)**

      * 如果你在 `package.json` 里加了新插件 (比如 `npm install moment`)，必须执行：

    <!-- end list -->

    ```bash
    npm install
    ```

      * *如果没有加新包，这一步可跳过。*

    **第四步：重启服务 (最关键)**

      * 代码虽然更新了，但内存里跑的还是旧程序，必须重启 PM2 才能生效：

    <!-- end list -->

    ```bash
    pm2 restart server
    ```

    **第五步：验证**

    ```bash
    pm2 list
    # 确认 status 是绿色的 online
    ```

-----

## 3\. 常见情况速查表

| 场景 | 前端操作 | 后端操作 | 数据库操作 |
| :--- | :--- | :--- | :--- |
| **只改了 Vue 页面文字** | `git push` 即可 | 无需操作 | 无需操作 |
| **只改了后端 API 逻辑** | 无需操作 | `ssh` -\> `git pull` -\> `pm2 restart` | 无需操作 |
| **安装了新插件 (npm)** | `git push` (CF 会自动装) | `git pull` -\> `npm install` -\> `pm2 restart` | 无需操作 |
| **修改了数据库表结构** | 按需更新 | 按需更新 | 需用 Navicat 或 SQL 命令行手动执行 `ALTER TABLE...` |

-----

**建议：** 即使是很小的后端改动，也养成 **“改完代码 -\> 推送 GitHub -\> 服务器拉取”** 的好习惯，尽量不要直接在服务器上用 `vim` 改代码，防止版本混乱！

# 文档站部署

官网源码位于 site/，使用 VitePress。主题构建 `npm run build` 与官网构建 `npm run docs:build` 分开，避免把需要 Komari API 的主题界面部署成官网。

推荐 Vercel 设置：仓库根目录、VitePress、`npm run docs:build`，输出 `theme/public`。根目录 vercel.json 已记录这些设置。

为了兼容早期 Vercel 部署，构建后同时把静态文档写入 `theme/public`，并为根目录、`theme`、`theme/public` 三种历史目录设置提供配置。该目录是生成的官网，不是 Komari 主题安装包；不要手工编辑其中的页面。修改 site/ 后重新构建。

`site/.vitepress/dist` 和 cache 为本机临时构建目录；`theme/public` 作为兼容静态部署产物进入版本库。docs:build 会移除已过期的生成文件，保留准确的当前输出。

GitHub 的 Deployments 显示的是 Vercel 部署记录。旧失败记录不会被删除或标成成功；修复后应查看新提交对应的 Preview 和 Production。若项目使用其他自定义根目录或强制构建覆盖，需有 Vercel 项目权限的账号修改该设置。

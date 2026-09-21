# 安装 Komari Next Pro

下载 Release 中 `*-theme.zip`，通过 Komari 后台主题管理上传并启用。ZIP 根目录应有 komari-theme.json 和 dist/，不要把 source.zip 当主题导入。

首次以管理员回到首页会出现配置向导，可以选择预设、布局、外观、背景和语言。个人偏好保存在浏览器；“保存为站点默认”用于设置所有访客的初始配置。旧缓存未更新时强制刷新页面。

核心功能直接使用 Komari API，无需部署第二个服务。可选扩展用于媒体上传/直链下载、播放列表保存以及手动节点任务；步骤见 EXTENSION.md 和随主题提供的 extension-guide.html。

安装标识和兼容 API 前缀仍为 komari-ds、/komari-ds-api/v1。不要为了更换展示名称而移动已存在的数据目录或环境文件。

从源代码构建：Node.js 24.15+，运行 `npm ci --ignore-scripts`、`npm run build`、`npm run package`。如果启用视频转码，扩展所在机器还需要 FFmpeg。

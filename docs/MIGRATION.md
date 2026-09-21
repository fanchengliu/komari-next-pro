# 从 Next Pro / komari-ds 迁移

## Komari Next Pro

Orbit 使用独立实现，安装 short 为 komari-ds。先保留旧主题 ZIP、主题配置、旧扩展配置和媒体目录，再上传 Orbit 主题。旧主题不会因安装另一 short 自动删除，切换回去即可恢复旧外观。

Next Pro 的私有扩展和浏览器配置不自动导入。需要服务端媒体库或节点任务时，部署 Orbit 配套服务到独立目录与 /komari-ds-api/ 路由；不要将旧 /ip-meta/、/unlock-probe/ 或背景服务路由改指向不兼容服务。可用 scripts/migrate-media.ts 从导出的播放列表复制媒体，默认 dry-run，确认后加 --apply。

## 已有 komari-ds 2.x

Orbit 3.0 保留 short、浏览器存储键、主题配置版本及扩展 API 前缀。上传主题会更新相同 short 的文件，已有显式背景链接和个人配置继续使用。内置默认 Logo/背景换为 Orbit 原创素材；需要保留原内置媒体时，先把它们保存到独立媒体库并设置链接。

已有 2.2.1 或更新扩展可继续使用本版主题。扩展更新时在新代码目录安装，保留 DS_DATA_DIR 和环境文件，备份 SQLite，再切换服务。不要删除旧媒体库。主题不会自动触发节点任务。

## 回退与历史

回退 DS 可重新上传保留的 2.x ZIP。回退 Next Pro 可直接在后台切换旧主题。本仓库更换主线内容不重写历史或删除旧 Release；旧实现从历史提交和旧标签获取。

主题不注册 Service Worker。若站点已有旧 Worker 缓存了首页或后台，需要清理旧缓存后检查 /admin 和 /terminal。JS/CSS 使用带哈希的资源文件，入口 HTML 不应长期缓存。

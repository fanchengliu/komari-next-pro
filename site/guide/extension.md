# 配套扩展服务

核心监控不需要额外服务。服务器媒体库、公开媒体直链下载、持久化播放列表和手动节点检测由配套扩展提供。

## 需要准备

- Node.js 24.15 或更高的 24 / 26 版本。
- 可访问 Komari 的服务器，以及同域反向代理。
- 需要视频转码时安装 FFmpeg。

从 Release 下载 `-extension.zip`，解压到独立目录，安装依赖：

```sh
npm ci --ignore-scripts --no-audit --no-fund
```

环境配置示例：

```ini
DS_KOMARI_ORIGIN=http://127.0.0.1:25774
DS_PUBLIC_ORIGIN=https://monitor.example.com
DS_DATA_DIR=/var/lib/komari-ds
DS_BIND=127.0.0.1
DS_PORT=5175
DS_ENABLE_JOBS=false
```

通过随包提供的 systemd 或 Docker 示例持续运行。将 `/komari-ds-api/` 代理到 `127.0.0.1:5175`，再到主题设置的扩展服务页检查连接。[完整配置与权限说明](https://github.com/fanchengliu/komari-next-pro/blob/main/docs/EXTENSION.md)

## 节点检测

需要检测时显式启用 `DS_ENABLE_JOBS=true`，并允许相应 Komari Agent 执行任务。页面按钮只对选中节点下发固定任务，不自动批量执行。

IP 归属分别记录 IPv4 和 IPv6 成功或失败原因。参考估算无需质量 Key，基于已取得的资料计算，能展开查看规则。真实 VPN、代理、Tor 等数据源指标需要服务端配置相应质量服务。

::: warning 密钥位置
`DS_KOMARI_API_KEY`、`DS_IPAPI_KEY` 只放在服务端环境中，不能填进公开主题配置或提交到仓库。
:::

升级扩展时保留原数据目录与环境文件，先备份 SQLite 和媒体库，再切换代码目录。两代 Next Pro 扩展 API 不应互相覆盖。

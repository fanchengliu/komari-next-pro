# 独立扩展服务

核心首页、状态、图表、统计直接调用 Komari 官方 API。2.1 中背景链接与播放设置可保存到本浏览器；服务器媒体库、链接下载和节点检测使用独立扩展服务。主题设置 → 扩展服务提供连接状态与部署入口。运行需要 Node.js >=24.15.0 <27（已在本机 24.18 和服务器 24.15 验证）。

## 启动

解压源码或扩展包，`npm ci` 后设置环境并运行 `npm run extension`。扩展包含 TypeScript 源码，运行使用锁定的 tsx，因此需要安装开发依赖。

| 环境变量          | 说明                                                                    |
| ----------------- | ----------------------------------------------------------------------- |
| DS_KOMARI_ORIGIN  | 后端地址，默认 http://127.0.0.1:25774                                   |
| DS_PUBLIC_ORIGIN  | 用户实际访问的 HTTPS origin，必须精确匹配                               |
| DS_DATA_DIR       | 新服务专用数据目录，默认 .local/extension                               |
| DS_BIND / DS_PORT | 默认 127.0.0.1:5175                                                     |
| DS_ENABLE_JOBS    | 设为 true 才启用手动节点任务                                            |
| DS_KOMARI_API_KEY | 可选服务端密钥；启用 2FA 的站点执行任务时使用，不下发到浏览器           |
| DS_IPAPI_KEY      | 可选 ipapi.is 质量查询密钥；仅扩展服务使用，不放入 Agent 命令或前端配置 |
| DS_FFMPEG         | 可选 FFmpeg 可执行文件，配置后提供 H.264 转码                           |

Nginx 示例见 `deploy/nginx.conf.example`；Dockerfile 安装 FFmpeg 并以普通用户运行。Docker 方式须为数据卷配置 UID 1000 的写权限。环境文件不会进入源码包。

## API 与安全边界

统一前缀 `/komari-ds-api/v1/`。读写会话通过 Komari `/api/me` 验证；写接口还验证 Origin 和绑定当前会话的 CSRF token。任务结果按账号隔离，每次读取还检查节点可见性。不存在通过请求体传入任意命令的入口。

`GET /capabilities`、`GET /playlist`、媒体文件可公开访问。`GET /session`、媒体列表、任务缓存需要登录。`PUT /playlist`、`POST /media`、`POST /media/import`、`DELETE /media/:id`、`POST /media/:id/transcode`、`POST /jobs` 需要写权限。上传限制 100 MiB，只接受 JPEG/PNG/WebP/MP4/WebM 签名；新增 POST /media/import 支持公开 HTTP(S) 媒体直链下载，逐次重定向重新解析并固定连接地址，拒绝内网、环回、链路本地、映射私网与非标准端口；不转发 Cookie 或凭据。下载限时 45 秒、单文件 100 MiB、同一服务一次一个任务，并检查媒体签名。

媒体名称采用服务端随机 ID，支持视频 Range 请求。转码生成新文件，保留原视频；参数固定为 H.264、最大 1920 宽、无音轨、两线程、五分钟超时，仅允许本地文件协议。一次只转码一个视频。

节点任务分为 IP、服务可达性、只读系统服务快照。默认不自动执行或定时执行；读缓存不触发任务。同账号/节点/类型去重，最多四个并发任务，30 秒冷却。重启时在途任务标记失败，不自动再次下发命令。旧记录保留 90 天。

IP 查询依赖节点上的 curl 与 ipinfo.io 公共接口。设置 DS_IPAPI_KEY 后，扩展服务可通过 ipapi.is 补充 VPN/代理/Tor/机房/滥用标记和服务商网段评分；缺少数据源时保持未知，不生成评分。网段评分不等同于单个 IP 的风险概率。密钥只用于服务端 HTTPS 查询，结果按已知字段投影后缓存；429 不自动重试。[质量数据源文档](https://ipapi.is/developers.html)

服务探测对 Netflix、Disney+、YouTube、Spotify、TikTok、ChatGPT、Claude、Gemini 进行 IPv4/IPv6 HTTP 探测。HTTP 可达不等于账号/地区已解锁，结果保留证据和“不确定/待确认”状态，不能据 200 响应伪造解锁结论。

固定快照命令读取 uname、uptime、systemctl、ss、docker ps；不修改节点配置。首版面向用户现有的 Linux 节点。启用任务前确保 Komari Agent 允许 exec；不允许时会返回可见失败信息。

SQLite 仅含本项目配置、媒体和任务记录，不打开或修改 Komari 的数据库。

## 2.1 媒体模式

播放列表保留 version=1，新增 order=hold（保持当前图片，或循环当前视频）和可选 selectedId。原 rotation/random、full/fixed 保持兼容。删除媒体仍会从站点播放列表移除。主题“保存到本机”只修改浏览器偏好；“保存播放列表”写站点。选择“使用站点背景”可撤销本机覆盖。

部署时使用独立用户和数据目录，新增专用代理，不覆盖旧 knp、IP、流媒体等服务。模板提供 systemd 与 Docker 两种启动方式；不要同时绑定同一端口。主题 ZIP 自带 extension-guide.html。

## 2.2 自动汇率

新增公开只读 GET `/komari-ds-api/v1/exchange-rates`。数据来自 Frankfurter v2，固定 CNY 基准后转为每单位外币对应 CNY，不上传节点名称、价格或账号信息。服务端缓存一小时，合并并发请求；手动 `?fresh=1` 最快一分钟更新一次。有效结果写入本项目 SQLite，失败返回带 stale 标记的上次成功结果；冷启动没有数据时返回 503。客户端也保留缓存并标记来源与时间。

这是最新公布的参考汇率，通常按日更新，并非秒级成交报价。币种缺失时不使用原手填数字冒充当前汇率。Frankfurter API 无需密钥，数据源和日期在界面内可见。文档：https://frankfurter.dev/ 。

## 2.2.1 IP 检测修复

IPv6 出口查询使用 `https://v6.ipinfo.io/json`，IPv4 保持原端点。分别记录 curl 退出码、HTTP 状态和响应校验结果；不将错误 JSON 或错误 IP 家族当作成功。任务新增 `partial` 状态，保留分模块结果；两种 IP 都失败时为 failed，数据取得但部分模块缺失时为 partial，全部取得才为 done。

没有 `DS_IPAPI_KEY` 时质量模块明确报告 not_configured，不自动发送质量请求。通过 ipapi.is 取得自己的密钥后，在扩展环境文件中设置并重启，再手动重新检测。不要将密钥放进主题配置或浏览器。前端展示数据源支持的布尔标记及网段滥用比例，不生成置信度/风险估分；旧缓存显示保留结果，只有手动重测才运行新任务。

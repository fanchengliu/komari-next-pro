# 3.0.0 release notes

**Komari Next Pro 3.0.0** 延续原项目名称，采用全新的独立实现。本版包含主题与可选扩展、新的原创品牌素材、全球节点和网络对比、五种语言、透明度设置、可解释的 IP 参考估算，以及明确的分协议检测状态。

## Release 附件

- `komari-next-pro-3.0.0-theme.zip`：Komari 后台可直接安装。
- `komari-next-pro-3.0.0-source.zip`：可独立构建的完整源码、锁文件、测试、文档和素材。
- `komari-next-pro-3.0.0-extension.zip`：可选独立服务。
- `SHA256SUMS` 与 `manifest.json`：文件校验和。

安装 short 保持 `komari-ds`，已有 DS 2.x 配置和 2.2.1+ 扩展继续兼容。Next Pro 用户需按 MIGRATION.md 切换主题及按需部署独立扩展。原主题不会自动删除；旧代码和 Release 应继续保留。

## 验证

73 项数据/服务测试、42 个 Edge 浏览器场景通过；真实 Komari 1.5.0 分片上传安装、后台/终端路由、缺失资源 404 和回退通过。源码包在独立目录安装依赖后重建，298 个生产文件哈希一致。GitHub Actions 已配置，远端 CI 需在提交推送后运行。

默认素材和演示数据已公开化。IP 评分为明确标注的规则参考，HTTP 探测不代表完整解锁，汇率为最新公布参考值。

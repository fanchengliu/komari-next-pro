# Komari Next Pro Theme

这个目录存放 Komari Next Pro 的前端主题模块。

## 简介

这个主题的目标是改善 Komari 默认界面的观感与信息组织方式，让首页更像 dashboard，节点卡片更完整，详情页结构更清晰。

## 亮点

- DStatus 风格首页布局
- 重做的 dashboard 卡片与节点卡片
- 更好的详情页体验
- 更丰富的 IP 信息展示
- 网络质量展示优化
- 兼容 Komari 主题配置机制
- 可选接入 `unlock-probe` 后端

## 构建

```bash
cd theme
npm install
npm run build
```

构建完成后，将生成的主题文件与 `komari-theme.json` 一起部署到 Komari 主题目录。

## 说明

- 这个模块可以独立运行，不强依赖后端。
- 如果不部署 `unlock-probe`，流媒体解锁与部分高级卡片配置功能将不可用。
- 正式发布前建议再检查 `komari-theme.json` 中的主题名、short、描述与可管理配置项。

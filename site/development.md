# 开发指南

仓库包含主题、配套服务和文档站，使用同一份锁文件管理依赖。

```text
apps/theme/      React 主题
apps/extension/  独立配套服务
packages/       配置和数据规则
site/           VitePress 文档站
tests/          数据、服务和浏览器测试
deploy/         部署示例
```

## 启动主题演示

```sh
npm ci --ignore-scripts
npm run demo
# 另开终端
npm run dev
```

打开 `http://127.0.0.1:5173`，演示账号为 `demo / demo`。演示数据与 IP 均为合成示例。

## 启动文档站

```sh
npm run docs:dev
npm run docs:build
npm run docs:preview
```

主题构建仍使用 `npm run build`；Vercel 构建文档站使用 `npm run docs:build`，输出到 `site/.vitepress/dist`。

## 验证和打包

```sh
npm test
npm run build
npm run test:e2e
npm run package
```

浏览器测试在 Windows 默认使用 Edge；Linux/macOS 先执行 `npx playwright install chromium`。可以用 `DS_BROWSER` 指定浏览器路径。

提交 PR 时说明用户能看到的变化和验证结果。数据源估算、测量结果与未知状态需要保持明确区分。请不要提交生产数据库、账号密钥或未脱敏的节点记录。

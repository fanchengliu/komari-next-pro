# 安装与更新

## 安装前

准备一个可以正常访问的 Komari 服务。当前兼容验证基线为 Komari 1.5.0；更新已有主题前，保留旧主题包和站点配置。

## 安装主题

1. 打开 [GitHub Releases](https://github.com/fanchengliu/komari-next-pro/releases/latest)。
2. 下载文件名以 **`-theme.zip`** 结尾的安装包。
3. 在 Komari 管理后台的主题管理中上传 ZIP。
4. 选择 **Komari Next Pro**，返回主页。
5. 通过首次配置向导选择布局、背景、语言和显示内容。

::: tip 选对安装包
`-source.zip` 是完整源码，`-extension.zip` 是可选配套服务；GitHub 自动生成的 Source code ZIP 也不是主题安装包。
:::

## 从旧版升级

3.x 的显示名称为 **Komari Next Pro**，内部安装标识仍为 `komari-ds`，以保留已有 DS 配置和扩展路由。

- 已有 **komari-ds 2.x**：上传新版会更新同一安装标识的文件。建议先保留当前内置媒体副本，或把个人媒体保存到独立媒体库。
- 已有 **Next Pro 2.x**：安装 3.x 后在后台切换主题，旧主题与旧扩展先保留。两代扩展 API 不应直接混用。

## 刷新与回退

更新后仍看到旧页脚或样式时，先使用 `Ctrl + Shift + R` 强制刷新。旧 Service Worker 仍缓存页面时，再清理该站点缓存。

需要回退时，重新导入保留的 DS 主题包，或切换回旧 Next Pro 主题。主题更新不会要求删除 Komari 数据库。

## 下一步

[设置外观与背景](./appearance) · [查看网络历史](./network) · [按需安装扩展](./extension)

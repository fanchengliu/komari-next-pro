import { defineConfig } from "vitepress";
const repo = "https://github.com/fanchengliu/komari-next-pro";
const zhSidebar = [
  {
    text: "开始使用",
    items: [
      { text: "项目介绍", link: "/guide/introduction" },
      { text: "安装与更新", link: "/guide/getting-started" },
      { text: "常见问题", link: "/guide/faq" },
    ],
  },
  {
    text: "功能指南",
    items: [
      { text: "外观与背景", link: "/guide/appearance" },
      { text: "网络历史与节点对比", link: "/guide/network" },
      { text: "全球节点", link: "/guide/globe" },
      { text: "资产、到期与流量", link: "/guide/reports" },
    ],
  },
  {
    text: "进阶",
    items: [
      { text: "配套扩展服务", link: "/guide/extension" },
      { text: "开发指南", link: "/development" },
      { text: "社区与致谢", link: "/community" },
    ],
  },
];
export default defineConfig({
  title: "Komari Next Pro",
  description: "独立实现的 Komari 主题，让节点监控更清晰。",
  lang: "zh-CN",
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/logo.svg" }],
    ["meta", { name: "theme-color", content: "#3478f6" }],
    ["meta", { property: "og:title", content: "Komari Next Pro" }],
    [
      "meta",
      {
        property: "og:description",
        content: "玻璃卡片、网络历史、全球节点与个性化外观。",
      },
    ],
  ],
  sitemap: { hostname: "https://komari-next-pro.vercel.app" },
  locales: {
    root: {
      label: "简体中文",
      lang: "zh-CN",
      themeConfig: {
        nav: [
          { text: "主页", link: "/" },
          { text: "快速开始", link: "/guide/getting-started" },
          { text: "开发指南", link: "/development" },
          { text: "社区", link: "/community" },
        ],
        sidebar: zhSidebar,
        outline: { label: "本页目录" },
        docFooter: { prev: "上一篇", next: "下一篇" },
        lastUpdated: { text: "最后更新" },
        returnToTopLabel: "返回顶部",
        sidebarMenuLabel: "目录",
        darkModeSwitchLabel: "外观",
        footer: {
          message: "为你的节点，做一个清晰的窗口。",
          copyright: "Komari Next Pro · Powered by Komari Monitor.",
        },
      },
    },
    en: {
      label: "English",
      lang: "en",
      link: "/en/",
      description:
        "An independent Komari theme with a clear view of your nodes.",
      themeConfig: {
        nav: [
          { text: "Home", link: "/en/" },
          { text: "Get started", link: "/en/getting-started" },
          { text: "Features", link: "/en/features" },
          { text: "Community", link: "/en/community" },
        ],
        sidebar: [
          {
            text: "Documentation",
            items: [
              { text: "Get started", link: "/en/getting-started" },
              { text: "Features", link: "/en/features" },
              { text: "Companion service", link: "/en/extension" },
              { text: "FAQ", link: "/en/faq" },
              { text: "Community", link: "/en/community" },
            ],
          },
        ],
        footer: {
          message: "Your nodes. Your network. One clear view.",
          copyright: "Komari Next Pro · Powered by Komari Monitor.",
        },
      },
    },
  },
  themeConfig: {
    logo: "/logo.svg",
    siteTitle: "Komari Next Pro",
    socialLinks: [{ icon: "github", link: repo }],
    search: {
      provider: "local",
      options: {
        locales: {
          root: {
            translations: {
              button: { buttonText: "搜索文档", buttonAriaLabel: "搜索文档" },
              modal: {
                displayDetails: "显示详情",
                resetButtonTitle: "清除搜索",
                backButtonTitle: "返回",
                noResultsText: "没有找到相关结果",
                footer: {
                  selectText: "选择",
                  navigateText: "切换",
                  closeText: "关闭",
                },
              },
            },
          },
        },
      },
    },
    editLink: {
      pattern: repo + "/edit/main/site/:path",
      text: "在 GitHub 上编辑此页",
    },
  },
});

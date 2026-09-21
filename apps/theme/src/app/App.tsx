import { SetupTrigger } from "../features/setup/SetupWizard";
import { BRAND } from "../brand";
import { LanguageMenu } from "../ui/LanguageSelect";
import { Activity, Columns3, Globe2, Layers, Grid2X2 } from "lucide-react";
import V from "../ui/v2.module.css";
const NetworkPage = lazy(() =>
  import("../features/network/NetworkPage").then((m) => ({
    default: m.NetworkPage,
  })),
);
const Compare = lazy(() =>
  import("../features/Compare").then((m) => ({ default: m.Compare })),
);
const Layouts = lazy(() =>
  import("../features/Layouts").then((m) => ({ default: m.Layouts })),
);
const GlobePage = lazy(() =>
  import("../features/globe/GlobePage").then((m) => ({ default: m.GlobePage })),
);
const PingDialog = lazy(() =>
  import("../features/network/PingDialog").then((m) => ({
    default: m.PingDialog,
  })),
);
function MainNav({ mobile = false }: { mobile?: boolean }) {
  const t = useTranslate();
  const { settings } = useModel();
  const routes = [
    ["/", "概览", Grid2X2],
    ["/network", "网络总览", Activity],
    ["/compare", "节点对比", Columns3],
    ...(settings.globeEnabled ? [["/globe", "全球节点", Globe2]] : []),
    ["/layouts", "布局预设", Layers],
  ] as const;
  return (
    <nav
      className={mobile ? V.bottomnav : V.mainnav}
      aria-label={t(mobile ? "手机导航" : "主导航")}
    >
      {routes.map(([path, title, Icon]) => {
        const I = Icon as typeof Activity;
        return (
          <NavLink key={path as string} to={path as string} end={path === "/"}>
            <I size={15} />
            <span>{t(title as string)}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
import { Component, lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Link, NavLink } from "react-router-dom";
import {
  Calculator,
  CalendarClock,
  ChartNoAxesCombined,
  Image,
  Monitor,
  Palette,
  Languages,
  Eye,
  EyeOff,
  LogOut,
  Settings as SettingsIcon,
} from "lucide-react";
import { useModel, queryClient } from "../data/context";
import { useTranslate } from "../data/i18n";
import { useUI } from "../data/store";
import { rpc } from "../data/rpc";
import { safeMediaUrl } from "../domain/model";
import { Background } from "../features/Background";
import { Dashboard } from "../features/Dashboard";
import { Detail } from "../features/Detail";
import { Dialogs, Settings } from "../features/Dialogs";
import { S, State } from "../ui/primitives";
import { ScrollReset } from "./ScrollReset";
function Header() {
  const t = useTranslate();
  const { site, viewer, settings } = useModel();
  const { set, configure } = useUI();
  const logo = safeMediaUrl(settings.logo);
  const icons = [
    ["assets", "资产计算器", Calculator],
    ["expiry", "到期时间线", CalendarClock],
    ["traffic", "流量统计", ChartNoAxesCombined],
    ["background", "背景设置", Image],
  ] as const;
  async function logout() {
    rpc.reset();
    await queryClient.cancelQueries();
    queryClient.removeQueries({ queryKey: ["session"] });
    location.assign("/api/logout");
  }
  return (
    <header className={S.header}>
      <div className={`${S.nav} ${V.navFrame}`}>
        <Link className={S.brand} to="/">
          {logo ? (
            <img src={logo} alt={t("站点 Logo")} />
          ) : (
            <span className={S.brandIcon}>DS</span>
          )}
          <span>{site?.sitename || "Komari Next Pro"}</span>
        </Link>
        <MainNav />
        <nav className={`${S.toolbar} ${V.toolbar}`} aria-label={t("工具栏")}>
          {icons.map(([id, label, Icon]) => (
            <button
              key={id}
              className={S.icon}
              aria-label={t(label)}
              title={t(label)}
              onClick={() => set({ dialog: id })}
            >
              <Icon />
            </button>
          ))}
          <button
            className={`${S.icon} ${S.optionalNav}`}
            aria-label={t("切换明暗")}
            title={t("切换明暗")}
            onClick={() =>
              configure({
                appearance: settings.appearance === "dark" ? "light" : "dark",
              })
            }
          >
            <Monitor />
          </button>
          <button
            className={S.icon}
            aria-label={t("主题设置")}
            title={t("主题设置")}
            onClick={() => set({ dialog: "settings" })}
          >
            <Palette />
          </button>
          <LanguageMenu />
          {viewer.logged_in ? (
            <>
              <a
                href="/admin"
                className={S.icon}
                title={t("管理后台")}
                aria-label={t("管理后台")}
              >
                <SettingsIcon size={16} />
              </a>
              <button
                className={S.icon}
                aria-label={t("退出登录")}
                title={t("退出登录")}
                onClick={() => void logout()}
              >
                <LogOut />
              </button>
            </>
          ) : (
            <button
              className={S.login}
              onClick={() => set({ dialog: "login" })}
            >
              {t("登录")}
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <div className={S.center}>
        <State error={this.state.error} />
        <button onClick={() => location.reload()}>重新加载 / Reload</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export function App() {
  const t = useTranslate();
  return (
    <BrowserRouter>
      <ScrollReset />
      <SetupTrigger />
      <Background />
      {
        <>
          <Header />
          <ErrorBoundary>
            <Suspense fallback={<State busy />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/instance/:id" element={<Detail />} />
                <Route path="/network" element={<NetworkPage />} />
                <Route path="/compare" element={<Compare />} />
                <Route path="/layouts" element={<Layouts />} />
                <Route path="/globe" element={<GlobePage />} />
                <Route
                  path="/theme/settings"
                  element={
                    <main
                      className={`${S.glass} ${S.detail}`}
                      style={{ padding: 24 }}
                    >
                      <Settings />
                    </main>
                  }
                />
                <Route
                  path="*"
                  element={
                    <main className={S.center}>
                      <State empty={t("页面不存在")} />
                      <Link to="/">{t("返回首页")}</Link>
                    </main>
                  }
                />
              </Routes>
            </Suspense>
          </ErrorBoundary>
          <MainNav mobile />
          <footer className={S.footer}>
            {BRAND.name} · {BRAND.attribution}
          </footer>
          <Dialogs />
          <Suspense fallback={null}>
            <PingDialog />
          </Suspense>
        </>
      }
    </BrowserRouter>
  );
}

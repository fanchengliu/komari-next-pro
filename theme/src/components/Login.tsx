import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Flex } from "@/components/ui/flex";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Box } from "@/components/ui/box";
import { useTranslation } from "react-i18next";
import { TablerSettings } from "./Icones/Tabler";
import { AccountProvider, useAccount } from "@/contexts/AccountContext";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import { useMounted } from "@/hooks/useMounted";

type LoginDialogProps = {
  trigger?: React.ReactNode | string;
  autoOpen?: boolean;
  showSettings?: boolean;
  info?: string | React.ReactNode;
  onLoginSuccess?: () => void;
};

const LoginDialog = ({ trigger, autoOpen = false, showSettings = true, info, onLoginSuccess }: LoginDialogProps) => {
  const InnerLayout = () => {
    const { account, loading, error, refresh } = useAccount();
    const [t] = useTranslation();
    const mounted = useMounted();
    const [username, setUsername] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [twoFac, setTwoFac] = React.useState("");
    const [errorMsg, setErrorMsg] = React.useState("");
    const [isLoading, setIsLoading] = React.useState(false);
    const [require2FA, setRequire2FA] = React.useState(false);
    const [open, setOpen] = React.useState(autoOpen || false);
    const {publicInfo} = usePublicInfo();
  // 是否启用密码登录
  const passwordLoginEnabled = !publicInfo?.disable_password_login;
  const oauthEnabled = !!publicInfo?.oauth_enable;
  const onlyOAuthLogin = oauthEnabled && !passwordLoginEnabled; // 只有 OAuth
  // Validate inputs (仅在启用密码登录时需要)
  const isFormValid = passwordLoginEnabled && username.trim() !== "" && password.trim() !== "";
    //console.log(autoOpen, open);
    React.useEffect(() => {
      if (autoOpen) {
        setOpen(true);
      }
    }, [autoOpen]);
    // Handle login
    const handleLogin = async () => {
      if (!isFormValid) {
        setErrorMsg("Username and password are required");
        return;
      }

      setErrorMsg("");
      setIsLoading(true);
      try {
        const res = await fetch("/api/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username,
            password,
            ...(twoFac && !account?.["2fa_enabled"] ? { "2fa_code": twoFac } : {}),
          }),
        });
        const data = await res.json();
        if (res.status === 200) {
          refresh();
          if (typeof onLoginSuccess === "function") {
            onLoginSuccess();
            return
          }
          window.open("/admin", "_self");
        } else {
          if (data.message === "2FA code is required") {
            setRequire2FA(true);
            return;
          }
          setErrorMsg(data.message || "Login failed");
        }
      } catch (err) {
        setErrorMsg("Network error");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    // Handle Enter key press
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !isLoading && isFormValid) {
        e.preventDefault(); // Prevent form submission issues
        handleLogin();
      }
    };

    if (loading) {
      return <Button disabled>{mounted ? t("loading") : "Loading..."}</Button>;
    }
    if (error || !account) {
      return (
        <Button disabled className="text-destructive">
          Error
        </Button>
      );
    }
    if (account.logged_in) {
      if (!showSettings) {
        return null;
      }
      return (
        <a href="/admin" target="_blank">
          <Button variant="ghost" size="icon">
            <TablerSettings></TablerSettings>
          </Button>
        </a>
      );
    }

    // 仅 OAuth 登录 且 不自动打开时：点击触发器直接跳转，不展示对话框
    if (onlyOAuthLogin && !autoOpen) {
      const redirect = () => {
        window.location.href = "/api/oauth";
      };
      if (trigger) {
        // 如果提供了自定义触发器，包装一层点击
        if (typeof trigger === "string") {
          return (
            <Button onClick={redirect}>{trigger}</Button>
          );
        }
        return (
          <span onClick={redirect} style={{ cursor: "pointer", display: "inline-flex" }}>
            {trigger}
          </span>
        );
      }
      // 默认按钮
      return (
        <Button onClick={redirect}>{t("login.title")}</Button>
      );
    }
    return (
  <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger ? trigger : <Button>{t("login.title")}</Button>}
        </DialogTrigger>
        <DialogContent className="max-w-[450px]">
          <DialogTitle>{t("login.title")}</DialogTitle>
          <DialogDescription className="mb-4">
            <div className="flex justify-center flex-col gap-2">
              <label>{t("login.desc")}</label>
              {info && (
                <label>
                  {info}
                </label>
              )}
            </div>

          </DialogDescription>
          <Box
            onSubmit={(e) => {
              e.preventDefault(); // Prevent native form submission
              if (isFormValid && !isLoading) {
                handleLogin();
              }
            }}
          >
            <Flex direction="column" gap="3">
              {passwordLoginEnabled && (
                <>
                  <label>
                    <Text as="div" size="2" weight="bold">
                      {t("login.username")}
                    </Text>
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="admin"
                      disabled={isLoading}
                      autoFocus
                    />
                  </label>
                  <label>
                    <Text as="div" size="2" weight="bold">
                      {t("login.password")}
                    </Text>
                    <Input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handleKeyDown}
                      type="password"
                      placeholder={t("login.password_placeholder")}
                      disabled={isLoading}
                    />
                  </label>
                  <label hidden={!require2FA}>
                    <Text as="div" size="2" weight="bold">
                      {t("login.two_factor")}
                    </Text>
                    <Input
                      value={twoFac}
                      onChange={(e) => setTwoFac(e.target.value)}
                      onKeyDown={handleKeyDown}
                      type="text"
                      placeholder="000000"
                      disabled={isLoading}
                    />
                  </label>
                  {errorMsg && (
                    <Text as="div" size="2" className="text-destructive">
                      {errorMsg}
                    </Text>
                  )}
                  <Button
                    type="submit"
                    disabled={isLoading || !isFormValid}
                    style={{ opacity: isLoading || !isFormValid ? 0.6 : 1 }}
                    onClick={handleLogin}
                  >
                    {isLoading ? "Logging in..." : t("login.title")}
                  </Button>
                </>
              )}
              {/* OAuth 登录按钮：即使关闭密码登录也展示 */}
              {publicInfo?.oauth_enable && (
                <Button
                  onClick={() => {
                    window.location.href = "/api/oauth";
                  }}
                  variant={passwordLoginEnabled ? "outline" : "default"}
                  disabled={isLoading}
                  type="button"
                >
                  {t("login.login_with", {
                    provider:
                      publicInfo?.oauth_provider === "generic"
                        ? "OAuth"
                        : publicInfo?.oauth_provider
                        ? publicInfo.oauth_provider.charAt(0).toUpperCase() +
                          publicInfo.oauth_provider.slice(1)
                        : "",
                  })}
                </Button>
              )}
            </Flex>
          </Box>
        </DialogContent>
      </Dialog>
    );
  };
  return (
    <AccountProvider>
      <InnerLayout />
    </AccountProvider>
  );
};

export default LoginDialog;

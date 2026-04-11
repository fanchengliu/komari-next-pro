"use client";

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme, ColorTheme } from '@/contexts/ThemeContext';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Palette, Image, SlidersHorizontal } from 'lucide-react';

const ThemeSwitcher = () => {
  const [t] = useTranslation();
  const [canEditBranding, setCanEditBranding] = useState(false);
  const { themeConfig, managedThemeSettings, setColorTheme, setBackgroundImageUrl, setLogoImageUrl, statusCardsVisibility, setStatusCardsVisibility } = useTheme();
  const [bgUrlInput, setBgUrlInput] = useState(themeConfig.backgroundImageUrl || '');
  const [logoUrlInput, setLogoUrlInput] = useState(themeConfig.logoImageUrl || '');

  useEffect(() => {
    setBgUrlInput(themeConfig.backgroundImageUrl || '');
  }, [themeConfig.backgroundImageUrl]);

  useEffect(() => {
    setLogoUrlInput(themeConfig.logoImageUrl || '');
  }, [themeConfig.logoImageUrl]);

  useEffect(() => {
    let mounted = true;
    fetch('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (mounted) setCanEditBranding(!!data?.logged_in);
      })
      .catch(() => {
        if (mounted) setCanEditBranding(false);
      });
    return () => {
      mounted = false;
    };
  }, []);


  const statusCardOptions = [
    { key: 'currentTime', label: t('current_time', { defaultValue: '当前时间' }) },
    { key: 'currentOnline', label: t('current_online', { defaultValue: '当前在线' }) },
    { key: 'regionOverview', label: t('region_overview', { defaultValue: '点亮地区' }) },
    { key: 'trafficOverview', label: t('traffic_overview', { defaultValue: '流量概览' }) },
    { key: 'networkSpeed', label: t('network_speed', { defaultValue: '网络速率' }) },
    { key: 'assetOverview', label: t('asset_overview', { defaultValue: '资产统计' }) },
  ] as const;

  const colorThemes: { value: ColorTheme; label: string; colors: string }[] = [
    { value: 'default', label: t('theme.default', { defaultValue: '默认' }), colors: 'from-blue-500 to-purple-500' },
    { value: 'ocean', label: t('theme.ocean', { defaultValue: '海洋' }), colors: 'from-cyan-500 to-blue-600' },
    { value: 'sunset', label: t('theme.sunset', { defaultValue: '落日' }), colors: 'from-orange-500 to-pink-500' },
    { value: 'forest', label: t('theme.forest', { defaultValue: '森林' }), colors: 'from-green-500 to-emerald-600' },
    { value: 'midnight', label: t('theme.midnight', { defaultValue: '午夜' }), colors: 'from-indigo-600 to-purple-700' },
    { value: 'rose', label: t('theme.rose', { defaultValue: '玫瑰' }), colors: 'from-pink-500 to-rose-600' },
  ];


  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Palette className="h-4 w-4" />
          <span className="sr-only">{t('theme.settings', { defaultValue: '主题设置' })}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-h-[85vh] overflow-y-auto p-4" align="end" sideOffset={8}>
        <div className="flex flex-col gap-4">
          <div>
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2 sticky -top-4 bg-popover pb-2 z-10 -mx-4 px-4 pt-4">
              <Palette className="h-4 w-4" />
              {t('theme.color_theme', { defaultValue: '颜色主题' })}
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {colorThemes.map((theme) => (
                <button
                  key={theme.value}
                  onClick={() => setColorTheme(theme.value)}
                  className={`relative rounded-lg p-2 text-left transition-all ${
                    themeConfig.colorTheme === theme.value
                      ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                      : 'hover:bg-accent'
                  }`}
                >
                  <div className={`h-6 w-full rounded-md bg-gradient-to-r ${theme.colors} mb-1.5`} />
                  <span className="text-[10px] font-medium">{theme.label}</span>
                </button>
              ))}
            </div>
            {managedThemeSettings.colorTheme && (
              <p className="text-[11px] text-muted-foreground">{t('theme.managed_by_admin', { defaultValue: '当前主题默认值已由后台接管，可在前台临时覆盖。' })}</p>
            )}
          </div>

          <div className="border-t pt-3">
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              {t('status_settings', { defaultValue: '状态显示设置' })}
            </h4>
            <div className="flex flex-col gap-3">
              {statusCardOptions.map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2">
                  <span className="text-xs text-foreground/90">{item.label}</span>
                  <Switch
                    checked={statusCardsVisibility[item.key]}
                    onCheckedChange={(checked) =>
                      setStatusCardsVisibility({
                        ...statusCardsVisibility,
                        [item.key]: checked,
                      })
                    }
                  />
                </div>
              ))}
            </div>
            {managedThemeSettings.colorTheme && (
              <p className="text-[11px] text-muted-foreground">{t('theme.managed_by_admin', { defaultValue: '当前主题默认值已由后台接管，可在前台临时覆盖。' })}</p>
            )}
          </div>

          <div className="border-t pt-3">
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Image className="h-4 w-4" />
              {t('theme.background_image', { defaultValue: '背景图片' })}
            </h4>
            <div className="flex flex-col gap-2">
              <Input
                type="url"
                placeholder={t('theme.image_url_placeholder', { defaultValue: '输入图片链接' })}
                value={bgUrlInput}
                onChange={(e) => setBgUrlInput(e.target.value)}
                disabled={!canEditBranding}
                className="text-xs"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="default" className="flex-1 text-xs h-8" onClick={() => setBackgroundImageUrl(bgUrlInput)}>
                  {t('common.apply', { defaultValue: '应用' })}
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-xs h-8" disabled={!canEditBranding} onClick={() => { if (!canEditBranding) return; setBgUrlInput(''); setBackgroundImageUrl(''); }}>
                  {t('common.clear', { defaultValue: '清除' })}
                </Button>
              </div>
            </div>
            {managedThemeSettings.colorTheme && (
              <p className="text-[11px] text-muted-foreground">{t('theme.managed_by_admin', { defaultValue: '当前主题默认值已由后台接管，可在前台临时覆盖。' })}</p>
            )}
          </div>

          <div className="border-t pt-3">
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Image className="h-4 w-4" />
              {t('theme.logo_image', { defaultValue: 'Logo 图片' })}
            </h4>
            <div className="flex flex-col gap-2">
              <Input
                type="url"
                placeholder={t('theme.logo_url_placeholder', { defaultValue: '输入 Logo 图片链接' })}
                value={logoUrlInput}
                onChange={(e) => setLogoUrlInput(e.target.value)}
                disabled={!canEditBranding}
                className="text-xs"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="default" className="flex-1 text-xs h-8" disabled={!canEditBranding} onClick={() => { if (!canEditBranding) return; setLogoImageUrl(logoUrlInput); }}>
                  {t('common.apply', { defaultValue: '应用' })}
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-xs h-8" disabled={!canEditBranding} onClick={() => { if (!canEditBranding) return; setLogoUrlInput(''); setLogoImageUrl(''); }}>
                  {t('common.clear', { defaultValue: '清除' })}
                </Button>
              </div>
            </div>
            {!canEditBranding && (
              <p className="text-[11px] text-muted-foreground">{t('theme.login_required_logo', { defaultValue: '登录后可修改 Logo 图片' })}</p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ThemeSwitcher;

"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

export type ColorTheme = 'default' | 'ocean' | 'sunset' | 'forest' | 'midnight' | 'rose';
export type CardLayout = 'classic' | 'modern' | 'minimal' | 'detailed';

interface ThemeConfig {
  colorTheme: ColorTheme;
  cardLayout: CardLayout;
  backgroundImageUrl?: string;
  logoImageUrl?: string;
  footerBrandLine?: string;
  showAssetCalculatorButton?: boolean;
}

export interface StreamUnlockConfig {
  enabled: boolean;
  mode: 'all' | 'include' | 'exclude' | 'off';
  nodeMatchList: string;
  includeNodes?: string;
  autoRunDays: number;
  showIPv6: boolean;
}

interface StatusCardsVisibility {
  currentTime: boolean;
  currentOnline: boolean;
  regionOverview: boolean;
  trafficOverview: boolean;
  networkSpeed: boolean;
  latencyOverview: boolean;
  lossOverview: boolean;
  assetOverview: boolean;
}

interface ManagedThemeSettings {
  colorTheme?: ColorTheme;
  cardLayout?: CardLayout;
  backgroundImageUrl?: string;
  logoImageUrl?: string;
  footerBrandLine?: string;
  showAssetCalculatorButton?: boolean;
  streamUnlock?: Partial<StreamUnlockConfig>;
  statusCardsVisibility?: Partial<StatusCardsVisibility>;
}

interface ThemeContextType {
  themeConfig: ThemeConfig;
  managedThemeSettings: ManagedThemeSettings;
  setColorTheme: (theme: ColorTheme) => void;
  setCardLayout: (layout: CardLayout) => void;
  setBackgroundImageUrl: (url: string) => void;
  setLogoImageUrl: (url: string) => void;
  statusCardsVisibility: StatusCardsVisibility;
  showAssetCalculatorButton: boolean;
  setStatusCardsVisibility: (value: StatusCardsVisibility) => void;
  streamUnlockConfig: StreamUnlockConfig;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const THEME_STORAGE_KEY = 'komari-theme-config';

const DEFAULT_THEME_CONFIG: ThemeConfig = {
  colorTheme: 'default',
  cardLayout: 'classic',
  backgroundImageUrl: '',
  logoImageUrl: '',
  footerBrandLine: '',
  showAssetCalculatorButton: true,
};

const DEFAULT_STREAM_UNLOCK_CONFIG: StreamUnlockConfig = {
  enabled: true,
  mode: 'all',
  nodeMatchList: '',
  includeNodes: '',
  autoRunDays: 5,
  showIPv6: true,
};

const DEFAULT_STATUS_VISIBILITY: StatusCardsVisibility = {
  currentTime: true,
  currentOnline: true,
  regionOverview: true,
  trafficOverview: true,
  networkSpeed: true,
  latencyOverview: false,
  lossOverview: false,
  assetOverview: true,
};

function normalizeManagedThemeSettings(input: any): ManagedThemeSettings {
  if (!input || typeof input !== 'object') return {};

  const result: ManagedThemeSettings = {};

  if (typeof input.colorTheme === 'string') result.colorTheme = input.colorTheme as ColorTheme;
  if (typeof input.cardLayout === 'string') result.cardLayout = input.cardLayout as CardLayout;
  if (typeof input.backgroundImageUrl === 'string') result.backgroundImageUrl = input.backgroundImageUrl;
  if (typeof input.logoImageUrl === 'string') result.logoImageUrl = input.logoImageUrl;
  if (typeof input.footerBrandLine === 'string') result.footerBrandLine = input.footerBrandLine;
  if (typeof input.showAssetCalculatorButton === 'boolean') result.showAssetCalculatorButton = input.showAssetCalculatorButton;
  if (input.streamUnlock && typeof input.streamUnlock === 'object') {
    result.streamUnlock = {
      ...DEFAULT_STREAM_UNLOCK_CONFIG,
      ...input.streamUnlock,
      nodeMatchList: input.streamUnlock.nodeMatchList ?? input.streamUnlock.includeNodes ?? DEFAULT_STREAM_UNLOCK_CONFIG.nodeMatchList,
      mode: ['all', 'include', 'exclude', 'off'].includes(input.streamUnlock.mode) ? input.streamUnlock.mode : DEFAULT_STREAM_UNLOCK_CONFIG.mode,
      autoRunDays: Number(input.streamUnlock.autoRunDays ?? DEFAULT_STREAM_UNLOCK_CONFIG.autoRunDays) || DEFAULT_STREAM_UNLOCK_CONFIG.autoRunDays,
    };
  }

  if (input.statusCardsVisibility && typeof input.statusCardsVisibility === 'object') {
    result.statusCardsVisibility = {
      ...DEFAULT_STATUS_VISIBILITY,
      ...input.statusCardsVisibility,
    };
  }

  return result;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [localThemeConfig, setLocalThemeConfig] = useState<ThemeConfig>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          return {
            colorTheme: parsed.colorTheme || 'default',
            cardLayout: parsed.cardLayout || 'classic',
            backgroundImageUrl: parsed.backgroundImageUrl || '',
            logoImageUrl: parsed.logoImageUrl || '',
            footerBrandLine: parsed.footerBrandLine || '',
            showAssetCalculatorButton: parsed.showAssetCalculatorButton ?? true,
          };
        } catch {
          return DEFAULT_THEME_CONFIG;
        }
      }
    }
    return DEFAULT_THEME_CONFIG;
  });

  const [localStatusCardsVisibility, setLocalStatusCardsVisibility] = useLocalStorage<StatusCardsVisibility>('statusCardsVisibility', DEFAULT_STATUS_VISIBILITY);

  const [managedThemeSettings, setManagedThemeSettings] = useState<ManagedThemeSettings>({});

  useEffect(() => {
    let mounted = true;
    fetch('/api/public')
      .then((res) => (res.ok ? res.json() : null))
      .then((resp) => {
        if (!mounted) return;
        setManagedThemeSettings(normalizeManagedThemeSettings(resp?.data?.theme_settings));
      })
      .catch(() => {
        if (!mounted) return;
        setManagedThemeSettings({});
      });
    return () => {
      mounted = false;
    };
  }, []);

  const themeConfig: ThemeConfig = {
    colorTheme: managedThemeSettings.colorTheme ?? localThemeConfig.colorTheme ?? DEFAULT_THEME_CONFIG.colorTheme,
    cardLayout: managedThemeSettings.cardLayout ?? localThemeConfig.cardLayout ?? DEFAULT_THEME_CONFIG.cardLayout,
    backgroundImageUrl: managedThemeSettings.backgroundImageUrl ?? localThemeConfig.backgroundImageUrl ?? '',
    logoImageUrl: managedThemeSettings.logoImageUrl ?? localThemeConfig.logoImageUrl ?? '',
    footerBrandLine: managedThemeSettings.footerBrandLine ?? localThemeConfig.footerBrandLine ?? '',
    showAssetCalculatorButton: managedThemeSettings.showAssetCalculatorButton ?? localThemeConfig.showAssetCalculatorButton ?? true,
  };

  const streamUnlockConfig: StreamUnlockConfig = {
    ...DEFAULT_STREAM_UNLOCK_CONFIG,
    ...(managedThemeSettings.streamUnlock || {}),
  };

  const statusCardsVisibility: StatusCardsVisibility = {
    ...DEFAULT_STATUS_VISIBILITY,
    ...localStatusCardsVisibility,
    ...(managedThemeSettings.statusCardsVisibility || {}),
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(localThemeConfig));
    }
  }, [localThemeConfig]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.setAttribute('data-color-theme', themeConfig.colorTheme);
  }, [themeConfig.colorTheme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const bgUrl = themeConfig.backgroundImageUrl || '';
    const body = document.body as HTMLBodyElement & { dataset: DOMStringMap };
    if (body.dataset.komariBgUrl === bgUrl) return;
    body.dataset.komariBgUrl = bgUrl;
    if (bgUrl) {
      const apply = () => {
        body.dataset.komariCustomBg = '1';
        body.style.setProperty('--komari-bg-image', `url(${bgUrl})`);
        body.style.backgroundImage = 'none';
      };
      const img = new Image();
      img.onload = apply;
      img.onerror = apply;
      img.src = bgUrl;
    } else {
      delete body.dataset.komariCustomBg;
      body.style.removeProperty('--komari-bg-image');
      body.style.backgroundImage = '';
    }
  }, [themeConfig.backgroundImageUrl]);

  const setColorTheme = (theme: ColorTheme) => setLocalThemeConfig(prev => ({ ...prev, colorTheme: theme }));
  const setCardLayout = (layout: CardLayout) => setLocalThemeConfig(prev => ({ ...prev, cardLayout: layout }));
  const setBackgroundImageUrl = (url: string) => setLocalThemeConfig(prev => ({ ...prev, backgroundImageUrl: url }));
  const setLogoImageUrl = (url: string) => setLocalThemeConfig(prev => ({ ...prev, logoImageUrl: url }));

  return (
    <ThemeContext.Provider value={{ themeConfig, managedThemeSettings, setColorTheme, setCardLayout, setBackgroundImageUrl, setLogoImageUrl, statusCardsVisibility, showAssetCalculatorButton: themeConfig.showAssetCalculatorButton ?? true, setStatusCardsVisibility: setLocalStatusCardsVisibility, streamUnlockConfig }}>
      {children}
    </ThemeContext.Provider>
  );
};

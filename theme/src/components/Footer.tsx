"use client";

import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';

const Footer = () => {
  const [t] = useTranslation();
  const { themeConfig } = useTheme();

  return (
    <footer className="border-t bg-gradient-to-b from-card/30 to-card/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-6">
        <p className="text-center text-xs text-muted-foreground">
          {themeConfig.footerBrandLine || t('footer.bottom_line', { defaultValue: '技术支持 Komari-Next and LIU' })}
        </p>
      </div>
    </footer>
  );
};

export default Footer;

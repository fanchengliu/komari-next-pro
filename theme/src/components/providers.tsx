"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { ThemeProvider } from "@/contexts/ThemeContext"
import { RPC2Provider } from "@/contexts/RPC2Context"
import { PublicInfoProvider } from "@/contexts/PublicInfoContext"
import { NodeListProvider } from "@/contexts/NodeListContext"
import { LiveDataProvider } from "@/contexts/LiveDataContext"
import { AssetSummaryProvider } from "@/contexts/AssetSummaryContext"
import { Toaster } from "@/components/ui/sonner"
import { OfflineIndicator } from "@/components/OfflineIndicator"
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt"
import { PWAUpdatePrompt } from "@/components/PWAUpdatePrompt"
import { MobileTouchFeedback } from "@/components/MobileTouchFeedback"
import "@/i18n/config"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ThemeProvider>
        <RPC2Provider>
          <PublicInfoProvider>
            <NodeListProvider>
              <LiveDataProvider>
                <AssetSummaryProvider>{children}
                <Toaster />
                <OfflineIndicator />
                <PWAInstallPrompt />
                <PWAUpdatePrompt />
                <MobileTouchFeedback />
                </AssetSummaryProvider>
              </LiveDataProvider>
            </NodeListProvider>
          </PublicInfoProvider>
        </RPC2Provider>
      </ThemeProvider>
    </NextThemesProvider>
  )
}

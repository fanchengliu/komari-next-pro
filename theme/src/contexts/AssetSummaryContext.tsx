"use client";

import React from 'react';

export type AssetSummaryState = {
  totalValueCNY: number;
  totalMonthlyCNY: number;
  totalRemainingCNY: number;
  count: number;
};

const AssetSummaryContext = React.createContext<{
  summary: AssetSummaryState;
  setSummary: (s: AssetSummaryState) => void;
} | undefined>(undefined);

export const AssetSummaryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [summary, setSummary] = React.useState<AssetSummaryState>({
    totalValueCNY: 0,
    totalMonthlyCNY: 0,
    totalRemainingCNY: 0,
    count: 0,
  });
  return <AssetSummaryContext.Provider value={{ summary, setSummary }}>{children}</AssetSummaryContext.Provider>;
};

export function useAssetSummary() {
  const ctx = React.useContext(AssetSummaryContext);
  if (!ctx) throw new Error('useAssetSummary must be used within AssetSummaryProvider');
  return ctx;
}

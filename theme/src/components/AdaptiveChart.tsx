"use client";

import React from "react";
import CircleChart from "./CircleChart";

interface AdaptiveChartProps {
  value: number;
  label: string;
  subLabel?: string;
  color?: string;
  compact?: boolean;
}

export default function AdaptiveChart({ value, label, subLabel, color, compact = false }: AdaptiveChartProps) {
  return <CircleChart value={value} label={label} subLabel={subLabel} color={color} compact={compact} />;
}

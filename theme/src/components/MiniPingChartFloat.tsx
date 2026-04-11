import React, { useState, useRef, useCallback } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import MiniPingChart from "./MiniPingChart";

interface FloatMiniPingChartProps {
  uuid: string;
  trigger: React.ReactNode;
  chartWidth?: string | number;
  chartHeight?: string | number;
  hours?: number;
}

const MiniPingChartFloat: React.FC<FloatMiniPingChartProps> = ({
  uuid,
  trigger,
  chartWidth = 600,
  chartHeight = 300,
  hours = 12,
}) => {
  const [open, setOpen] = useState(false);
  const hoverTimeoutRef = useRef<number | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      setOpen(true);
    }, 3000);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      setOpen(false);
    }, 200);
  }, []);

  const handleClick = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setOpen((prev) => !prev);
  }, []);

  // Calculate responsive dimensions
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const responsiveWidth = isMobile ? '100vw' : (typeof chartWidth === 'number' ? `${chartWidth}px` : chartWidth);
  const responsiveHeight = isMobile ? 250 : chartHeight;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          style={{ cursor: "pointer" }}
          className="flex items-center justify-center"
        >
          {trigger}
        </span>
      </PopoverTrigger>
      <PopoverContent
        sideOffset={5}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="p-2 border shadow-lg rounded-lg z-[5] bg-card w-auto md:max-w-[95vw] max-w-[100vw] mx-auto"
        style={{ width: responsiveWidth }}
        align="center"
      >
        <MiniPingChart hours={hours} uuid={uuid} width="100%" height={responsiveHeight} />
      </PopoverContent>
    </Popover>
  );
};

export default MiniPingChartFloat;

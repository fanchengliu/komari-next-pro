import React, { useState } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";

interface TipsProps {
  size?: string;
  color?: string;
  children?: React.ReactNode;
  trigger?: React.ReactNode;
  mode?: "popup" | "dialog" | "auto";
  side?: "top" | "right" | "bottom" | "left";
}

const Tips: React.FC<TipsProps & React.HTMLAttributes<HTMLDivElement>> = ({
  size = "16",
  color = "gray",
  trigger,
  children,
  side = "bottom",
  mode = "popup",
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  // determine whether to render a Dialog instead of a Popover
  const isDialog = mode === "dialog" || (mode === "auto" && isMobile);

  const handleInteraction = () => {
    // toggle when using Dialog (click) or on mobile (click)
    if (isDialog || isMobile) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className="relative inline-block" {...props}>
      {isDialog ? (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <div
              className={`flex items-center justify-center rounded-full font-bold cursor-pointer `}
              onClick={handleInteraction}
            >
              {trigger ?? <Info color={color} size={Number(size)} />}
            </div>
          </DialogTrigger>
          <DialogContent>
            <div className="flex flex-col gap-2">
              <div>{children}</div>
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <div
              className={`flex items-center justify-center rounded-full font-bold cursor-pointer `}
              onClick={isMobile ? handleInteraction : undefined}
              onMouseEnter={!isMobile ? () => setIsOpen(true) : undefined}
              onMouseLeave={!isMobile ? () => setIsOpen(false) : undefined}
            >
              {trigger ?? <Info color={color} size={Number(size)} />}
            </div>
          </PopoverTrigger>
          <PopoverContent
            side={side}
            sideOffset={5}
            onMouseEnter={!isMobile ? () => setIsOpen(true) : undefined}
            onMouseLeave={!isMobile ? () => setIsOpen(false) : undefined}
            className="relative text-sm min-w-48"
          >
            {children}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};

export default Tips;

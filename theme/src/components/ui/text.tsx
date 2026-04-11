import * as React from "react"
import { cn } from "@/lib/utils"

interface TextProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: "1" | "2" | "3" | "4" | "5"
  weight?: "light" | "regular" | "medium" | "bold"
  color?: "gray"
  truncate?: boolean
  as?: "span" | "p" | "div" | "label"
}

const Text = React.forwardRef<HTMLSpanElement, TextProps>(
  ({ className, size = "2", weight = "regular", color, truncate, as: Component = "span", ...props }, ref) => {
    const sizeClass = {
      "1": "text-xs",
      "2": "text-sm",
      "3": "text-base",
      "4": "text-lg",
      "5": "text-xl",
    }[size]

    const weightClass = {
      light: "font-light",
      regular: "font-normal",
      medium: "font-medium",
      bold: "font-bold",
    }[weight]

    const colorClass = color === "gray" ? "text-muted-foreground" : ""

    return (
      <Component
        ref={ref as any}
        className={cn(
          sizeClass,
          weightClass,
          colorClass,
          truncate && "truncate",
          className
        )}
        {...props}
      />
    )
  }
)
Text.displayName = "Text"

export { Text }

import * as React from "react"
import { cn } from "@/lib/utils"

interface FlexProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: "row" | "column" | "row-reverse" | "column-reverse"
  align?: "start" | "center" | "end" | "stretch" | "baseline"
  justify?: "start" | "center" | "end" | "between" | "around" | "evenly"
  gap?: "1" | "2" | "3" | "4" | "5" | "6" | "8"
  wrap?: "wrap" | "nowrap" | "wrap-reverse"
}

const Flex = React.forwardRef<HTMLDivElement, FlexProps>(
  ({ className, direction = "row", align, justify, gap, wrap, ...props }, ref) => {
    const directionClass = {
      row: "flex-row",
      column: "flex-col",
      "row-reverse": "flex-row-reverse",
      "column-reverse": "flex-col-reverse",
    }[direction]

    const alignClass = align && {
      start: "items-start",
      center: "items-center",
      end: "items-end",
      stretch: "items-stretch",
      baseline: "items-baseline",
    }[align]

    const justifyClass = justify && {
      start: "justify-start",
      center: "justify-center",
      end: "justify-end",
      between: "justify-between",
      around: "justify-around",
      evenly: "justify-evenly",
    }[justify]

    const gapClass = gap && {
      "1": "gap-1",
      "2": "gap-2",
      "3": "gap-3",
      "4": "gap-4",
      "5": "gap-5",
      "6": "gap-6",
      "8": "gap-8",
    }[gap]

    const wrapClass = wrap && {
      wrap: "flex-wrap",
      nowrap: "flex-nowrap",
      "wrap-reverse": "flex-wrap-reverse",
    }[wrap]

    return (
      <div
        ref={ref}
        className={cn(
          "flex",
          directionClass,
          alignClass,
          justifyClass,
          gapClass,
          wrapClass,
          className
        )}
        {...props}
      />
    )
  }
)
Flex.displayName = "Flex"

export { Flex }

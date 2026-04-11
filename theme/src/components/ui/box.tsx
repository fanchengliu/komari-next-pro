import * as React from "react"
import { cn } from "@/lib/utils"

interface BoxProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType
}

const Box = React.forwardRef<HTMLElement, BoxProps>(
  ({ className, as: Component = "div", ...props }, ref) => {
    const Comp = Component as any
    return (
      <Comp
        ref={ref}
        className={cn(className)}
        {...props}
      />
    )
  }
)
Box.displayName = "Box"

export { Box }

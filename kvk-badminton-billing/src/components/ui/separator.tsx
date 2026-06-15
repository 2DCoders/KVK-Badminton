import * as React from "react"

export interface SeparatorProps
  extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical"
}

export function Separator({ className, orientation = "horizontal", ...props }: SeparatorProps) {
  return (
    <div
      className={`shrink-0 bg-border ${
        orientation === "vertical" ? "h-full w-px" : "h-px w-full"
      } ${className}`}
      {...props}
    />
  )
}

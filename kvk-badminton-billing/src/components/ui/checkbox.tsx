import * as React from "react"

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      className={`h-4 w-4 rounded border border-primary/30 bg-white cursor-pointer accent-primary ${className}`}
      {...props}
    />
  )
}

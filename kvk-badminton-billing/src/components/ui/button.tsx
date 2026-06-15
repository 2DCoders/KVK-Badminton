import * as React from "react"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost"
  size?: "sm" | "md" | "lg"
}

export function Button({ className, variant = "default", size = "md", ...props }: ButtonProps) {
  const baseClasses = "inline-flex items-center justify-center whitespace-nowrap rounded-lg font-semibold ring-offset-background transition transform-gpu focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"

  const variantClasses = {
    default: "bg-primary text-white hover:bg-indigo-600 btn-elevated hover:shadow-xl",
    outline: "bg-transparent border border-gray-200 text-secondary hover:bg-gray-50",
    ghost: "bg-transparent hover:bg-gray-50 text-secondary"
  }

  const sizeClasses = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base"
  }

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    />
  )
}

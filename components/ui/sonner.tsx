"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // هنا قمنا بإضافة إعدادات التصميم لفرض اللون الغامق
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-slate-900 group-[.toaster]:text-white group-[.toaster]:border-slate-800 group-[.toaster]:shadow-xl w-full",
          description: "group-[.toast]:text-slate-400",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      icons={{
        success: <CircleCheckIcon className="size-5 text-green-500" />,
        info: <InfoIcon className="size-5 text-blue-500" />,
        warning: <TriangleAlertIcon className="size-5 text-yellow-500" />,
        error: <OctagonXIcon className="size-5 text-red-500" />,
        loading: <Loader2Icon className="size-5 animate-spin text-slate-400" />,
      }}
      {...props}
    />
  )
}

export { Toaster }
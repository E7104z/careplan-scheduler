import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "../lib/cn";

export interface ToastProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
}

export function Toast({ open, onOpenChange, message }: ToastProps) {
  return (
    <ToastPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      duration={5000}
      className="grid rounded-md border border-line bg-surface p-4 shadow-pop"
    >
      <div className="flex items-start justify-between gap-4">
        {/* The status is the message: the toast itself stays an item of the viewport's list. */}
        <ToastPrimitive.Description role="status" className="text-sm text-ink">
          {message}
        </ToastPrimitive.Description>
        <ToastPrimitive.Close
          className="grid place-items-center rounded-sm p-1 text-ink-2 hover:bg-sunk max-sm:-m-2.5 max-sm:h-11 max-sm:w-11"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </ToastPrimitive.Close>
      </div>
    </ToastPrimitive.Root>
  );
}

export interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {children}
    </ToastPrimitive.Provider>
  );
}

export interface ToastViewportProps {
  className?: string;
}

export function ToastViewport({ className }: ToastViewportProps) {
  return (
    <ToastPrimitive.Viewport
      className={cn(
        "fixed bottom-0 right-0 z-50 flex w-full flex-col items-center gap-2 p-4 sm:bottom-4 sm:right-4 sm:w-auto sm:items-end",
        className,
      )}
    />
  );
}

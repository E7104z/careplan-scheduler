import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Toast, ToastProvider, ToastViewport } from "./Toast";

export interface FlashToastProps {
  message: string;
}

/**
 * A toast handed over by navigation state (`navigate("/", { state: { toast: "Signed out" } })`).
 * When it closes, the state is cleared so a reload or Back doesn't show it again.
 */
export function FlashToast({ message }: FlashToastProps) {
  const [open, setOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <ToastProvider>
      <Toast
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) void navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
        }}
        message={message}
      />
      <ToastViewport />
    </ToastProvider>
  );
}

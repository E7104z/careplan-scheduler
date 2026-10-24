import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Toast, ToastProvider, ToastViewport } from "./Toast";

const ShowToast = createContext<(message: string) => void>(() => undefined);

/** Lets any screen below show a toast with `useToast()("Changes saved")`. One at a time. */
export function ToastHost({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const nextId = useRef(0);
  const show = useCallback((message: string) => {
    nextId.current += 1;
    setToast({ id: nextId.current, message });
  }, []);

  return (
    <ShowToast.Provider value={show}>
      <ToastProvider>
        {children}
        {toast ? (
          <Toast
            key={toast.id}
            open
            onOpenChange={(open) => {
              if (!open) setToast(null);
            }}
            message={toast.message}
          />
        ) : null}
        <ToastViewport />
      </ToastProvider>
    </ShowToast.Provider>
  );
}

export function useToast(): (message: string) => void {
  return useContext(ShowToast);
}

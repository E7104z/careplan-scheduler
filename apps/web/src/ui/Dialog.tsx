import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export interface DialogProps {
  title: string;
  description?: string;
  /** The button that opens it. Leave it out for a dialog opened by state (e.g. a timer). */
  trigger?: ReactNode;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * For a dialog opened by state: where focus goes on close (call `event.preventDefault()` and
   * focus it), since there is no trigger for Radix to return focus to.
   */
  onCloseAutoFocus?: (event: Event) => void;
}

export function Dialog({
  title,
  description,
  trigger,
  children,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: DialogProps) {
  const [ownOpen, setOwnOpen] = useState(false);
  const isOpen = open ?? ownOpen;
  const contentRef = useRef<HTMLDivElement>(null);

  const changeOpen = (next: boolean) => {
    setOwnOpen(next);
    onOpenChange?.(next);
  };

  // Radix gives Escape to the top layer only, and a toast shown from inside the dialog
  // ("Invite link copied") is a layer above it: Escape would close the toast and leave the
  // dialog open. While focus is in the dialog, Escape closes the dialog (APP-SPEC 4.2) and the
  // toast stays. Window capture runs before Radix's document listeners; preventDefault tells
  // them the key is handled. Focus in a menu opened from the dialog is outside `content`.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const content = contentRef.current;
      if (event.key !== "Escape" || !content || !(event.target instanceof Node)) return;
      if (!content.contains(event.target)) return;
      event.preventDefault();
      setOwnOpen(false);
      onOpenChange?.(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isOpen, onOpenChange]);

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={changeOpen}>
      {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <DialogPrimitive.Content
          ref={contentRef}
          onCloseAutoFocus={onCloseAutoFocus}
          className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,480px)] -translate-x-1/2 -translate-y-1/2 rounded-md border border-line bg-surface p-5 shadow-pop">
          <div className="flex items-start justify-between gap-4">
            <DialogPrimitive.Title className="text-[17px] font-bold text-ink">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              className="grid place-items-center rounded-sm p-1 text-ink-2 hover:bg-sunk max-sm:-m-2 max-sm:h-11 max-sm:w-11"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>
          {description ? (
            <DialogPrimitive.Description className="mt-1 text-sm text-ink-2">
              {description}
            </DialogPrimitive.Description>
          ) : null}
          <div className="mt-4">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

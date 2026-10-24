import { type TextareaHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /**
   * Called with the box's whole text once the browser has inserted a paste (APP-SPEC 4.2), so
   * Quick Schedule can build from a paste with no button press.
   */
  onPasteText?: (text: string) => void;
}

export function Textarea({ className, onPasteText, onInput, ...rest }: TextareaProps) {
  return (
    <textarea
      spellCheck={false}
      autoComplete="off"
      className={cn(
        "min-h-[150px] w-full resize-y rounded-sm border border-line-2 bg-surface px-3 py-2 text-ink placeholder:text-ink-3 focus:border-brand",
        className,
      )}
      onInput={(event) => {
        onInput?.(event);
        const native = event.nativeEvent;
        if (onPasteText && "inputType" in native && native.inputType === "insertFromPaste") {
          onPasteText(event.currentTarget.value);
        }
      }}
      {...rest}
    />
  );
}

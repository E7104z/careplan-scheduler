import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Upload } from "lucide-react";
import { cn } from "../lib/cn";

export interface FileDropProps {
  onFile: (file: File) => void;
  /** The file input's id, so a page can put focus on the chooser. */
  id?: string;
  accept?: string;
  acceptLabel?: string;
  title?: string;
  hint?: string;
  className?: string;
}

export function FileDrop({
  onFile,
  id,
  accept,
  acceptLabel = "PDF",
  title = "Choose a file",
  hint,
  className,
}: FileDropProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onFile(file);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <label
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        // The input is visually hidden, so the label shows the keyboard focus ring for it.
        "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-line-2 bg-surface px-6 py-8 text-center transition-colors focus-within:border-brand has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus",
        dragOver && "border-brand bg-brand-tint",
        className,
      )}
    >
      <Upload className="h-6 w-6 text-brand" aria-hidden="true" />
      <span className="text-sm font-medium text-ink">{title}</span>
      <span className="text-[13px] text-ink-3">{acceptLabel}</span>
      {hint ? <span className="text-[13px] text-ink-3">{hint}</span> : null}
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={handleChange}
      />
    </label>
  );
}

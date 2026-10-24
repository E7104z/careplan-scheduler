import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { TextInput } from "../../ui/TextInput";

/** A password input with a show/hide toggle (APP-SPEC 6.2). Field supplies its id and label. */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(
  function PasswordInput(props, ref) {
    const [shown, setShown] = useState(false);
    return (
      <div className="relative">
        <TextInput
          {...props}
          ref={ref}
          type={shown ? "text" : "password"}
          spellCheck={false}
          autoCapitalize="none"
          className="pr-20"
        />
        <button
          type="button"
          aria-label={shown ? "Hide password" : "Show password"}
          className="absolute inset-y-1 right-1 rounded-sm px-3 text-sm font-semibold text-brand hover:bg-brand-tint"
          onClick={() => setShown((value) => !value)}
        >
          {shown ? "Hide" : "Show"}
        </button>
      </div>
    );
  },
);

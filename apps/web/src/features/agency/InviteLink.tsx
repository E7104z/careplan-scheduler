import { Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { TextInput } from "../../ui/TextInput";
import { useToast } from "../../ui/ToastHost";
import { copyText } from "./clipboard";
import { inviteMailto } from "./inviteFields";

const secondaryLink =
  "inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-line-2 bg-surface px-4 font-semibold leading-none text-ink transition-colors hover:bg-sunk max-sm:min-h-11";

const COPY_FALLBACK = "Your browser didn't allow copying. The link is selected, so copy it from the box.";

export interface InviteLinkProps {
  link: string;
  email: string;
  agencyName: string;
  /** Select the link as soon as it shows (after a copy from the table didn't work). */
  selectFirst?: boolean;
}

/** The join link with "Copy invite link" and "Open in my email app" (APP-SPEC 6.4). */
export function InviteLink({ link, email, agencyName, selectFirst = false }: InviteLinkProps) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [copyFailed, setCopyFailed] = useState(selectFirst);

  const selectLink = () => {
    inputRef.current?.focus();
    inputRef.current?.select();
  };

  useEffect(() => {
    if (selectFirst) selectLink();
  }, [selectFirst]);

  const copy = async () => {
    if (await copyText(link)) {
      setCopyFailed(false);
      toast("Invite link copied");
      return;
    }
    setCopyFailed(true);
    selectLink();
  };

  return (
    <div className="grid gap-3">
      <Field label="Invite link">
        <TextInput ref={inputRef} readOnly value={link} onFocus={(event) => event.target.select()} />
      </Field>
      <p aria-live="polite" className="text-[13px] text-ink-2 empty:hidden">
        {copyFailed ? COPY_FALLBACK : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void copy()}>Copy invite link</Button>
        <a href={inviteMailto(email, agencyName, link)} className={secondaryLink}>
          <Mail className="h-4 w-4" aria-hidden="true" />
          Open in my email app
        </a>
      </div>
    </div>
  );
}

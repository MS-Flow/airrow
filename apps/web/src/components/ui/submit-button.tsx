"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./button";
import { Spinner } from "./spinner";

/**
 * A submit button that reports the form's own pending state. Server actions here reach
 * Supabase or the database before they redirect, which is long enough that a button with
 * no feedback reads as a dropped click and invites a second one.
 *
 * `useFormStatus` reads the enclosing <form>, so this has to be its own component rather
 * than a hook call inside the page that renders the form.
 */
export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  ...props
}: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending ? (
        <>
          <Spinner className="size-3.5 border-current/30 border-t-current" />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

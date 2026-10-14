"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { initialFormState, type FormState } from "@/lib/forms";
import { cn } from "@/lib/utils";

import { FormAlert } from "./form-status";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/**
 * Small inline form for one action (approve, restock, issue, ...).
 * Submits inside a transition instead of through the form `action` prop,
 * so typed values are kept when the server returns an error. The form is
 * cleared only after a successful save.
 *
 * With `confirm`, the first click asks for confirmation inline (no modal):
 * the message and a confirm button appear in place, and focus moves to it.
 */
export function ActionForm({
  action,
  submitLabel,
  pendingLabel = "Saving…",
  variant = "default",
  confirm,
  className,
  children,
}: {
  action: Action;
  submitLabel: string;
  pendingLabel?: string;
  variant?: "default" | "outline" | "destructive" | "secondary";
  confirm?: { message: string; confirmLabel: string };
  className?: string;
  children?: React.ReactNode;
}) {
  const [state, dispatch] = useActionState(action, initialFormState);
  const [pending, startTransition] = useTransition();
  // Armed for the current result only: any new server result disarms it.
  const [armedFor, setArmedFor] = useState<FormState | null>(null);
  const armed = armedFor === state;
  const formRef = useRef<HTMLFormElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  useEffect(() => {
    if (armed) confirmRef.current?.focus();
  }, [armed]);

  // Inline forms have no per-field error slots, so field messages are shown
  // in the alert itself.
  const fieldMessages = Object.values(state.fieldErrors ?? {});
  const shown = fieldMessages.length ? { error: fieldMessages.join(" ") } : state;

  return (
    <form
      ref={formRef}
      noValidate
      className={cn("grid gap-3", className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !armed) {
          setArmedFor(state);
          return;
        }
        const formData = new FormData(e.currentTarget);
        startTransition(() => dispatch(formData));
      }}
    >
      <FormAlert state={shown} />
      {children}
      {armed && confirm ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Confirm action">
          <p className="w-full text-sm" aria-live="polite">
            {confirm.message}
          </p>
          <Button ref={confirmRef} type="submit" variant={variant} disabled={pending}>
            {pending ? pendingLabel : confirm.confirmLabel}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setArmedFor(null)} disabled={pending}>
            Keep it
          </Button>
        </div>
      ) : (
        <div>
          <Button type="submit" variant={variant} disabled={pending}>
            {pending ? pendingLabel : submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}

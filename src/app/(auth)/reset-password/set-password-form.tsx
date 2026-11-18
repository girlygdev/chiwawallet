"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { FormError } from "@/components/auth/form-error";
import { PasswordField } from "@/components/auth/password-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { passwordStrength } from "@/lib/auth/password-strength";
import { type SetPasswordInput, setPasswordSchema } from "@/lib/validation/auth";
import { cn } from "@/lib/utils";
import { setNewPassword } from "../actions";

const fields = ["password", "confirmPassword", "signOutOthers"] as const;

export function SetPasswordForm() {
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<SetPasswordInput>({
    resolver: zodResolver(setPasswordSchema),
    mode: "onTouched",
    defaultValues: { password: "", confirmPassword: "", signOutOthers: true },
  });

  const password = useWatch({ control, name: "password" });
  const confirmPassword = useWatch({ control, name: "confirmPassword" });
  const strength = passwordStrength(password);
  const matches = confirmPassword.length > 0 && confirmPassword === password;

  const onSubmit = (values: SetPasswordInput) => {
    setFormError(undefined);
    startTransition(async () => {
      // On success the action signs out and redirects to /login.
      const result = await setNewPassword(values);
      if (result.formError) setFormError(result.formError);
      const firstBad = fields.find((f) => result.fieldErrors?.[f]);
      for (const f of fields) {
        const message = result.fieldErrors?.[f];
        if (message) setError(f, { message }, { shouldFocus: f === firstBad });
      }
    });
  };

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[18px]">
      <PasswordField
        id="password"
        label="New password"
        autoComplete="new-password"
        error={errors.password?.message}
        {...register("password")}
      />

      <StrengthPanel strength={strength} />

      <div className="flex flex-col gap-1.5">
        <PasswordField
          id="confirmPassword"
          label="Confirm new password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          className={matches ? "border-link shadow-[inset_0_0_0_0.5px_var(--color-link)]" : undefined}
          {...register("confirmPassword")}
        />
        {/* Announced politely when it changes (auth-screens.md §6). */}
        <p aria-live="polite" className="flex items-center gap-1.5 text-[13px] font-bold text-link empty:hidden">
          {matches && (
            <>
              <Check aria-hidden="true" className="size-4" strokeWidth={3} />
              Passwords match
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2.5">
        <input
          id="signOutOthers"
          type="checkbox"
          className="size-[22px] shrink-0 accent-green-600 outline-link focus-visible:outline-2 focus-visible:outline-offset-2"
          {...register("signOutOthers")}
        />
        <label htmlFor="signOutOthers" className="text-sm font-semibold text-text-2">
          Log out on other devices
        </label>
      </div>

      <FormError message={formError} />
      <SubmitButton pending={pending} pendingLabel="Saving…">
        Save new password
      </SubmitButton>
    </form>
  );
}

function StrengthPanel({ strength }: { strength: ReturnType<typeof passwordStrength> }) {
  const rules = [
    { text: "At least 8 characters", met: strength.hasMinLength },
    { text: "Includes a number", met: strength.hasNumber },
    // Can't be checked in the browser: only Supabase knows the old password.
    // It stays unticked, and the server shows an error if it's the same.
    { text: "Not the same as your old password", met: null },
  ];

  return (
    <div className="flex flex-col gap-2.5 rounded-md bg-mint px-3.5 py-3">
      <div className="flex justify-between text-[13px] font-extrabold text-secondary-foreground">
        <span>Password strength</span>
        <span>{strength.level ?? "–"}</span>
      </div>
      <div aria-hidden="true" className="flex gap-1">
        {[1, 2, 3, 4].map((segment) => (
          <span
            key={segment}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              strength.level && segment <= strength.score ? "bg-green-500" : "bg-surface",
            )}
          />
        ))}
      </div>
      <ul aria-live="polite" className="flex flex-col gap-1.5">
        {rules.map(({ text, met }) => (
          <li key={text} className="flex items-center gap-2 text-[13px] font-bold text-secondary-foreground">
            <span
              className={cn(
                "flex size-[18px] shrink-0 items-center justify-center rounded-full",
                met ? "bg-green-500 text-white" : "border-2 border-line bg-surface",
              )}
            >
              {met && <Check aria-hidden="true" className="size-3" strokeWidth={3.5} />}
            </span>
            {text}
            {/* Screen readers get the state as words, not just the colour. */}
            {met !== null && <span className="sr-only">{met ? " (done)" : " (not yet)"}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

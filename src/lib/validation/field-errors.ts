// What a form's Server Action returns when it doesn't redirect: errors to show.
// (The auth actions have their own copy from before this file existed.)
export type FormResult<T> = {
  fieldErrors?: Partial<Record<keyof T, string>>;
  formError?: string;
};

export const SOMETHING_WRONG = "Something went wrong on our side. Please try again.";

/** Zod's issues → one message per field (the first one wins). */
export function toFieldErrors<T>(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Partial<Record<keyof T, string>> = {};
  for (const issue of issues) {
    const field = issue.path[0] as keyof T;
    fieldErrors[field] ??= issue.message;
  }
  return fieldErrors;
}

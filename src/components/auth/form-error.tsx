// Error for the whole form (e.g. wrong password), shown above the main button.
// role="alert" makes screen readers announce it as soon as it appears.
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-[12px] bg-bad-bg px-4 py-3 text-sm font-bold text-bad-fg">
      {message}
    </p>
  );
}

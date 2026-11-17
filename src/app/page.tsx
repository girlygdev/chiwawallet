import { Button } from "@/components/ui/button";

// Temporary page to check the theme tokens by eye.
// It is replaced when the real screens are built.
// Class names are written out in full so Tailwind can find them.
const swatches = [
  { name: "green-500", className: "bg-green-500" },
  { name: "green-600", className: "bg-green-600" },
  { name: "green-700", className: "bg-green-700" },
  { name: "green-800", className: "bg-green-800" },
  { name: "gold", className: "bg-gold" },
  { name: "danger", className: "bg-danger" },
  { name: "mint", className: "bg-mint" },
  { name: "surface", className: "bg-surface" },
  { name: "track", className: "bg-track" },
  { name: "needs", className: "bg-needs" },
  { name: "wants", className: "bg-wants" },
  { name: "savings-debt", className: "bg-savings-debt" },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <header>
        <h1 className="font-display text-[28px] leading-[1.1] font-semibold text-ink">
          Chiwa<span className="text-primary">wallet</span>
        </h1>
        <p className="mt-1 font-bold text-text-2">Sit. Stay. Save.</p>
      </header>

      {/* The one sticker element on this page */}
      <section
        aria-label="Sample hero card"
        className="rounded-xl border-2 border-sticker bg-green-700 p-[18px] text-white shadow-sticker"
      >
        <p className="text-[13px] font-extrabold tracking-[0.5px] uppercase">
          Safe to spend
        </p>
        <p className="font-display text-[42px] leading-[1.1] font-semibold">
          ₱12,450
        </p>
        <p className="text-[13px] font-semibold">Sample only · Nov 15 – 29</p>
      </section>

      <Button className="h-12 px-5 text-base font-extrabold">
        Sample button
      </Button>

      <section aria-labelledby="swatches-title">
        <h2
          id="swatches-title"
          className="text-[13px] font-extrabold tracking-[0.5px] text-text-3 uppercase"
        >
          Theme colors
        </h2>
        <ul className="mt-3 grid grid-cols-3 gap-3">
          {swatches.map((swatch) => (
            <li key={swatch.name} className="text-[13px] font-semibold">
              <div
                aria-hidden="true"
                className={`h-12 rounded-md border-[1.5px] border-line ${swatch.className}`}
              />
              {swatch.name}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

// Money is stored and passed around as integer centavos (CLAUDE.md "Money and
// dates"). These two functions are the only places pesos are turned into
// centavos or back, so floating point never touches an amount.

// U+2212, the real minus sign used in the designs ("−₱180").
const MINUS = "−";

const wholePesos = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 });
const pesosWithCentavos = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * "₱12,450", "₱12,450.50", "−₱180". With `signed`, money in shows "+₱25,000".
 * Centavos show only when there are some.
 */
export function formatPeso(centavos: number, { signed = false }: { signed?: boolean } = {}): string {
  if (!Number.isSafeInteger(centavos)) {
    throw new RangeError(`Expected whole centavos, got ${centavos}.`);
  }
  const abs = Math.abs(centavos);
  const pesos = Math.trunc(abs / 100);
  const cents = abs % 100;
  // Integer division above, so the formatter only ever sees exact values.
  const amount = cents === 0 ? wholePesos.format(pesos) : pesosWithCentavos.format(pesos + cents / 100);
  const sign = centavos < 0 ? MINUS : signed && centavos > 0 ? "+" : "";
  return `${sign}₱${amount}`;
}

/**
 * Centavos → the text a money input shows: "25,000", "25,000.50", "-300".
 * No ₱ (the input draws it) and a plain hyphen, so it reads back exactly
 * through parsePesoInput().
 */
export function formatPesoInput(centavos: number): string {
  const text = formatPeso(Math.abs(centavos)).slice(1); // drop the ₱
  return centavos < 0 ? `-${text}` : text;
}

/**
 * What someone typed ("5,000", "₱ 1,200.50", "-300") → integer centavos, or
 * null if it isn't a peso amount. Up to two decimal places. Parsed as text,
 * never through a float, so "0.29" is exactly 29 centavos.
 */
export function parsePesoInput(text: string): number | null {
  const cleaned = text.replace(/[\s,₱]/g, "").replace(MINUS, "-");
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;

  const [, minus, whole, fraction = ""] = match;
  const centavos = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(centavos)) return null;
  // `|| 0` turns -0 into 0.
  return (minus ? -centavos : centavos) || 0;
}

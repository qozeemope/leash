const AMOUNT = /^\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/;

export function formatCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  const dollars = Math.trunc(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const rest = (abs % 100).toString().padStart(2, "0");
  return `${negative ? "-" : ""}$${dollars}.${rest}`;
}

export function dollarsToCents(input: string): number | null {
  const match = AMOUNT.exec(input.trim());
  if (!match) return null;
  const whole = match[1];
  const fraction = match[2] ?? "";
  if (whole === undefined) return null;
  const cents = Number(whole.replace(/,/g, "")) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function formatMoney(cents: number, currency: string): string {
  const code = currency.toUpperCase();
  if (code === "USD") return formatCents(cents);
  return `${formatCents(cents).replace("$", "")} ${code}`;
}

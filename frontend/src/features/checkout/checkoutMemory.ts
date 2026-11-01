export interface CheckoutMemory {
  mandateId: string;
  totalCents: number | null;
}

const PREFIX = "leash.checkout.";

export function orderIdFromApproveUrl(url: string): string | null {
  try {
    const token = new URL(url).searchParams.get("token");
    return token !== null && token !== "" ? token : null;
  } catch {
    return null;
  }
}

export function rememberCheckout(approveUrl: string, memory: CheckoutMemory): void {
  const orderId = orderIdFromApproveUrl(approveUrl);
  if (orderId === null) return;
  try {
    sessionStorage.setItem(`${PREFIX}${orderId}`, JSON.stringify(memory));
  } catch {
    return;
  }
}

export function recallCheckout(orderId: string | null): CheckoutMemory | null {
  if (orderId === null || orderId === "") return null;
  try {
    const raw = sessionStorage.getItem(`${PREFIX}${orderId}`);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { mandateId, totalCents } = parsed as Record<string, unknown>;
    if (typeof mandateId !== "string" || mandateId === "") return null;
    return { mandateId, totalCents: typeof totalCents === "number" ? totalCents : null };
  } catch {
    return null;
  }
}

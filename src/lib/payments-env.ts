export type PaymentsEnv = "sandbox" | "live";

export function normalizePaymentsEnv(value: unknown): PaymentsEnv | null {
  return value === "live" || value === "sandbox" ? value : null;
}

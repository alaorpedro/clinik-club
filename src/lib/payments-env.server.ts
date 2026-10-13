import { getRequest } from "@tanstack/react-start/server";
import { normalizePaymentsEnv, type PaymentsEnv } from "@/lib/payments-env";

// Fica num módulo .server.ts porque getRequest() é import proibido no bundle do
// cliente — exportar isto de um *.functions.ts quebra o `vite build` (import-protection).

function getRequestHost(): string | null {
  try {
    return getRequest()?.headers?.get("host")?.split(":")[0]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

/** Host de produção força "live"; fora dele vale o ambiente pedido, o PAYMENTS_ENV ou o prefixo da chave. */
export function getPaymentsEnv(preferred?: unknown): PaymentsEnv {
  const host = getRequestHost();
  if (
    host === "clinik.club" ||
    host === "www.clinik.club" ||
    host === "kindred-ignite-forge.lovable.app"
  ) {
    return "live";
  }

  const requested = normalizePaymentsEnv(preferred);
  if (requested) return requested;

  const explicit = normalizePaymentsEnv(process.env.PAYMENTS_ENV);
  if (explicit) return explicit;

  const token = process.env.VITE_PAYMENTS_CLIENT_TOKEN;
  if (token?.startsWith("pk_test_")) return "sandbox";
  if (token?.startsWith("pk_live_")) return "live";

  return "sandbox";
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  listAdminPayments,
  resendInvoiceEmail,
  retryInvoicePayment,
  openCustomerPortalAsAdmin,
  type PaymentRow,
} from "@/lib/admin-payments.functions";
import { checkIsAdmin } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Loader2, ShieldCheck, AlertTriangle, CheckCircle2, XCircle, ExternalLink,
  Mail, RefreshCw, CreditCard, Clock, ArrowLeft, Search,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/admin/pagamentos")({
  component: AdminPaymentsPage,
  errorComponent: ({ error, reset }) => (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
      <h2 className="font-bold text-destructive">Erro ao carregar pagamentos</h2>
      <p className="mt-1 text-muted-foreground">{error?.message ?? "Tente novamente."}</p>
      <Button size="sm" variant="outline" className="mt-4 rounded-full" onClick={() => reset()}>
        Tentar novamente
      </Button>
    </div>
  ),
});

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  catch { return iso; }
}
function fmtMoney(n: number, currency: string) {
  try { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency.toUpperCase() }).format(n); }
  catch { return `${n} ${currency.toUpperCase()}`; }
}
function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / 86_400_000);
}

const ISSUE_STATUSES = ["past_due", "unpaid", "incomplete", "incomplete_expired"];

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string; icon: typeof CheckCircle2 }> = {
    active:   { cls: "bg-primary/10 text-primary",       label: "Ativo",       icon: CheckCircle2 },
    trialing: { cls: "bg-blue-100 text-blue-800",        label: "Em teste",    icon: Clock },
    past_due: { cls: "bg-yellow-100 text-yellow-800",    label: "Em atraso",   icon: AlertTriangle },
    unpaid:   { cls: "bg-destructive/10 text-destructive", label: "Não pago",  icon: XCircle },
    incomplete: { cls: "bg-yellow-100 text-yellow-800",  label: "Incompleto",  icon: AlertTriangle },
    incomplete_expired: { cls: "bg-muted text-muted-foreground", label: "Expirado", icon: XCircle },
    canceled: { cls: "bg-muted text-muted-foreground",   label: "Cancelado",   icon: XCircle },
    paused:   { cls: "bg-muted text-muted-foreground",   label: "Pausado",     icon: Clock },
  };
  const m = map[status] ?? { cls: "bg-muted text-muted-foreground", label: status, icon: AlertTriangle };
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${m.cls}`}>
      <Icon className="h-3 w-3" /> {m.label}
    </span>
  );
}

function AdminPaymentsPage() {
  const checkAdminFn = useServerFn(checkIsAdmin);
  const listFn = useServerFn(listAdminPayments);
  const resendFn = useServerFn(resendInvoiceEmail);
  const retryFn = useServerFn(retryInvoicePayment);
  const portalFn = useServerFn(openCustomerPortalAsAdmin);

  const adminQuery = useQuery({
    queryKey: ["admin", "isAdmin"],
    queryFn: () => checkAdminFn(),
    staleTime: 60_000,
  });
  const isAdmin = !!adminQuery.data?.isAdmin;

  const paymentsQuery = useQuery({
    queryKey: ["admin", "payments"],
    queryFn: () => listFn(),
    enabled: isAdmin,
  });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"issues" | "all" | "active" | "expiring" | "canceled">("issues");
  const [actingId, setActingId] = useState<string | null>(null);

  const payments = paymentsQuery.data?.payments ?? [];

  const stats = useMemo(() => {
    let active = 0, issues = 0, expiring = 0, mrr = 0;
    for (const p of payments) {
      if (["active", "trialing"].includes(p.status)) {
        active += 1;
        const d = daysUntil(p.current_period_end);
        if (d !== null && d >= 0 && d <= 7) expiring += 1;
        if (p.latest_invoice?.amount_paid) mrr += p.latest_invoice.amount_paid;
      }
      if (ISSUE_STATUSES.includes(p.status)) issues += 1;
    }
    return { active, issues, expiring, mrr };
  }, [payments]);

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (filter === "issues" && !ISSUE_STATUSES.includes(p.status)) return false;
      if (filter === "active" && !["active", "trialing"].includes(p.status)) return false;
      if (filter === "canceled" && p.status !== "canceled") return false;
      if (filter === "expiring") {
        if (!["active", "trialing"].includes(p.status)) return false;
        const d = daysUntil(p.current_period_end);
        if (d === null || d < 0 || d > 7) return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (p.email ?? "").toLowerCase().includes(q) ||
        (p.name ?? "").toLowerCase().includes(q) ||
        (p.clinic_name ?? "").toLowerCase().includes(q) ||
        p.stripe_customer_id.toLowerCase().includes(q) ||
        p.stripe_subscription_id.toLowerCase().includes(q)
      );
    });
  }, [payments, search, filter]);

  async function handleResend(p: PaymentRow) {
    if (!p.latest_invoice) return;
    setActingId(p.subscription_id);
    try {
      const r = await resendFn({ data: { invoiceId: p.latest_invoice.id, environment: p.environment as "sandbox" | "live" } });
      if ("error" in r) toast.error(r.error); else toast.success(r.message);
    } finally { setActingId(null); }
  }
  async function handleRetry(p: PaymentRow) {
    if (!p.latest_invoice) return;
    if (!confirm("Tentar cobrar essa fatura agora?")) return;
    setActingId(p.subscription_id);
    try {
      const r = await retryFn({ data: { invoiceId: p.latest_invoice.id, environment: p.environment as "sandbox" | "live" } });
      if ("error" in r) toast.error(r.error); else { toast.success(r.message); paymentsQuery.refetch(); }
    } finally { setActingId(null); }
  }
  async function handlePortal(p: PaymentRow) {
    setActingId(p.subscription_id);
    try {
      const r = await portalFn({ data: { customerId: p.stripe_customer_id, environment: p.environment as "sandbox" | "live", returnUrl: window.location.href } });
      if ("error" in r) toast.error(r.error);
      else window.open(r.url, "_blank");
    } finally { setActingId(null); }
  }

  if (adminQuery.isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-xl font-bold">Acesso restrito</h1>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2">
        <Link to="/app/admin" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Administração
        </Link>
      </div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <CreditCard className="h-7 w-7 text-primary" /> Pagamentos
          </h1>
          <p className="text-muted-foreground mt-1">Assinaturas, falhas de cobrança e ações rápidas.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => paymentsQuery.refetch()} disabled={paymentsQuery.isFetching}>
          {paymentsQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat icon={CheckCircle2} label="Ativos" value={String(stats.active)} accent="text-primary" />
        <Stat icon={AlertTriangle} label="Com problema" value={String(stats.issues)} accent={stats.issues > 0 ? "text-destructive" : "text-muted-foreground"} />
        <Stat icon={Clock} label="Vencem em 7d" value={String(stats.expiring)} accent={stats.expiring > 0 ? "text-yellow-700" : "text-muted-foreground"} />
        <Stat icon={CreditCard} label="Último ciclo (R$)" value={fmtMoney(stats.mrr, "BRL")} />
      </div>

      <Card className="mb-6">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por email, nome, clínica, cus_ ou sub_..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {[
              { k: "issues", l: "Problemas" },
              { k: "expiring", l: "Vencendo" },
              { k: "active", l: "Ativos" },
              { k: "canceled", l: "Cancelados" },
              { k: "all", l: "Todos" },
            ].map((f) => (
              <Button
                key={f.k}
                variant={filter === f.k ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(f.k as typeof filter)}
                className="rounded-full"
              >
                {f.l}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {paymentsQuery.isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : paymentsQuery.error ? (
        <div className="text-sm text-destructive">Erro: {(paymentsQuery.error as Error).message}</div>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Próx. cobrança</TableHead>
                  <TableHead>Última fatura</TableHead>
                  <TableHead>Ambiente</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      Nenhuma assinatura nesse filtro.
                    </TableCell>
                  </TableRow>
                ) : filtered.map((p) => {
                  const dleft = daysUntil(p.current_period_end);
                  const inv = p.latest_invoice;
                  const isIssue = ISSUE_STATUSES.includes(p.status);
                  const acting = actingId === p.subscription_id;
                  return (
                    <TableRow key={p.subscription_id} className={isIssue ? "bg-destructive/5" : undefined}>
                      <TableCell>
                        <div className="font-semibold">{p.name ?? p.clinic_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{p.email ?? "—"}</div>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{p.price_id ?? "—"}</TableCell>
                      <TableCell>
                        <StatusPill status={p.status} />
                        {p.cancel_at_period_end && (
                          <div className="text-[10px] text-yellow-700 mt-0.5">Cancelará ao fim</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{fmtDate(p.current_period_end)}</div>
                        {dleft !== null && (
                          <div className={`text-xs ${dleft < 0 ? "text-destructive" : dleft <= 7 ? "text-yellow-700" : "text-muted-foreground"}`}>
                            {dleft < 0 ? `há ${-dleft}d` : dleft === 0 ? "hoje" : `em ${dleft}d`}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {inv ? (
                          <div>
                            <div className="text-sm font-medium">{fmtMoney(inv.amount_due || inv.amount_paid, inv.currency)}</div>
                            <div className="text-xs text-muted-foreground">
                              {inv.status} · {fmtDate(inv.created)}
                              {inv.attempt_count > 0 && ` · ${inv.attempt_count} tentativa(s)`}
                            </div>
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${p.environment === "live" ? "bg-primary/10 text-primary" : "bg-yellow-100 text-yellow-800"}`}>
                          {p.environment}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          {inv?.hosted_invoice_url && (
                            <Button asChild size="sm" variant="ghost" title="Abrir fatura">
                              <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          )}
                          {inv && isIssue && (
                            <>
                              <Button size="sm" variant="outline" disabled={acting} onClick={() => handleResend(p)} title="Reenviar email da fatura">
                                {acting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                              </Button>
                              <Button size="sm" variant="outline" disabled={acting} onClick={() => handleRetry(p)} title="Tentar cobrar agora">
                                {acting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="ghost" disabled={acting} onClick={() => handlePortal(p)} title="Abrir portal do cliente">
                            {acting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: typeof CheckCircle2; label: string; value: string; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className={`h-4 w-4 ${accent ?? ""}`} /> {label}
        </div>
        <div className={`mt-1 text-2xl font-black tabular-nums ${accent ?? ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
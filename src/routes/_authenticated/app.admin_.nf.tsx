import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  listConfirmedPayments,
  setPaymentNfIssued,
  saveBillingProfile,
  type ConfirmedPaymentRow,
} from "@/lib/admin-payments.functions";
import { checkIsAdmin } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Loader2, ShieldCheck, CheckCircle2, ExternalLink, RefreshCw,
  ArrowLeft, Search, ReceiptText, Undo2, FileCheck2, FileClock,
  Pencil, AlertTriangle, Copy,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/admin_/nf")({
  component: AdminNfPage,
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

const METHOD_LABEL: Record<string, string> = {
  card: "Cartão",
  boleto: "Boleto",
  pix: "Pix",
};

function AdminNfPage() {
  const checkAdminFn = useServerFn(checkIsAdmin);
  const listFn = useServerFn(listConfirmedPayments);
  const setNfFn = useServerFn(setPaymentNfIssued);

  const adminQuery = useQuery({
    queryKey: ["admin", "isAdmin"],
    queryFn: () => checkAdminFn(),
    staleTime: 60_000,
  });
  const isAdmin = !!adminQuery.data?.isAdmin;

  const paymentsQuery = useQuery({
    queryKey: ["admin", "confirmedPayments"],
    queryFn: () => listFn(),
    enabled: isAdmin,
  });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"pending" | "issued" | "refunded" | "all">("pending");
  const [actingId, setActingId] = useState<string | null>(null);
  const [billingTarget, setBillingTarget] = useState<ConfirmedPaymentRow | null>(null);

  const payments = paymentsQuery.data?.payments ?? [];

  const stats = useMemo(() => {
    let confirmed = 0, pending = 0, issued = 0, total = 0;
    for (const p of payments) {
      if (p.refunded) continue;
      confirmed += 1;
      total += p.amount - p.amount_refunded;
      if (p.nf_issued) issued += 1; else pending += 1;
    }
    return { confirmed, pending, issued, total };
  }, [payments]);

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (filter === "pending" && (p.nf_issued || p.refunded)) return false;
      if (filter === "issued" && !p.nf_issued) return false;
      if (filter === "refunded" && !p.refunded) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (p.customer_email ?? "").toLowerCase().includes(q) ||
        (p.customer_name ?? "").toLowerCase().includes(q) ||
        (p.clinic_name ?? "").toLowerCase().includes(q) ||
        (p.billing.tax_id ?? "").toLowerCase().includes(q) ||
        (p.billing.legal_name ?? "").toLowerCase().includes(q) ||
        p.payment_id.toLowerCase().includes(q) ||
        (p.stripe_customer_id ?? "").toLowerCase().includes(q)
      );
    });
  }, [payments, search, filter]);

  function copyBillingInfo(p: ConfirmedPaymentRow) {
    const b = p.billing;
    const lines = [
      `Razão social / Nome: ${b.legal_name ?? p.customer_name ?? p.clinic_name ?? "—"}`,
      `CNPJ/CPF: ${b.tax_id ?? "—"}`,
      `Endereço: ${b.address_line ?? "—"}`,
      `Cidade/UF: ${[b.city, b.state].filter(Boolean).join("/") || "—"}`,
      `CEP: ${b.postal_code ?? "—"}`,
      `E-mail: ${b.email ?? p.customer_email ?? "—"}`,
      `Valor: ${fmtMoney(p.amount, p.currency)} (pago em ${fmtDate(p.paid_at)})`,
      `Pagamento: ${p.payment_id}`,
    ];
    navigator.clipboard
      .writeText(lines.join("\n"))
      .then(() => toast.success("Dados copiados."))
      .catch(() => toast.error("Não foi possível copiar."));
  }

  async function handleToggleNf(p: ConfirmedPaymentRow, issued: boolean) {
    setActingId(p.payment_id);
    try {
      const r = await setNfFn({ data: { paymentId: p.payment_id, environment: p.environment as "sandbox" | "live", issued } });
      if ("error" in r) toast.error(r.error);
      else {
        toast.success(r.message);
        await paymentsQuery.refetch();
      }
    } finally {
      setActingId(null);
    }
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
            <ReceiptText className="h-7 w-7 text-primary" /> Notas fiscais
          </h1>
          <p className="text-muted-foreground mt-1">Pagamentos confirmados no Stripe e controle manual de emissão de NF.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => paymentsQuery.refetch()} disabled={paymentsQuery.isFetching}>
          {paymentsQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat icon={CheckCircle2} label="Pagamentos confirmados" value={String(stats.confirmed)} accent="text-primary" />
        <Stat icon={FileClock} label="NF pendente" value={String(stats.pending)} accent={stats.pending > 0 ? "text-yellow-700" : "text-muted-foreground"} />
        <Stat icon={FileCheck2} label="NF emitida" value={String(stats.issued)} accent="text-primary" />
        <Stat icon={ReceiptText} label="Total pago (R$)" value={fmtMoney(stats.total, "BRL")} />
      </div>

      <Card className="mb-6">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por email, nome, clínica, ch_ ou cus_..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {[
              { k: "pending", l: "NF pendente" },
              { k: "issued", l: "NF emitida" },
              { k: "refunded", l: "Reembolsados" },
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
                  <TableHead>Valor</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Ambiente</TableHead>
                  <TableHead>Recibo</TableHead>
                  <TableHead className="text-right">NF emitida</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                      Nenhum pagamento nesse filtro.
                    </TableCell>
                  </TableRow>
                ) : filtered.map((p) => {
                  const acting = actingId === p.payment_id;
                  return (
                    <TableRow key={p.payment_id} className={p.refunded ? "opacity-60" : undefined}>
                      <TableCell>
                        <div className="font-semibold">{p.customer_name ?? p.clinic_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.customer_email ?? "—"}
                          {p.clinic_name && p.customer_name ? ` · ${p.clinic_name}` : ""}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          {p.billing.tax_id ? (
                            <span className="text-xs font-medium tabular-nums">{p.billing.tax_id}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 text-yellow-800 px-2 py-0.5 text-[10px] font-semibold">
                              <AlertTriangle className="h-3 w-3" /> sem CNPJ
                            </span>
                          )}
                          {(p.billing.city || p.billing.state) && (
                            <span className="text-[11px] text-muted-foreground">
                              {[p.billing.city, p.billing.state].filter(Boolean).join("/")}
                            </span>
                          )}
                          {p.stripe_customer_id && (
                            <button
                              type="button"
                              className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                              onClick={() => setBillingTarget(p)}
                              title="Editar dados para emissão da NF"
                            >
                              <Pencil className="h-3 w-3" /> dados NF
                            </button>
                          )}
                          <button
                            type="button"
                            className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                            onClick={() => copyBillingInfo(p)}
                            title="Copiar dados para emissão"
                          >
                            <Copy className="h-3 w-3" /> copiar
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium tabular-nums">{fmtMoney(p.amount, p.currency)}</div>
                        {p.amount_refunded > 0 && (
                          <div className="text-xs text-destructive">−{fmtMoney(p.amount_refunded, p.currency)} reembolsado</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {p.refunded ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-xs font-semibold">
                            <Undo2 className="h-3 w-3" /> Reembolsado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-semibold">
                            <CheckCircle2 className="h-3 w-3" /> Pago
                          </span>
                        )}
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {fmtDate(p.paid_at)}
                          {p.payment_method ? ` · ${METHOD_LABEL[p.payment_method] ?? p.payment_method}` : ""}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${p.environment === "live" ? "bg-primary/10 text-primary" : "bg-yellow-100 text-yellow-800"}`}>
                          {p.environment}
                        </span>
                      </TableCell>
                      <TableCell>
                        {p.receipt_url ? (
                          <Button asChild size="sm" variant="ghost" title="Abrir recibo">
                            <a href={p.receipt_url} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {p.nf_issued && (
                            <span className="text-[10px] text-muted-foreground">{fmtDate(p.nf_issued_at)}</span>
                          )}
                          {acting ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            <Checkbox
                              checked={p.nf_issued}
                              onCheckedChange={(checked) => handleToggleNf(p, checked === true)}
                              aria-label={p.nf_issued ? "Desmarcar NF emitida" : "Marcar NF como emitida"}
                            />
                          )}
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

      {billingTarget && (
        <BillingDialog
          key={billingTarget.stripe_customer_id ?? billingTarget.payment_id}
          payment={billingTarget}
          onClose={() => setBillingTarget(null)}
          onSaved={() => {
            setBillingTarget(null);
            paymentsQuery.refetch();
          }}
        />
      )}
    </div>
  );
}

function BillingDialog({
  payment,
  onClose,
  onSaved,
}: {
  payment: ConfirmedPaymentRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const saveFn = useServerFn(saveBillingProfile);
  const b = payment.billing;
  const [legalName, setLegalName] = useState(b.legal_name ?? payment.customer_name ?? "");
  const [taxId, setTaxId] = useState(b.tax_id ?? "");
  const [addressLine, setAddressLine] = useState(b.address_line ?? "");
  const [city, setCity] = useState(b.city ?? "");
  const [uf, setUf] = useState(b.state ?? "");
  const [postalCode, setPostalCode] = useState(b.postal_code ?? "");
  const [email, setEmail] = useState(b.email ?? payment.customer_email ?? "");
  const [notes, setNotes] = useState(b.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!payment.stripe_customer_id) return;
    setSaving(true);
    try {
      const r = await saveFn({
        data: {
          customerId: payment.stripe_customer_id,
          legal_name: legalName,
          tax_id: taxId,
          address_line: addressLine,
          city,
          state: uf,
          postal_code: postalCode,
          email,
          notes,
        },
      });
      if ("error" in r) toast.error(r.error);
      else {
        toast.success(r.message);
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Dados para emissão da NF</DialogTitle>
          <DialogDescription>
            {payment.customer_name ?? payment.clinic_name ?? payment.customer_email ?? payment.stripe_customer_id}
            {" · "}vale para todos os pagamentos deste cliente.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Razão social / Nome" value={legalName} onChange={setLegalName} />
          <Field label="CNPJ / CPF" value={taxId} onChange={setTaxId} placeholder="00.000.000/0000-00" />
          <Field label="Endereço" value={addressLine} onChange={setAddressLine} placeholder="Rua, número, complemento" />
          <div className="grid grid-cols-[1fr_80px_110px] gap-3">
            <Field label="Cidade" value={city} onChange={setCity} />
            <Field label="UF" value={uf} onChange={setUf} placeholder="PR" />
            <Field label="CEP" value={postalCode} onChange={setPostalCode} placeholder="00000-000" />
          </div>
          <Field label="E-mail para envio" value={email} onChange={setEmail} />
          <Field label="Observações" value={notes} onChange={setNotes} placeholder="Opcional" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !payment.stripe_customer_id}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
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

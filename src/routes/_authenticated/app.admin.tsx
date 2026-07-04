import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { checkIsAdmin, deleteAdminCustomerAccount, listAdminCustomers, type AdminCustomerRow } from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Activity, AlertCircle, BarChart3, CheckCircle2, ChevronDown, CreditCard, FileSpreadsheet, Loader2, Search, ShieldCheck, Trash2, Users, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/admin")({
  component: AdminPage,
});

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / (1000 * 60 * 60 * 24));
}

function StatusBadge({ row }: { row: AdminCustomerRow }) {
  const s = row.subscription;
  if (!s) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium">
        <XCircle className="h-3 w-3" /> Sem plano
      </span>
    );
  }
  const active = ["active", "trialing"].includes(s.status);
  const warning = ["past_due", "unpaid", "incomplete"].includes(s.status);
  if (active) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-semibold">
        <CheckCircle2 className="h-3 w-3" /> {s.status === "trialing" ? "Em teste" : "Ativo"}
      </span>
    );
  }
  if (warning) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 text-yellow-800 px-2 py-0.5 text-xs font-semibold">
        <AlertCircle className="h-3 w-3" /> {s.status}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-xs font-semibold">
      <XCircle className="h-3 w-3" /> {s.status}
    </span>
  );
}

function AdminPage() {
  const checkAdminFn = useServerFn(checkIsAdmin);
  const listFn = useServerFn(listAdminCustomers);
  const deleteCustomerFn = useServerFn(deleteAdminCustomerAccount);

  const adminQuery = useQuery({
    queryKey: ["admin", "isAdmin"],
    queryFn: () => checkAdminFn(),
    staleTime: 60_000,
  });

  const isAdmin = !!adminQuery.data?.isAdmin;

  const customersQuery = useQuery({
    queryKey: ["admin", "customers"],
    queryFn: () => listFn(),
    enabled: isAdmin,
  });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "issues" | "none">("all");
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminCustomerRow | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState(false);

  const customers = customersQuery.data?.customers ?? [];

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      if (filter === "active") {
        if (!c.subscription || !["active", "trialing"].includes(c.subscription.status)) return false;
      } else if (filter === "issues") {
        if (!c.subscription || !["past_due", "unpaid", "incomplete", "canceled"].includes(c.subscription.status)) return false;
      } else if (filter === "none") {
        if (c.subscription) return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.name ?? "").toLowerCase().includes(q) ||
        (c.clinic_name ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q) ||
        (c.subscription?.stripe_customer_id ?? "").toLowerCase().includes(q)
      );
    });
  }, [customers, search, filter]);

  const stats = useMemo(() => {
    const total = customers.length;
    let active = 0;
    let issues = 0;
    let none = 0;
    let expiringSoon = 0;
    let totalFunnels = 0;
    let activeFunnels = 0;
    let totalLeads = 0;
    let completedLeads = 0;
    let partialLeads = 0;
    let connectedSheets = 0;
    for (const c of customers) {
      totalFunnels += c.funnels_count;
      activeFunnels += c.active_funnels_count;
      totalLeads += c.leads_count;
      completedLeads += c.completed_leads_count;
      partialLeads += c.partial_leads_count;
      connectedSheets += c.connected_sheets_count;
      const s = c.subscription;
      if (!s) {
        none += 1;
        continue;
      }
      if (["active", "trialing"].includes(s.status)) {
        active += 1;
        const d = daysUntil(s.current_period_end);
        if (d !== null && d <= 7 && d >= 0) expiringSoon += 1;
      } else if (["past_due", "unpaid", "incomplete", "canceled"].includes(s.status)) {
        issues += 1;
      }
    }
    return { total, active, issues, none, expiringSoon, totalFunnels, activeFunnels, totalLeads, completedLeads, partialLeads, connectedSheets };
  }, [customers]);

  async function deleteCustomer() {
    if (!deleteTarget) return;
    setDeletingCustomer(true);
    try {
      const result = await deleteCustomerFn({ data: { userId: deleteTarget.user_id } });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Conta excluída com sucesso.");
      setDeleteTarget(null);
      setExpandedCustomer(null);
      await customersQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir conta.");
    } finally {
      setDeletingCustomer(false);
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
        <p className="mt-2 text-sm text-muted-foreground">Esta área é exclusiva para administradores.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-primary" /> Administração
          </h1>
          <p className="text-muted-foreground mt-1">Clientes, planos, funis, leads e sinais de uso.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => customersQuery.refetch()} disabled={customersQuery.isFetching}>
          {customersQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}
        </Button>
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="default" className="rounded-full">
          <Link to="/app/admin/pagamentos"><CreditCard className="h-4 w-4 mr-1.5" /> Pagamentos & assinaturas</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
        <StatCard icon={Users} label="Total" value={stats.total} />
        <StatCard icon={CheckCircle2} label="Ativos" value={stats.active} accent="text-primary" />
        <StatCard icon={AlertCircle} label="Problemas" value={stats.issues} accent="text-yellow-700" />
        <StatCard icon={XCircle} label="Sem plano" value={stats.none} accent="text-muted-foreground" />
        <StatCard icon={CreditCard} label="Vence em 7d" value={stats.expiringSoon} accent="text-destructive" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard icon={BarChart3} label="Funis ativos" value={stats.activeFunnels} hint={`${stats.totalFunnels} no total`} accent="text-primary" />
        <StatCard icon={Activity} label="Leads totais" value={stats.totalLeads} hint={`${stats.completedLeads} completos`} />
        <StatCard icon={CheckCircle2} label="Completos" value={stats.completedLeads} accent="text-primary" />
        <StatCard icon={AlertCircle} label="Parciais" value={stats.partialLeads} accent="text-yellow-700" />
        <StatCard icon={FileSpreadsheet} label="Planilhas" value={stats.connectedSheets} hint="funis conectados" />
      </div>

      <Card className="mb-6">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por e-mail, nome, clínica, telefone ou cust_id..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {[
              { k: "all", l: "Todos" },
              { k: "active", l: "Ativos" },
              { k: "issues", l: "Problemas" },
              { k: "none", l: "Sem plano" },
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

      {customersQuery.isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : customersQuery.error ? (
        <div className="text-sm text-destructive">Erro ao carregar: {(customersQuery.error as Error).message}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum cliente encontrado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((customer) => (
            <CustomerCard
              key={customer.user_id}
              customer={customer}
              expanded={expandedCustomer === customer.user_id}
              onToggle={() => setExpandedCustomer(expandedCustomer === customer.user_id ? null : customer.user_id)}
              onDelete={() => setDeleteTarget(customer)}
            />
          ))}
        </div>
      )}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && !deletingCustomer && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta do cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação cancela assinaturas ativas, remove o acesso do cliente e exclui os dados vinculados à conta no sistema.
              Não é possível desfazer. Cliente: <strong>{deleteTarget?.email ?? deleteTarget?.name ?? deleteTarget?.clinic_name ?? "sem identificação"}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingCustomer}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingCustomer}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                deleteCustomer();
              }}
            >
              {deletingCustomer ? "Excluindo..." : "Excluir conta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CustomerCard({
  customer,
  expanded,
  onToggle,
  onDelete,
}: {
  customer: AdminCustomerRow;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const dleft = daysUntil(customer.subscription?.current_period_end ?? null);
  const plan = customer.subscription?.price_id ?? customer.plan ?? "free";
  const title = customer.name ?? customer.clinic_name ?? customer.email ?? "Cliente sem nome";

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(240px,1.35fr)_minmax(360px,2fr)_auto] lg:items-start">
          <div className="min-w-0">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-black text-primary">
                {title.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-black">{title}</div>
                {customer.clinic_name && customer.name && (
                  <div className="truncate text-xs text-muted-foreground">{customer.clinic_name}</div>
                )}
                <div className="mt-1 truncate text-sm text-muted-foreground">{customer.email ?? "Sem e-mail"}</div>
                {customer.phone && <div className="text-xs text-muted-foreground">{customer.phone}</div>}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge row={customer} />
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{plan}</span>
              {customer.subscription && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${customer.subscription.environment === "live" ? "bg-primary/10 text-primary" : "bg-yellow-100 text-yellow-800"}`}>
                  {customer.subscription.environment}
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniMetric label="Funis ativos" value={`${customer.active_funnels_count}/${customer.funnels_count}`} hint={`${customer.draft_funnels_count} rascunhos`} />
            <MiniMetric label="Leads" value={customer.leads_count.toLocaleString("pt-BR")} hint={`${customer.completed_leads_count} comp. · ${customer.partial_leads_count} parc.`} />
            <MiniMetric label="Último lead" value={fmtDateTime(customer.last_lead_at)} />
            <MiniMetric label="Planilhas" value={`${customer.connected_sheets_count}/${customer.funnels_count}`} hint="funis conectados" />
          </div>

          <div className="flex items-center justify-between gap-2 lg:flex-col lg:items-end">
            <div className="text-left text-xs text-muted-foreground lg:text-right">
              <div>Cadastro: <span className="font-medium text-foreground">{fmtDate(customer.created_at)}</span></div>
              <div>Último acesso: <span className="font-medium text-foreground">{fmtDateTime(customer.last_sign_in_at)}</span></div>
              {customer.subscription && (
                <div>
                  Vencimento: <span className="font-medium text-foreground">{fmtDate(customer.subscription.current_period_end)}</span>
                  {dleft !== null && (
                    <span className={`ml-1 ${dleft < 0 ? "text-destructive" : dleft <= 7 ? "text-yellow-700" : ""}`}>
                      ({dleft < 0 ? `${-dleft}d vencido` : dleft === 0 ? "hoje" : `${dleft}d`})
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="rounded-full" onClick={onToggle}>
                <ChevronDown className={`mr-1 h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
                {expanded ? "Ocultar" : "Detalhes"}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={onDelete}
                title="Excluir conta"
                aria-label="Excluir conta"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {expanded && (
          <div className="border-t border-border bg-muted/25 p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <DetailStat label="Funis publicados" value={`${customer.active_funnels_count}/${customer.funnels_count}`} />
              <DetailStat label="Leads completos" value={customer.completed_leads_count.toLocaleString("pt-BR")} />
              <DetailStat label="Leads parciais" value={customer.partial_leads_count.toLocaleString("pt-BR")} />
              <DetailStat label="Último lead" value={fmtDateTime(customer.last_lead_at)} />
            </div>
            <div className="mt-4 overflow-hidden rounded-lg border border-border bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funil</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Completos</TableHead>
                    <TableHead className="text-right">Parciais</TableHead>
                    <TableHead>Último lead</TableHead>
                    <TableHead>Planilha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.funnels.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                        Cliente ainda não criou funis.
                      </TableCell>
                    </TableRow>
                  ) : (
                    customer.funnels.map((funnel) => (
                      <TableRow key={funnel.id}>
                        <TableCell>
                          <div className="font-medium">{funnel.name ?? "Sem nome"}</div>
                          <div className="text-xs text-muted-foreground">/{funnel.slug ?? "sem-slug"} · criado em {fmtDate(funnel.created_at)}</div>
                        </TableCell>
                        <TableCell>
                          <span className={`rounded-full px-2 py-0.5 text-xs ${funnel.status === "published" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                            {funnel.status === "published" ? "Publicado" : funnel.status ?? "Rascunho"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{funnel.leads_count}</TableCell>
                        <TableCell className="text-right tabular-nums">{funnel.completed_leads_count}</TableCell>
                        <TableCell className="text-right tabular-nums">{funnel.partial_leads_count}</TableCell>
                        <TableCell className="text-sm">{fmtDateTime(funnel.last_lead_at)}</TableCell>
                        <TableCell>
                          <span className={`rounded-full px-2 py-0.5 text-xs ${funnel.sheets_connected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                            {funnel.sheets_connected ? "Conectada" : "Não conectada"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({ icon: Icon, label, value, hint, accent }: { icon: typeof Users; label: string; value: number; hint?: string; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className={`h-4 w-4 ${accent ?? ""}`} />
          {label}
        </div>
        <div className={`mt-1 text-2xl font-black tabular-nums ${accent ?? ""}`}>{value}</div>
        {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/70 p-3">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 min-h-6 text-base font-black tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-black tabular-nums">{value}</div>
    </div>
  );
}

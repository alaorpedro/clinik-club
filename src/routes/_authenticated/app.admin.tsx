import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listAdminCustomers, checkIsAdmin, type AdminCustomerRow } from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Search, ShieldCheck, Users, CreditCard, AlertCircle, CheckCircle2, XCircle } from "lucide-react";

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
    for (const c of customers) {
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
    return { total, active, issues, none, expiringSoon };
  }, [customers]);

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
          <p className="text-muted-foreground mt-1">Clientes, planos e assinaturas.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => customersQuery.refetch()} disabled={customersQuery.isFetching}>
          {customersQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard icon={Users} label="Total" value={stats.total} />
        <StatCard icon={CheckCircle2} label="Ativos" value={stats.active} accent="text-primary" />
        <StatCard icon={AlertCircle} label="Problemas" value={stats.issues} accent="text-yellow-700" />
        <StatCard icon={XCircle} label="Sem plano" value={stats.none} accent="text-muted-foreground" />
        <StatCard icon={CreditCard} label="Vence em 7d" value={stats.expiringSoon} accent="text-destructive" />
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
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Último acesso</TableHead>
                  <TableHead className="text-right">Funis</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead>Ambiente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-10">
                      Nenhum cliente encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => {
                    const dleft = daysUntil(c.subscription?.current_period_end ?? null);
                    return (
                      <TableRow key={c.user_id}>
                        <TableCell>
                          <div className="font-semibold">{c.name ?? c.clinic_name ?? "—"}</div>
                          {c.clinic_name && c.name && (
                            <div className="text-xs text-muted-foreground">{c.clinic_name}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{c.email ?? "—"}</div>
                          {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">{c.subscription?.price_id ?? c.plan ?? "free"}</span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge row={c} />
                          {c.subscription?.cancel_at_period_end && (
                            <div className="text-[10px] text-yellow-700 mt-0.5">Cancelará no fim do período</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{fmtDate(c.subscription?.current_period_end ?? null)}</div>
                          {dleft !== null && c.subscription && ["active", "trialing", "canceled"].includes(c.subscription.status) && (
                            <div className={`text-xs ${dleft < 0 ? "text-destructive" : dleft <= 7 ? "text-yellow-700" : "text-muted-foreground"}`}>
                              {dleft < 0 ? `Venceu há ${-dleft}d` : dleft === 0 ? "Vence hoje" : `Em ${dleft}d`}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{fmtDate(c.created_at)}</TableCell>
                        <TableCell className="text-sm">{fmtDateTime(c.last_sign_in_at)}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.funnels_count}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.leads_count}</TableCell>
                        <TableCell>
                          {c.subscription ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${c.subscription.environment === "live" ? "bg-primary/10 text-primary" : "bg-yellow-100 text-yellow-800"}`}>
                              {c.subscription.environment}
                            </span>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: typeof Users; label: string; value: number; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className={`h-4 w-4 ${accent ?? ""}`} />
          {label}
        </div>
        <div className={`mt-1 text-2xl font-black tabular-nums ${accent ?? ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
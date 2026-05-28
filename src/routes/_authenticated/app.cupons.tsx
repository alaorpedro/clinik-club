import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listCoupons, createCoupon, setCouponActive, type CouponRow } from "@/lib/coupons.functions";
import { checkIsAdmin } from "@/lib/admin.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tag, Loader2, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/cupons")({
  component: CouponsPage,
});

function fmtDiscount(c: CouponRow): string {
  if (c.percent_off) return `${c.percent_off}%`;
  if (c.amount_off) {
    const v = (c.amount_off / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: (c.currency ?? "brl").toUpperCase(),
    });
    return v;
  }
  return "—";
}

function fmtDuration(c: CouponRow): string {
  if (c.duration === "once") return "1ª cobrança";
  if (c.duration === "forever") return "Sempre";
  if (c.duration === "repeating") return `${c.duration_in_months ?? "?"} meses`;
  return c.duration;
}

function fmtUnix(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("pt-BR");
}

function CouponsPage() {
  const env = getStripeEnvironment();
  const checkAdminFn = useServerFn(checkIsAdmin);
  const listFn = useServerFn(listCoupons);
  const createFn = useServerFn(createCoupon);
  const setActiveFn = useServerFn(setCouponActive);
  const qc = useQueryClient();

  const adminQuery = useQuery({ queryKey: ["admin", "isAdmin"], queryFn: () => checkAdminFn(), staleTime: 60_000 });
  const isAdmin = !!adminQuery.data?.isAdmin;

  const couponsQuery = useQuery({
    queryKey: ["coupons", env],
    queryFn: async () => {
      const r = await listFn({ data: { environment: env } });
      if ("error" in r) throw new Error(r.error);
      return r.coupons;
    },
    enabled: isAdmin,
  });

  const [open, setOpen] = useState(false);

  const toggleMutation = useMutation({
    mutationFn: async (vars: { id: string; active: boolean }) => {
      const r = await setActiveFn({ data: { environment: env, promotionCodeId: vars.id, active: vars.active } });
      if ("error" in r) throw new Error(r.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coupons", env] });
      toast.success("Cupom atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

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

  const coupons = couponsQuery.data ?? [];

  return (
    <div>
      <div className="mb-8 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <Tag className="h-7 w-7 text-primary" /> Cupons de desconto
          </h1>
          <p className="text-muted-foreground mt-1">
            Crie e gerencie códigos promocionais aplicáveis no checkout. Ambiente: <strong>{env}</strong>.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="rounded-full font-semibold">
          <Plus className="h-4 w-4" /> Novo cupom
        </Button>
      </div>

      {couponsQuery.isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : couponsQuery.error ? (
        <div className="text-sm text-destructive">Erro: {(couponsQuery.error as Error).message}</div>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Usos</TableHead>
                  <TableHead>Limite</TableHead>
                  <TableHead>Expira</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                      Nenhum cupom cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  coupons.map((c) => (
                    <TableRow key={c.promotion_code_id}>
                      <TableCell className="font-mono font-semibold">{c.code}</TableCell>
                      <TableCell>{fmtDiscount(c)}</TableCell>
                      <TableCell>{fmtDuration(c)}</TableCell>
                      <TableCell className="tabular-nums">{c.times_redeemed}</TableCell>
                      <TableCell className="tabular-nums">{c.max_redemptions ?? "∞"}</TableCell>
                      <TableCell>{fmtUnix(c.expires_at)}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${c.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                          {c.active ? "Ativo" : "Inativo"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={toggleMutation.isPending}
                          onClick={() => toggleMutation.mutate({ id: c.promotion_code_id, active: !c.active })}
                        >
                          {c.active ? "Desativar" : "Ativar"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <CreateCouponDialog
        open={open}
        onOpenChange={setOpen}
        onCreate={async (input) => {
          const r = await createFn({ data: { environment: env, ...input } });
          if ("error" in r) throw new Error(r.error);
          await qc.invalidateQueries({ queryKey: ["coupons", env] });
          toast.success(`Cupom ${r.code} criado!`);
        }}
      />
    </div>
  );
}

type CreateInput = {
  code: string;
  discountType: "percent" | "amount";
  percentOff?: number;
  amountOffCents?: number;
  currency?: string;
  duration: "once" | "forever" | "repeating";
  durationInMonths?: number;
  maxRedemptions?: number;
  expiresAt?: number;
};

function CreateCouponDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (input: CreateInput) => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [percentOff, setPercentOff] = useState("20");
  const [amountOff, setAmountOff] = useState("50");
  const [duration, setDuration] = useState<"once" | "forever" | "repeating">("once");
  const [durationMonths, setDurationMonths] = useState("3");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setCode(""); setPercentOff("20"); setAmountOff("50");
    setDiscountType("percent"); setDuration("once"); setDurationMonths("3");
    setMaxRedemptions(""); setExpiresAt("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onCreate({
        code: code.trim().toUpperCase(),
        discountType,
        ...(discountType === "percent"
          ? { percentOff: Number(percentOff) }
          : { amountOffCents: Math.round(Number(amountOff) * 100), currency: "brl" }),
        duration,
        ...(duration === "repeating" && { durationInMonths: Number(durationMonths) }),
        ...(maxRedemptions && { maxRedemptions: Number(maxRedemptions) }),
        ...(expiresAt && { expiresAt: Math.floor(new Date(expiresAt).getTime() / 1000) }),
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar cupom");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo cupom de desconto</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="code">Código *</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="BLACKFRIDAY"
              className="mt-1.5 font-mono uppercase"
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">A-Z, 0-9, _ e -. O cliente digitará esse código no checkout.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo de desconto</Label>
              <Select value={discountType} onValueChange={(v) => setDiscountType(v as "percent" | "amount")}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentual (%)</SelectItem>
                  <SelectItem value="amount">Valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              {discountType === "percent" ? (
                <>
                  <Label htmlFor="pct">Percentual *</Label>
                  <Input id="pct" type="number" min={1} max={100} value={percentOff} onChange={(e) => setPercentOff(e.target.value)} className="mt-1.5" required />
                </>
              ) : (
                <>
                  <Label htmlFor="amt">Valor em R$ *</Label>
                  <Input id="amt" type="number" min={0.5} step={0.01} value={amountOff} onChange={(e) => setAmountOff(e.target.value)} className="mt-1.5" required />
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Aplicar em</Label>
              <Select value={duration} onValueChange={(v) => setDuration(v as "once" | "forever" | "repeating")}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">Apenas 1ª cobrança</SelectItem>
                  <SelectItem value="repeating">Por X meses</SelectItem>
                  <SelectItem value="forever">Para sempre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {duration === "repeating" && (
              <div>
                <Label htmlFor="months">Meses *</Label>
                <Input id="months" type="number" min={1} value={durationMonths} onChange={(e) => setDurationMonths(e.target.value)} className="mt-1.5" required />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="max">Limite de usos</Label>
              <Input id="max" type="number" min={1} value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} placeholder="Ilimitado" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="exp">Expira em</Label>
              <Input id="exp" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="mt-1.5" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="font-semibold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar cupom"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
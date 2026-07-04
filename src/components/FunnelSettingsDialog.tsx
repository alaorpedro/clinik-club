import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { testSheetsConnection } from "@/lib/funnels.functions";
import { getWhatsappAlert, saveWhatsappAlertNumbers, type WhatsappAlertRow } from "@/lib/whatsapp-alerts.functions";
import { useAuth } from "@/hooks/use-auth";
import { CheckCircle2, Copy, ExternalLink, FileSpreadsheet, Loader2, MessageCircle, Plus, Send, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

const StripeEmbeddedCheckout = lazy(() =>
  import("@/components/StripeEmbeddedCheckout").then((m) => ({ default: m.StripeEmbeddedCheckout })),
);

const WHATSAPP_ALERT_PRICE_ID = "whatsapp_alerts_monthly";

const APPS_SCRIPT_CODE = `function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = JSON.parse(e.postData.contents);
  const FIXED = ["Session ID","Data","Nome","Email","Telefone","Status","UTM"];
  const questions = Array.isArray(data.questions) ? data.questions : [];
  const pretty = data.answers_pretty || {};

  // Cria o cabecalho na primeira execucao
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(FIXED.concat(questions));
  }

  // Le o cabecalho atual e adiciona novas perguntas como colunas
  const lastCol = Math.max(sheet.getLastColumn(), FIXED.length);
  let header = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  FIXED.concat(questions).forEach(function (col) {
    if (header.indexOf(col) === -1) {
      sheet.getRange(1, header.length + 1).setValue(col);
      header.push(col);
    }
  });

  // Monta a linha do lead na ordem correta das colunas
  const row = header.map(function (col) {
    switch (col) {
      case "Session ID": return data.session_id;
      case "Data": return data.created_at;
      case "Nome": return data.name;
      case "Email": return data.email;
      case "Telefone": return data.phone;
      case "Status": return data.status;
      case "UTM": return JSON.stringify(data.utm || {});
      default: return pretty[col] != null ? pretty[col] : "";
    }
  });

  const sessionCol = header.indexOf("Session ID") + 1;
  const emailCol = header.indexOf("Email") + 1;
  const phoneCol = header.indexOf("Telefone") + 1;
  let targetRow = 0;
  if (data.session_id && sheet.getLastRow() > 1 && sessionCol > 0) {
    const ids = sheet.getRange(2, sessionCol, sheet.getLastRow() - 1, 1).getValues();
    for (let i = ids.length - 1; i >= 0; i--) {
      if (String(ids[i][0]) === String(data.session_id)) {
        targetRow = i + 2;
        break;
      }
    }
  }

  // Compatibilidade com planilhas antigas: se ainda nao havia Session ID,
  // tenta encontrar a ultima linha do mesmo telefone/e-mail e passa a atualiza-la.
  if (targetRow === 0 && sheet.getLastRow() > 1) {
    const lastRows = sheet.getRange(2, 1, sheet.getLastRow() - 1, header.length).getValues();
    const wantedPhone = String(data.phone || "").replace(/\\D/g, "");
    const wantedEmail = String(data.email || "").trim().toLowerCase();
    for (let i = lastRows.length - 1; i >= 0; i--) {
      const currentPhone = phoneCol > 0 ? String(lastRows[i][phoneCol - 1] || "").replace(/\\D/g, "") : "";
      const currentEmail = emailCol > 0 ? String(lastRows[i][emailCol - 1] || "").trim().toLowerCase() : "";
      if ((wantedPhone && currentPhone === wantedPhone) || (wantedEmail && currentEmail === wantedEmail)) {
        targetRow = i + 2;
        break;
      }
    }
  }

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return ContentService.createTextOutput(JSON.stringify({ok:true}))
    .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return HtmlService.createHtmlOutput(
    '<script>window.top.location.href="' +
      SpreadsheetApp.getActiveSpreadsheet().getUrl() +
      '";</script>'
  );
}`;

type Funnel = { id: string; slug: string; gtm_id: string | null; meta_pixel_id: string | null; sheets_webhook_url: string | null };
type Clinic = { clinic_name: string | null; clinic_logo_url: string | null; instagram_url: string | null };

function normalizeSlug(raw: string) {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function FunnelSettingsDialog({
  funnelId,
  open,
  onOpenChange,
  onSlugChange,
}: {
  funnelId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSlugChange?: (slug: string) => void;
}) {
  const { user } = useAuth();
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [clinic, setClinic] = useState<Clinic>({ clinic_name: null, clinic_logo_url: null, instagram_url: null });
  const [slugDraft, setSlugDraft] = useState("");
  const [slugError, setSlugError] = useState<string | null>(null);
  const [testingSheets, setTestingSheets] = useState(false);
  const [wa, setWa] = useState<WhatsappAlertRow | null>(null);
  const [waNumbers, setWaNumbers] = useState<string[]>([""]);
  const [waCoupon, setWaCoupon] = useState("");
  const [waSaving, setWaSaving] = useState(false);
  const [waCheckoutOpen, setWaCheckoutOpen] = useState(false);

  async function refreshWhatsappAlert() {
    const result = await getWhatsappAlert({ data: { funnelId } });
    setWa(result.alert);
    if (result.alert?.phone_numbers?.length) setWaNumbers(result.alert.phone_numbers);
  }

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: f } = await supabase.from("funnels").select("id, slug, gtm_id, meta_pixel_id, sheets_webhook_url").eq("id", funnelId).maybeSingle();
      if (f) {
        setFunnel(f as Funnel);
        setSlugDraft((f as Funnel).slug);
      }
      const { data: u } = await supabase.auth.getUser();
      if (u?.user) {
        const { data: p } = await supabase.from("profiles").select("clinic_name, clinic_logo_url, instagram_url").eq("id", u.user.id).maybeSingle();
        if (p) setClinic({ clinic_name: (p as any).clinic_name ?? null, clinic_logo_url: (p as any).clinic_logo_url ?? null, instagram_url: (p as any).instagram_url ?? null });
      }
      await refreshWhatsappAlert();
    })();
  }, [open, funnelId]);

  function updateWaNumber(index: number, value: string) {
    setWaNumbers((prev) => prev.map((n, i) => (i === index ? value : n)));
  }
  function addWaNumberField() {
    setWaNumbers((prev) => (prev.length >= 5 ? prev : [...prev, ""]));
  }
  function removeWaNumberField(index: number) {
    setWaNumbers((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function handleActivateWhatsappAlert() {
    const numbers = waNumbers.map((n) => n.trim()).filter(Boolean);
    if (!numbers.length) {
      toast.error("Cadastre ao menos um número de WhatsApp.");
      return;
    }
    setWaSaving(true);
    try {
      const result = await saveWhatsappAlertNumbers({ data: { funnelId, phoneNumbers: numbers } });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      await refreshWhatsappAlert();
      setWaCheckoutOpen(true);
    } finally {
      setWaSaving(false);
    }
  }

  async function handleSaveWhatsappNumbers() {
    const numbers = waNumbers.map((n) => n.trim()).filter(Boolean);
    if (!numbers.length) {
      toast.error("Cadastre ao menos um número de WhatsApp.");
      return;
    }
    setWaSaving(true);
    try {
      const result = await saveWhatsappAlertNumbers({ data: { funnelId, phoneNumbers: numbers } });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      await refreshWhatsappAlert();
      toast.success("Números atualizados.");
    } finally {
      setWaSaving(false);
    }
  }

  async function updateFunnel(patch: Partial<Funnel>) {
    if (!funnel) return false;
    setFunnel({ ...funnel, ...patch });
    const { error } = await supabase.from("funnels").update(patch).eq("id", funnel.id);
    if (error) toast.error(error.message);
    return !error;
  }

  async function updateClinic(patch: Partial<Clinic>) {
    setClinic((prev) => ({ ...prev, ...patch }));
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return;
    const { error } = await supabase.from("profiles").update(patch).eq("id", u.user.id);
    if (error) toast.error(error.message);
  }

  async function saveSlug() {
    if (!funnel) return;
    const next = normalizeSlug(slugDraft);
    if (!next) { setSlugError("Informe ao menos 1 caractere válido."); setSlugDraft(funnel.slug); return; }
    if (next.length < 3 || next.length > 60) { setSlugError("Use entre 3 e 60 caracteres."); return; }
    if (next === funnel.slug) { setSlugError(null); setSlugDraft(next); return; }
    const { data: existing } = await supabase.from("funnels").select("id").eq("slug", next).maybeSingle();
    if (existing && existing.id !== funnel.id) { setSlugError("Esta URL já está em uso. Escolha outra."); return; }
    setSlugError(null);
    setSlugDraft(next);
    await updateFunnel({ slug: next });
    onSlugChange?.(next);
    toast.success("URL pública atualizada!");
  }

  async function copyAppsScript() {
    await navigator.clipboard.writeText(APPS_SCRIPT_CODE);
    toast.success("Código copiado!");
  }

  async function saveSheetsUrl(url: string) {
    const v = url.trim();
    if (v && !/^https:\/\/script\.google\.com\//.test(v)) {
      toast.error("Cole a URL do Apps Script publicada. Ela começa com https://script.google.com/");
      return false;
    }
    const ok = await updateFunnel({ sheets_webhook_url: v || null });
    if (ok) toast.success(v ? "Google Sheets conectado ao funil." : "Conexão com Google Sheets removida.");
    return ok;
  }

  async function testSheets() {
    if (!funnel) return;
    const url = funnel.sheets_webhook_url?.trim();
    if (!url) {
      toast.error("Cole a URL do Apps Script antes de testar.");
      return;
    }
    if (!/^https:\/\/script\.google\.com\//.test(url)) {
      toast.error("A URL precisa começar com https://script.google.com/");
      return;
    }
    setTestingSheets(true);
    try {
      await updateFunnel({ sheets_webhook_url: url });
      const result = await testSheetsConnection({ data: { funnelId: funnel.id } });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Lead de teste enviado. Confira a primeira linha da planilha.");
    } finally {
      setTestingSheets(false);
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações do funil</DialogTitle>
          <DialogDescription>Personalize o cabeçalho da clínica e configure o rastreamento.</DialogDescription>
        </DialogHeader>

        {!funnel ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Cabeçalho da clínica</p>
              <p className="text-[11px] text-muted-foreground mb-3">Compartilhado entre todos os seus funis — alterar aqui atualiza em todos.</p>
              <div className="grid sm:grid-cols-[120px_1fr] gap-4 items-start">
                <ClinicLogoUpload value={clinic.clinic_logo_url} onChange={(url) => updateClinic({ clinic_logo_url: url })} />
                <div>
                  <Label className="text-xs">Nome da clínica</Label>
                  <Input
                    value={clinic.clinic_name ?? ""}
                    onChange={(e) => setClinic((prev) => ({ ...prev, clinic_name: e.target.value }))}
                    onBlur={(e) => updateClinic({ clinic_name: e.target.value })}
                    placeholder="Ex: Clínica Sorriso"
                  />
                  <p className="text-[11px] text-muted-foreground mt-2">Exibido como cabeçalho fixo em todas as etapas do funil.</p>
                </div>
              </div>
              <div className="mt-4">
                <Label className="text-xs">Instagram da clínica</Label>
                <Input
                  value={clinic.instagram_url ?? ""}
                  onChange={(e) => setClinic((prev) => ({ ...prev, instagram_url: e.target.value }))}
                  onBlur={(e) => updateClinic({ instagram_url: e.target.value.trim() || null })}
                  placeholder="https://instagram.com/suaclinica"
                />
                <p className="text-[11px] text-muted-foreground mt-2">Para onde leads desqualificados nas perguntas serão redirecionados.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">URL pública</p>
              <p className="text-[11px] text-muted-foreground mb-3">Define o endereço do funil: <code>/f/&lt;slug&gt;</code>. Use apenas letras minúsculas, números e hífens.</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground shrink-0">/f/</span>
                <Input
                  value={slugDraft}
                  onChange={(e) => { setSlugDraft(e.target.value); setSlugError(null); }}
                  onBlur={saveSlug}
                  placeholder="minha-clinica"
                />
              </div>
              {slugError && <p className="text-[11px] text-destructive mt-2">{slugError}</p>}
              <p className="text-[11px] text-muted-foreground mt-2">Alterar a URL quebra links antigos já compartilhados.</p>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Rastreamento</p>
              <p className="text-[11px] text-muted-foreground mb-3">Os scripts são injetados no funil público e disparam eventos automáticos: <code>PageView</code>, <code>ViewContent</code>, <code>Lead</code> e <code>CompleteRegistration</code> (Meta) — e os equivalentes no <code>dataLayer</code> do GTM.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Google Tag Manager ID</Label>
                  <Input
                    value={funnel.gtm_id ?? ""}
                    onChange={(e) => setFunnel({ ...funnel, gtm_id: e.target.value })}
                    onBlur={(e) => updateFunnel({ gtm_id: e.target.value.trim() || null })}
                    placeholder="GTM-XXXXXXX"
                  />
                </div>
                <div>
                  <Label className="text-xs">Meta Pixel ID</Label>
                  <Input
                    value={funnel.meta_pixel_id ?? ""}
                    onChange={(e) => setFunnel({ ...funnel, meta_pixel_id: e.target.value })}
                    onBlur={(e) => updateFunnel({ meta_pixel_id: e.target.value.trim() || null })}
                    placeholder="1234567890123456"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">Enviar leads para Google Sheets</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Cada funil pode ter sua própria planilha. A conexão fica salva apenas neste funil e os leads são enviados pelo servidor do Clinik.Club.
                  </p>
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-background/80 p-3 text-[11px] leading-5 text-muted-foreground">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      Recomendação: mantenha a planilha privada no seu Drive. Não é necessário deixar os dados dos pacientes públicos.
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  ["1", "Crie a planilha", "Abra uma planilha limpa no Google Sheets."],
                  ["2", "Cole o código", "Use o botão abaixo para copiar o script."],
                  ["3", "Publique e conecte", "Cole aqui a URL final terminada em /exec."],
                ].map(([step, title, text]) => (
                  <div key={step} className="rounded-xl border border-border bg-background p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{step}</span>
                      <span className="text-xs font-bold">{title}</span>
                    </div>
                    <p className="text-[11px] leading-5 text-muted-foreground">{text}</p>
                  </div>
                ))}
              </div>

              <details className="mt-4 rounded-xl border border-border bg-background p-3 text-[11px] text-muted-foreground" open={!funnel.sheets_webhook_url}>
                <summary className="cursor-pointer text-sm font-semibold text-foreground">Ver passo a passo para conectar</summary>
                <ol className="mt-3 list-decimal space-y-2 pl-4 leading-5">
                  <li>Abra a planilha que receberá os leads deste funil.</li>
                  <li>No menu do Google Sheets, clique em <code>Extensões</code> e depois em <code>Apps Script</code>.</li>
                  <li>Apague o conteúdo que aparecer e cole o código abaixo.</li>
                  <li>Clique em <strong>Implantar</strong>, depois em <strong>Nova implantação</strong>.</li>
                  <li>Escolha o tipo <strong>Aplicativo da Web</strong>.</li>
                  <li>Em <strong>Executar como</strong>, selecione <strong>Eu</strong>. Em <strong>Quem pode acessar</strong>, selecione <strong>Qualquer pessoa</strong>.</li>
                  <li>Copie a URL gerada pelo Google. Ela termina com <code>/exec</code>. Cole no campo abaixo e clique em testar.</li>
                </ol>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">Código para colar no Apps Script</span>
                  <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={copyAppsScript}>
                    <Copy className="h-3.5 w-3.5" /> Copiar código
                  </Button>
                </div>
                <textarea
                  readOnly
                  value={APPS_SCRIPT_CODE}
                  onFocus={(e) => e.currentTarget.select()}
                  className="mt-2 h-44 w-full resize-none rounded-lg bg-secondary/60 p-2 font-mono text-[10px]"
                />
              </details>

              <div className="mt-4">
                <Label className="text-xs">URL gerada pelo Google Apps Script</Label>
                <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={funnel.sheets_webhook_url ?? ""}
                    onChange={(e) => setFunnel({ ...funnel, sheets_webhook_url: e.target.value })}
                    onBlur={(e) => saveSheetsUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/AKfy.../exec"
                  />
                  <Button type="button" variant="outline" className="rounded-full sm:w-36" onClick={testSheets} disabled={testingSheets}>
                    {testingSheets ? (
                      "Testando..."
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" /> Testar
                      </>
                    )}
                  </Button>
                </div>
                {funnel.sheets_webhook_url ? (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-primary">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Conexão configurada para este funil. Envie um teste para confirmar.
                  </p>
                ) : (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Sem conexão ativa. Os leads continuarão salvos normalmente no Clinik.Club.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                  <MessageCircle className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold">Alertas de leads no WhatsApp</p>
                    {wa?.status === "active" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> Ativo
                      </span>
                    )}
                    {wa?.status === "canceled" && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">Cancelado</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Criamos um grupo privado no WhatsApp (só nós como admin) com o(s) seu(s) número(s). Cada lead que chegar
                    neste funil também cai como mensagem no grupo, em tempo real. <strong>R$ 29,90/mês.</strong>
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Label className="text-xs">Seu(s) número(s) de WhatsApp (com DDD)</Label>
                {waNumbers.map((n, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input value={n} onChange={(e) => updateWaNumber(i, e.target.value)} placeholder="(11) 91234-5678" />
                    {waNumbers.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeWaNumberField(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                {waNumbers.length < 5 && (
                  <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={addWaNumberField}>
                    <Plus className="h-3.5 w-3.5" /> Adicionar número
                  </Button>
                )}
              </div>

              {(!wa || wa.status === "pending_payment" || wa.status === "canceled" || wa.status === "failed") && (
                <div className="mt-4">
                  <Label className="text-xs">Cupom de desconto (opcional)</Label>
                  <Input
                    value={waCoupon}
                    onChange={(e) => setWaCoupon(e.target.value.toUpperCase())}
                    placeholder="Ex: BEMVINDO10"
                    className="mt-1.5"
                  />
                  <Button type="button" className="mt-3 w-full rounded-full" onClick={handleActivateWhatsappAlert} disabled={waSaving}>
                    {waSaving
                      ? "Salvando..."
                      : wa?.status === "canceled" || wa?.status === "failed"
                        ? "Reativar por R$ 29,90/mês"
                        : "Ativar por R$ 29,90/mês"}
                  </Button>
                </div>
              )}

              {wa?.status === "provisioning" && (
                <p className="mt-4 flex items-center gap-1.5 text-[11px] font-medium text-amber-600">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Criando seu grupo no WhatsApp... isso leva só alguns instantes.
                </p>
              )}

              {wa?.status === "active" && (
                <div className="mt-4">
                  <Button type="button" variant="outline" className="rounded-full w-full" onClick={handleSaveWhatsappNumbers} disabled={waSaving}>
                    {waSaving ? "Salvando..." : "Salvar números"}
                  </Button>
                </div>
              )}

              {wa?.status === "action_needed" && (
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] leading-5">
                  <p className="font-semibold text-amber-700">Um ou mais números não puderam ser adicionados automaticamente.</p>
                  <p className="mt-1 text-muted-foreground">
                    Entre no grupo pelo link abaixo e compartilhe com quem mais precisar receber os alertas:
                  </p>
                  {wa.invite_link && (
                    <a
                      href={wa.invite_link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
                    >
                      Abrir convite do grupo <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <Button type="button" variant="outline" size="sm" className="mt-3 rounded-full" onClick={handleSaveWhatsappNumbers} disabled={waSaving}>
                    {waSaving ? "Salvando..." : "Salvar números"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    <Dialog open={waCheckoutOpen} onOpenChange={setWaCheckoutOpen}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden" allowStripePointerPassThrough={true}>
        <DialogHeader className="px-6 pt-6 text-left">
          <DialogTitle>Ativar alertas no WhatsApp</DialogTitle>
        </DialogHeader>
        <div className="p-6">
          {user && waCheckoutOpen && (
            <Suspense fallback={<div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>}>
              <StripeEmbeddedCheckout
                priceId={WHATSAPP_ALERT_PRICE_ID}
                customerEmail={user.email ?? undefined}
                returnUrl={`${window.location.origin}/app/funis/${funnelId}/editar?settings=open`}
                funnelId={funnelId}
                promoCode={waCoupon.trim() || undefined}
              />
            </Suspense>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

function ClinicLogoUpload({ value, onChange }: { value: string | null; onChange: (url: string | null) => void }) {
  const [uploading, setUploading] = useState(false);
  async function handleFile(file: File) {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Faça login novamente"); return; }
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("funnel-media").upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) { toast.error(error.message); return; }
      const { data } = supabase.storage.from("funnel-media").getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Logo enviado!");
    } finally {
      setUploading(false);
    }
  }
  return (
    <div>
      <Label className="text-xs">Logo</Label>
      {value ? (
        <div className="mt-1 relative w-24 h-24 rounded-full overflow-hidden border border-border">
          <img src={value} alt="logo" className="w-full h-full object-cover" />
          <button type="button" onClick={() => onChange(null)} className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/90 border border-border flex items-center justify-center hover:bg-background">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <label className="mt-1 w-24 h-24 flex flex-col items-center justify-center gap-1 rounded-full border-2 border-dashed border-border cursor-pointer hover:border-primary/50 hover:bg-secondary/30 transition">
          <Upload className="h-4 w-4 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground text-center px-1">{uploading ? "Enviando..." : "Enviar logo"}</span>
          <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </label>
      )}
    </div>
  );
}

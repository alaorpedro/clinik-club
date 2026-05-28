import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Copy } from "lucide-react";
import { toast } from "sonner";

const APPS_SCRIPT_CODE = `function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = JSON.parse(e.postData.contents);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Data","Nome","Email","Telefone","Status","Respostas","UTM"]);
  }
  sheet.appendRow([
    data.created_at, data.name, data.email, data.phone,
    data.status, JSON.stringify(data.answers), JSON.stringify(data.utm)
  ]);
  return ContentService.createTextOutput(JSON.stringify({ok:true}))
    .setMimeType(ContentService.MimeType.JSON);
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
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [clinic, setClinic] = useState<Clinic>({ clinic_name: null, clinic_logo_url: null, instagram_url: null });
  const [slugDraft, setSlugDraft] = useState("");
  const [slugError, setSlugError] = useState<string | null>(null);

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
    })();
  }, [open, funnelId]);

  async function updateFunnel(patch: Partial<Funnel>) {
    if (!funnel) return;
    setFunnel({ ...funnel, ...patch });
    const { error } = await supabase.from("funnels").update(patch).eq("id", funnel.id);
    if (error) toast.error(error.message);
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

  return (
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

            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Google Sheets (tempo real)</p>
              <p className="text-[11px] text-muted-foreground mb-3">
                Envie cada novo lead automaticamente para uma planilha. Cole abaixo a URL do <strong>Apps Script</strong> publicado como <em>aplicativo da web</em>.
              </p>
              <Label className="text-xs">URL do webhook</Label>
              <Input
                value={funnel.sheets_webhook_url ?? ""}
                onChange={(e) => setFunnel({ ...funnel, sheets_webhook_url: e.target.value })}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && !/^https:\/\/script\.google\.com\//.test(v)) {
                    toast.error("A URL precisa começar com https://script.google.com/");
                    return;
                  }
                  updateFunnel({ sheets_webhook_url: v || null });
                }}
                placeholder="https://script.google.com/macros/s/AKfy.../exec"
              />
              <details className="mt-3 text-[11px] text-muted-foreground">
                <summary className="cursor-pointer font-semibold text-foreground">Como configurar (2 minutos)</summary>
                <ol className="list-decimal pl-4 mt-2 space-y-1">
                  <li>Abra sua planilha no Google Sheets.</li>
                  <li>Menu <code>Extensões → Apps Script</code>.</li>
                  <li>
                    <div className="flex items-center justify-between gap-2 mt-1 mb-1">
                      <span>Apague tudo e cole o código abaixo:</span>
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(APPS_SCRIPT_CODE);
                          toast.success("Código copiado!");
                        }}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
                      >
                        <Copy className="h-3 w-3" /> Copiar
                      </button>
                    </div>
                    <textarea
                      readOnly
                      value={APPS_SCRIPT_CODE}
                      onFocus={(e) => e.currentTarget.select()}
                      className="w-full font-mono bg-secondary/60 p-2 rounded text-[10px] h-44 resize-none"
                    />
                  </li>
                  <li>Clique em <strong>Implantar → Nova implantação</strong>.</li>
                  <li>Tipo: <strong>Aplicativo da Web</strong>. Executar como: <em>Eu</em>. Acesso: <strong>Qualquer pessoa</strong>.</li>
                  <li>Copie a URL gerada (termina em <code>/exec</code>) e cole acima.</li>
                </ol>
              </details>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
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
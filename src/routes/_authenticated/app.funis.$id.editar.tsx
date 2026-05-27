import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, GripVertical, Plus, Trash2, Eye, Globe, Copy, Upload, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/funis/$id/editar")({
  component: EditFunnel,
});

type Step = { id: string; type: string; order: number; config: any; funnel_id: string };
type Funnel = { id: string; name: string; slug: string; status: string; clinic_name: string | null; clinic_logo_url: string | null };

const STEP_TYPES = [
  { value: "text", label: "Texto / CTA" },
  { value: "single", label: "Escolha única" },
  { value: "multiple", label: "Múltipla escolha" },
  { value: "input", label: "Campo de texto" },
  { value: "lead", label: "Captura de lead" },
  { value: "contact", label: "Nome + Telefone" },
];

function EditFunnel() {
  const { id } = Route.useParams();
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: f } = await supabase.from("funnels").select("id, name, slug, status, clinic_name, clinic_logo_url").eq("id", id).maybeSingle();
    const { data: s } = await supabase.from("funnel_steps").select("*").eq("funnel_id", id).order("order", { ascending: true });
    setFunnel(f as Funnel | null);
    setSteps((s as Step[]) ?? []);
    setSelected((s?.[0] as Step | undefined)?.id ?? null);
    setLoading(false);
  }
  useEffect(() => { load(); }, [id]);

  async function addStep(type: string) {
    const order = steps.length;
    const config = defaultConfig(type);
    const { data, error } = await supabase.from("funnel_steps").insert({ funnel_id: id, type, order, config }).select().single();
    if (error) return toast.error(error.message);
    setSteps([...steps, data as Step]);
    setSelected((data as Step).id);
  }

  async function removeStep(stepId: string) {
    if (!confirm("Remover esta etapa?")) return;
    const { error } = await supabase.from("funnel_steps").delete().eq("id", stepId);
    if (error) return toast.error(error.message);
    setSteps(steps.filter((s) => s.id !== stepId));
    if (selected === stepId) setSelected(null);
  }

  async function updateStep(stepId: string, patch: Partial<Step>) {
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, ...patch } : s)));
    const { error } = await supabase.from("funnel_steps").update(patch).eq("id", stepId);
    if (error) toast.error(error.message);
  }

  async function move(stepId: string, dir: -1 | 1) {
    const i = steps.findIndex((s) => s.id === stepId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= steps.length) return;
    const a = steps[i], b = steps[j];
    const next = [...steps];
    next[i] = { ...b, order: i };
    next[j] = { ...a, order: j };
    setSteps(next);
    await supabase.from("funnel_steps").update({ order: j }).eq("id", a.id);
    await supabase.from("funnel_steps").update({ order: i }).eq("id", b.id);
  }

  async function reorderTo(fromId: string, toIndex: number) {
    const from = steps.findIndex((s) => s.id === fromId);
    if (from < 0 || toIndex < 0 || toIndex >= steps.length || from === toIndex) return;
    const next = [...steps];
    const [moved] = next.splice(from, 1);
    next.splice(toIndex, 0, moved);
    const renum = next.map((s, idx) => ({ ...s, order: idx }));
    setSteps(renum);
    await Promise.all(
      renum.map((s) => supabase.from("funnel_steps").update({ order: s.order }).eq("id", s.id))
    );
  }

  async function togglePublish() {
    if (!funnel) return;
    const status = funnel.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("funnels").update({ status }).eq("id", funnel.id);
    if (error) return toast.error(error.message);
    setFunnel({ ...funnel, status });
    toast.success(status === "published" ? "Funil publicado!" : "Despublicado");
  }

  async function updateFunnel(patch: Partial<Funnel>) {
    if (!funnel) return;
    setFunnel({ ...funnel, ...patch });
    const { error } = await supabase.from("funnels").update(patch).eq("id", funnel.id);
    if (error) toast.error(error.message);
  }

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!funnel) return <p>Funil não encontrado.</p>;

  const current = steps.find((s) => s.id === selected) ?? null;
  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/f/${funnel.slug}`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/app"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
          </Button>
          <div>
            <h1 className="text-2xl font-black tracking-tight">{funnel.name}</h1>
            <p className="text-xs text-muted-foreground">/{funnel.slug} · {funnel.status}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {funnel.status === "published" && (
            <a href={publicUrl} target="_blank" rel="noreferrer"><Button variant="outline" size="sm" className="rounded-full"><Eye className="h-4 w-4 mr-1" />Ver público</Button></a>
          )}
          <Button onClick={togglePublish} className="rounded-full font-semibold" size="sm">
            <Globe className="h-4 w-4 mr-1" />{funnel.status === "published" ? "Despublicar" : "Publicar"}
          </Button>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5">
        <span className="text-xs text-muted-foreground shrink-0">Link público:</span>
        <Input readOnly value={publicUrl} className="h-8 border-0 bg-transparent px-1 text-sm focus-visible:ring-0" />
        <Button
          size="sm"
          variant="outline"
          className="rounded-full shrink-0"
          onClick={() => {
            navigator.clipboard.writeText(publicUrl);
            toast.success("Link copiado!");
          }}
        >
          <Copy className="h-3.5 w-3.5 mr-1" />Copiar
        </Button>
      </div>

      <div className="mb-6 rounded-2xl border border-border bg-background p-4">
        <p className="text-xs font-semibold uppercase text-muted-foreground mb-3">Cabeçalho da clínica</p>
        <div className="grid sm:grid-cols-[120px_1fr] gap-4 items-start">
          <ClinicLogoUpload value={funnel.clinic_logo_url} onChange={(url) => updateFunnel({ clinic_logo_url: url })} />
          <div>
            <Label className="text-xs">Nome da clínica</Label>
            <Input
              value={funnel.clinic_name ?? ""}
              onChange={(e) => setFunnel({ ...funnel, clinic_name: e.target.value })}
              onBlur={(e) => updateFunnel({ clinic_name: e.target.value })}
              placeholder="Ex: Clínica Sorriso"
            />
            <p className="text-[11px] text-muted-foreground mt-2">Exibido como cabeçalho fixo em todas as etapas do funil.</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr_320px] gap-6">
        {/* Steps list */}
        <aside className="rounded-2xl border border-border bg-background p-4">
          <div className="text-xs font-semibold uppercase text-muted-foreground mb-3">Etapas</div>
          <div className="space-y-1.5">
            {steps.map((s, i) => (
              <div
                key={s.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", s.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  e.currentTarget.classList.add("ring-2", "ring-primary/40");
                }}
                onDragLeave={(e) => e.currentTarget.classList.remove("ring-2", "ring-primary/40")}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("ring-2", "ring-primary/40");
                  const fromId = e.dataTransfer.getData("text/plain");
                  if (fromId && fromId !== s.id) reorderTo(fromId, i);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition cursor-move ${selected === s.id ? "bg-primary/10 text-primary" : "hover:bg-secondary"}`}
                onClick={() => setSelected(s.id)}
              >
                <GripVertical className="h-3.5 w-3.5 opacity-50 shrink-0" />
                <span className="font-medium">{i + 1}.</span>
                <span className="truncate flex-1">{s.config?.title || STEP_TYPES.find((t) => t.value === s.type)?.label}</span>
              </div>
            ))}
            {steps.length === 0 && <p className="text-xs text-muted-foreground px-2">Adicione sua primeira etapa abaixo.</p>}
          </div>
          <div className="mt-4 pt-4 border-t border-border space-y-1">
            <p className="text-xs text-muted-foreground mb-2 px-1">Adicionar etapa</p>
            {STEP_TYPES.map((t) => (
              <button key={t.value} onClick={() => addStep(t.value)} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs hover:bg-secondary text-left">
                <Plus className="h-3 w-3" />{t.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Editor */}
        <section className="rounded-2xl border border-border bg-background p-6">
          {current ? (
            <StepEditor key={current.id} step={current} onChange={(patch) => updateStep(current.id, patch)} onDelete={() => removeStep(current.id)} onMoveUp={() => move(current.id, -1)} onMoveDown={() => move(current.id, 1)} />
          ) : (
            <p className="text-muted-foreground text-sm">Selecione uma etapa à esquerda ou crie uma nova.</p>
          )}
        </section>

        {/* Preview */}
        <aside className="hidden lg:block">
          <div className="sticky top-6">
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-3">Preview</p>
            <PhonePreview
              step={current}
              clinicName={funnel.clinic_name}
              clinicLogo={funnel.clinic_logo_url}
              onChange={current ? (patch) => updateStep(current.id, { config: { ...current.config, ...patch } }) : undefined}
            />
          </div>
        </aside>
      </div>

      <div className="mt-8">
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/app/funis/$id/leads" params={{ id }}>Ver leads capturados</Link>
        </Button>
      </div>
    </div>
  );
}

function defaultConfig(type: string): any {
  switch (type) {
    case "text": return { title: "Bem-vindo!", body: "Vamos começar?", cta: "Começar" };
    case "single": return { title: "Escolha uma opção", options: ["Opção A", "Opção B", "Opção C"] };
    case "multiple": return { title: "Selecione todas que se aplicam", options: ["Item 1", "Item 2"], cta: "Continuar" };
    case "input": return { title: "Qual a sua resposta?", placeholder: "Digite aqui...", cta: "Continuar" };
    case "lead": return { title: "Quase lá! Deixe seu contato", cta: "Receber resultado" };
    case "contact": return { title: "Deixe seu contato", cta: "Enviar", namePlaceholder: "Seu nome", phonePlaceholder: "Seu WhatsApp" };
    default: return {};
  }
}

function StepEditor({ step, onChange, onDelete, onMoveUp, onMoveDown }: { step: Step; onChange: (patch: Partial<Step>) => void; onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void }) {
  const cfg = step.config ?? {};
  function setCfg(patch: any) { onChange({ config: { ...cfg, ...patch } }); }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Tipo</Label>
          <Select value={step.type} onValueChange={(v) => onChange({ type: v, config: defaultConfig(v) })}>
            <SelectTrigger className="w-48 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{STEP_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onMoveUp}>↑</Button>
          <Button variant="ghost" size="sm" onClick={onMoveDown}>↓</Button>
          <Button variant="ghost" size="sm" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      </div>

      <div>
        <Label className="text-xs">Título</Label>
        <Input value={cfg.title ?? ""} onChange={(e) => setCfg({ title: e.target.value })} />
      </div>

      {step.type === "text" && (
        <div>
          <Label className="text-xs">Texto</Label>
          <Textarea value={cfg.body ?? ""} onChange={(e) => setCfg({ body: e.target.value })} />
        </div>
      )}

      {(step.type === "single" || step.type === "multiple") && (
        <div>
          <Label className="text-xs">Opções (uma por linha)</Label>
          <Textarea
            rows={6}
            value={(cfg.options ?? []).join("\n")}
            onChange={(e) => setCfg({ options: e.target.value.split("\n") })}
            onBlur={(e) => setCfg({ options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
          />
        </div>
      )}

      {step.type === "input" && (
        <div>
          <Label className="text-xs">Placeholder</Label>
          <Input value={cfg.placeholder ?? ""} onChange={(e) => setCfg({ placeholder: e.target.value })} />
        </div>
      )}

      {step.type === "contact" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Placeholder do nome</Label>
            <Input value={cfg.namePlaceholder ?? ""} onChange={(e) => setCfg({ namePlaceholder: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Placeholder do telefone</Label>
            <Input value={cfg.phonePlaceholder ?? ""} onChange={(e) => setCfg({ phonePlaceholder: e.target.value })} />
          </div>
        </div>
      )}

      {step.type !== "single" && (
        <div>
          <Label className="text-xs">Texto do botão</Label>
          <Input value={cfg.cta ?? ""} onChange={(e) => setCfg({ cta: e.target.value })} />
        </div>
      )}

      <div className="pt-5 border-t border-border space-y-4">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Layout & mídia</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Tipo de mídia</Label>
            <Select value={cfg.mediaType ?? "none"} onValueChange={(v) => setCfg({ mediaType: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                <SelectItem value="image">Imagem</SelectItem>
                <SelectItem value="video">Vídeo (YouTube/MP4)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Posição da mídia</Label>
            <Select value={cfg.mediaPosition ?? "above"} onValueChange={(v) => setCfg({ mediaPosition: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="above">Acima do título</SelectItem>
                <SelectItem value="below">Abaixo do título</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {cfg.mediaType === "image" && (
          <ImageUpload value={cfg.mediaUrl} onChange={(url) => setCfg({ mediaUrl: url })} />
        )}
        {cfg.mediaType === "video" && (
          <div>
            <Label className="text-xs">Link do vídeo (YouTube ou MP4)</Label>
            <Input value={cfg.mediaUrl ?? ""} onChange={(e) => setCfg({ mediaUrl: e.target.value })} placeholder="https://youtube.com/watch?v=..." />
          </div>
        )}

        <div>
          <Label className="text-xs">Subtítulo / descrição</Label>
          <Textarea rows={2} value={cfg.subtitle ?? ""} onChange={(e) => setCfg({ subtitle: e.target.value })} placeholder="Texto opcional exibido junto da pergunta" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Posição do subtítulo</Label>
            <Select value={cfg.subtitlePosition ?? "below"} onValueChange={(v) => setCfg({ subtitlePosition: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="above">Acima do título</SelectItem>
                <SelectItem value="below">Abaixo do título</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Alinhamento</Label>
            <Select value={cfg.align ?? "left"} onValueChange={(v) => setCfg({ align: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Esquerda</SelectItem>
                <SelectItem value="center">Centro</SelectItem>
                <SelectItem value="right">Direita</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Cor de fundo</Label>
            <Input type="color" value={cfg.bgColor ?? "#ffffff"} onChange={(e) => setCfg({ bgColor: e.target.value })} className="h-9 p-1" />
          </div>
          <div>
            <Label className="text-xs">Estilo do botão</Label>
            <Select value={cfg.buttonStyle ?? "solid"} onValueChange={(v) => setCfg({ buttonStyle: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="solid">Sólido</SelectItem>
                <SelectItem value="outline">Contorno</SelectItem>
                <SelectItem value="ghost">Discreto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImageUpload({ value, onChange }: { value?: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  async function handleFile(file: File) {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Faça login novamente"); return; }
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("funnel-media").upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) { toast.error(error.message); return; }
      const { data } = supabase.storage.from("funnel-media").getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Imagem enviada!");
    } finally {
      setUploading(false);
    }
  }
  return (
    <div>
      <Label className="text-xs">Imagem</Label>
      {value ? (
        <div className="mt-1 relative rounded-xl overflow-hidden border border-border">
          <img src={value} alt="" className="w-full max-h-48 object-cover" />
          <button type="button" onClick={() => onChange("")} className="absolute top-2 right-2 h-7 w-7 rounded-full bg-background/90 border border-border flex items-center justify-center hover:bg-background">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <label className="mt-1 flex flex-col items-center justify-center gap-2 px-4 py-8 rounded-xl border-2 border-dashed border-border cursor-pointer hover:border-primary/50 hover:bg-secondary/30 transition">
          <Upload className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{uploading ? "Enviando..." : "Clique para enviar"}</span>
          <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </label>
      )}
    </div>
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

type SizeKey = "sm" | "md" | "lg" | "xl";
const TITLE_SIZES: Record<SizeKey, string> = { sm: "text-xs", md: "text-sm", lg: "text-base", xl: "text-lg" };
const SUBTITLE_SIZES: Record<SizeKey, string> = { sm: "text-[9px]", md: "text-[10px]", lg: "text-[11px]", xl: "text-xs" };
const BODY_SIZES: Record<SizeKey, string> = { sm: "text-[10px]", md: "text-xs", lg: "text-sm", xl: "text-base" };
const MEDIA_SIZES: Record<SizeKey, string> = { sm: "h-14", md: "h-20", lg: "h-28", xl: "h-36" };

type ElKey = "title" | "subtitle" | "body" | "media" | "cta";

function PhonePreview({ step, clinicName, clinicLogo, onChange }: { step: Step | null; clinicName?: string | null; clinicLogo?: string | null; onChange?: (patch: any) => void }) {
  const [sel, setSel] = useState<ElKey | null>(null);
  const cfg: any = step?.config ?? {};
  const align = cfg.align === "center" ? "text-center" : cfg.align === "right" ? "text-right" : "text-left";
  const titleSize = (cfg.titleSize as SizeKey) || "md";
  const subtitleSize = (cfg.subtitleSize as SizeKey) || "md";
  const bodySize = (cfg.bodySize as SizeKey) || "md";
  const mediaSize = (cfg.mediaSize as SizeKey) || "md";

  const btnCls =
    cfg.buttonStyle === "outline"
      ? "mt-auto px-3 py-2 rounded-full border-2 border-primary text-primary text-[11px] font-semibold text-center"
      : cfg.buttonStyle === "ghost"
      ? "mt-auto px-3 py-2 rounded-full text-primary text-[11px] font-semibold text-center"
      : "mt-auto px-3 py-2 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold text-center";

  const editable = !!(step && onChange);
  const ring = (k: ElKey) => editable ? `cursor-pointer rounded transition ${sel === k ? "outline outline-2 outline-primary outline-offset-2" : "hover:outline hover:outline-1 hover:outline-primary/50 hover:outline-offset-2"}` : "";
  const click = (k: ElKey) => (e: React.MouseEvent) => { if (!editable) return; e.stopPropagation(); setSel(sel === k ? null : k); };

  const hasCustomW = typeof cfg.mediaWidthPct === "number";
  const hasCustomH = typeof cfg.mediaHeight === "number";
  const mediaStyle: React.CSSProperties = {
    width: hasCustomW ? `${cfg.mediaWidthPct}%` : "100%",
    height: hasCustomH ? `${cfg.mediaHeight}px` : undefined,
  };
  const mediaHeightCls = hasCustomH ? "" : MEDIA_SIZES[mediaSize];
  const mediaInner = cfg.mediaUrl ? (
    cfg.mediaType === "image" ? (
      <img src={cfg.mediaUrl} alt="" className={`w-full h-full object-cover rounded-lg block`} />
    ) : cfg.mediaType === "video" ? (
      <div className="w-full h-full rounded-lg bg-foreground/10 flex items-center justify-center text-[10px] text-muted-foreground">▶ vídeo</div>
    ) : null
  ) : null;
  const media = mediaInner ? (
    <div
      className={`relative inline-block ${mediaHeightCls} ${ring("media")}`}
      style={mediaStyle}
      onClick={click("media")}
    >
      {mediaInner}
      {editable && sel === "media" && onChange && (
        <ResizeHandles cfg={cfg} onChange={onChange} />
      )}
    </div>
  ) : null;
  const subtitle = cfg.subtitle ? (
    <p className={`${SUBTITLE_SIZES[subtitleSize]} text-muted-foreground mt-1 break-words whitespace-pre-wrap ${ring("subtitle")}`} onClick={click("subtitle")}>{cfg.subtitle}</p>
  ) : null;
  const mediaAbove = cfg.mediaPosition !== "below";
  const subtitleAbove = cfg.subtitlePosition === "above";

  return (
    <div className="space-y-3">
      {editable && sel && (
        <ElementControls
          el={sel}
          cfg={cfg}
          onChange={onChange!}
          onClose={() => setSel(null)}
        />
      )}
      <div
        className="mx-auto w-[260px] aspect-[9/19] rounded-[2.5rem] border-8 border-foreground shadow-card p-4 overflow-hidden"
        style={{ backgroundColor: cfg.bgColor || undefined }}
        onClick={() => setSel(null)}
      >
        <div className={`h-full flex flex-col ${align}`}>
          <div className="h-1.5 w-16 bg-foreground/20 rounded-full mx-auto mb-4" />
          {(clinicName || clinicLogo) && (
            <div className="flex items-center gap-2 pb-2 mb-3 border-b border-border">
              {clinicLogo && <img src={clinicLogo} alt="" className="h-6 w-6 rounded-full object-cover" />}
              {clinicName && <span className="text-[11px] font-semibold truncate">{clinicName}</span>}
            </div>
          )}
          {!step ? (
            <p className="text-xs text-muted-foreground text-center mt-10">Sem etapa selecionada</p>
          ) : (
            <div className="flex-1 flex flex-col">
              {mediaAbove && media && <div className="mb-2">{media}</div>}
              {subtitleAbove && subtitle}
              {cfg.title && (
                <h3 className={`${TITLE_SIZES[titleSize]} font-bold ${ring("title")}`} onClick={click("title")}>{cfg.title}</h3>
              )}
              {!subtitleAbove && subtitle}
              {!mediaAbove && media && <div className="mt-2">{media}</div>}
              {step.type === "text" && cfg.body && (
                <p className={`${BODY_SIZES[bodySize]} text-muted-foreground mt-2 ${ring("body")}`} onClick={click("body")}>{cfg.body}</p>
              )}
              {(step.type === "single" || step.type === "multiple") && (
                <div className="mt-3 space-y-1.5">
                  {(cfg.options ?? []).slice(0, 4).map((o: string) => (
                    <div key={o} className="px-2 py-1.5 rounded-lg border border-border text-[11px]">{o}</div>
                  ))}
                </div>
              )}
              {step.type === "input" && <div className="mt-3 px-2 py-1.5 rounded-lg border border-border text-[11px] text-muted-foreground">{cfg.placeholder}</div>}
              {step.type === "lead" && (
                <div className="mt-3 space-y-1.5">
                  <div className="px-2 py-1.5 rounded-lg border border-border text-[11px] text-muted-foreground">Nome</div>
                  <div className="px-2 py-1.5 rounded-lg border border-border text-[11px] text-muted-foreground">E-mail</div>
                  <div className="px-2 py-1.5 rounded-lg border border-border text-[11px] text-muted-foreground">WhatsApp</div>
                </div>
              )}
              {step.type === "contact" && (
                <div className="mt-3 space-y-1.5">
                  <div className="px-2 py-1.5 rounded-lg border border-border text-[11px] text-muted-foreground">{cfg.namePlaceholder || "Seu nome"}</div>
                  <div className="px-2 py-1.5 rounded-lg border border-border text-[11px] text-muted-foreground">{cfg.phonePlaceholder || "Seu WhatsApp"}</div>
                </div>
              )}
              <div className={`${btnCls} ${ring("cta")}`} onClick={click("cta")}>{cfg.cta || "Continuar"}</div>
            </div>
          )}
        </div>
      </div>
      {editable && !sel && (
        <p className="text-[11px] text-muted-foreground text-center">Clique em um elemento do preview para editar</p>
      )}
    </div>
  );
}

function ElementControls({ el, cfg, onChange, onClose }: { el: ElKey; cfg: any; onChange: (patch: any) => void; onClose: () => void }) {
  const labels: Record<ElKey, string> = { title: "Título", subtitle: "Subtítulo", body: "Texto", media: "Mídia", cta: "Botão" };
  const sizeKey: Record<ElKey, string> = { title: "titleSize", subtitle: "subtitleSize", body: "bodySize", media: "mediaSize", cta: "" };
  const currentSize = (sizeKey[el] ? cfg[sizeKey[el]] : null) || "md";
  const sizes: { v: SizeKey; l: string }[] = [{ v: "sm", l: "P" }, { v: "md", l: "M" }, { v: "lg", l: "G" }, { v: "xl", l: "XG" }];
  return (
    <div className="rounded-xl border border-border bg-background p-3 text-xs space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{labels[el]}</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
      </div>
      {sizeKey[el] && (
        <div>
          <Label className="text-[11px]">Tamanho</Label>
          <div className="mt-1 flex gap-1">
            {sizes.map((s) => (
              <button
                key={s.v}
                onClick={() => onChange({ [sizeKey[el]]: s.v })}
                className={`flex-1 px-2 py-1.5 rounded-lg border text-[11px] font-semibold transition ${currentSize === s.v ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"}`}
              >{s.l}</button>
            ))}
          </div>
        </div>
      )}
      {el === "media" && (
        <div>
          <Label className="text-[11px]">Posição</Label>
          <div className="mt-1 flex gap-1">
            {[{ v: "above", l: "Acima" }, { v: "below", l: "Abaixo" }].map((o) => (
              <button key={o.v} onClick={() => onChange({ mediaPosition: o.v })} className={`flex-1 px-2 py-1.5 rounded-lg border text-[11px] font-semibold ${((cfg.mediaPosition ?? "above") === o.v) ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{o.l}</button>
            ))}
          </div>
          {(typeof cfg.mediaWidthPct === "number" || typeof cfg.mediaHeight === "number") && (
            <button
              onClick={() => onChange({ mediaWidthPct: null, mediaHeight: null })}
              className="mt-2 w-full px-2 py-1.5 rounded-lg border border-border text-[11px] hover:bg-secondary"
            >Restaurar tamanho</button>
          )}
          <p className="mt-2 text-[10px] text-muted-foreground">Arraste as alças no preview para redimensionar livremente.</p>
        </div>
      )}
      {el === "subtitle" && (
        <div>
          <Label className="text-[11px]">Posição</Label>
          <div className="mt-1 flex gap-1">
            {[{ v: "above", l: "Acima" }, { v: "below", l: "Abaixo" }].map((o) => (
              <button key={o.v} onClick={() => onChange({ subtitlePosition: o.v })} className={`flex-1 px-2 py-1.5 rounded-lg border text-[11px] font-semibold ${((cfg.subtitlePosition ?? "below") === o.v) ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{o.l}</button>
            ))}
          </div>
        </div>
      )}
      {(el === "title" || el === "subtitle" || el === "body") && (
        <div>
          <Label className="text-[11px]">Alinhamento</Label>
          <div className="mt-1 flex gap-1">
            {[{ v: "left", l: "←" }, { v: "center", l: "↔" }, { v: "right", l: "→" }].map((o) => (
              <button key={o.v} onClick={() => onChange({ align: o.v })} className={`flex-1 px-2 py-1.5 rounded-lg border text-[11px] font-semibold ${((cfg.align ?? "left") === o.v) ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{o.l}</button>
            ))}
          </div>
        </div>
      )}
      {el === "cta" && (
        <div className="space-y-2">
          <div>
            <Label className="text-[11px]">Texto do botão</Label>
            <Input className="mt-1 h-8 text-xs" value={cfg.cta ?? ""} onChange={(e) => onChange({ cta: e.target.value })} placeholder="Continuar" />
          </div>
          <div>
            <Label className="text-[11px]">Estilo</Label>
            <div className="mt-1 flex gap-1">
              {[{ v: "solid", l: "Sólido" }, { v: "outline", l: "Contorno" }, { v: "ghost", l: "Discreto" }].map((o) => (
                <button key={o.v} onClick={() => onChange({ buttonStyle: o.v })} className={`flex-1 px-2 py-1.5 rounded-lg border text-[11px] font-semibold ${((cfg.buttonStyle ?? "solid") === o.v) ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{o.l}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResizeHandles({ cfg, onChange }: { cfg: any; onChange: (patch: any) => void }) {
  function startDrag(axis: "x" | "y" | "xy") {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const el = (e.currentTarget as HTMLElement).parentElement as HTMLElement;
      const parent = el.parentElement as HTMLElement;
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = el.offsetWidth;
      const startH = el.offsetHeight;
      const parentW = parent.offsetWidth || 1;
      let nextPct = typeof cfg.mediaWidthPct === "number" ? cfg.mediaWidthPct : (startW / parentW) * 100;
      let nextH = typeof cfg.mediaHeight === "number" ? cfg.mediaHeight : startH;
      function onMove(ev: MouseEvent) {
        if (axis === "x" || axis === "xy") {
          const w = Math.max(40, Math.min(parentW, startW + (ev.clientX - startX)));
          nextPct = Math.round((w / parentW) * 100);
          el.style.width = `${nextPct}%`;
        }
        if (axis === "y" || axis === "xy") {
          nextH = Math.max(40, Math.min(600, startH + (ev.clientY - startY)));
          el.style.height = `${nextH}px`;
        }
      }
      function onUp() {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        const patch: any = {};
        if (axis === "x" || axis === "xy") patch.mediaWidthPct = nextPct;
        if (axis === "y" || axis === "xy") patch.mediaHeight = nextH;
        onChange(patch);
      }
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };
  }
  const base = "absolute bg-primary border border-background shadow rounded-full z-10";
  return (
    <>
      <div onMouseDown={startDrag("x")} onClick={(e) => e.stopPropagation()} className={`${base} w-2.5 h-2.5 right-[-5px] top-1/2 -translate-y-1/2 cursor-ew-resize`} />
      <div onMouseDown={startDrag("y")} onClick={(e) => e.stopPropagation()} className={`${base} w-2.5 h-2.5 bottom-[-5px] left-1/2 -translate-x-1/2 cursor-ns-resize`} />
      <div onMouseDown={startDrag("xy")} onClick={(e) => e.stopPropagation()} className={`${base} w-3 h-3 right-[-6px] bottom-[-6px] cursor-nwse-resize`} />
    </>
  );
}
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { ChevronLeft, GripVertical, Plus, Trash2, Eye, Globe, Copy, Upload, X, Save, CheckCircle, Settings } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/funis/$id/editar")({
  component: EditFunnel,
  validateSearch: (search: Record<string, unknown>) => ({
    settings: search.settings === "open" ? "open" : undefined,
  }),
});

type Step = { id: string; type: string; order: number; config: any; funnel_id: string };
type Funnel = { id: string; name: string; slug: string; status: string; gtm_id: string | null; meta_pixel_id: string | null; theme: any };
type ClinicProfile = { clinic_name: string | null; clinic_logo_url: string | null; instagram_url: string | null };

export type QuizOption = { label: string; action: "continue" | "disqualify" | "jump"; targetStepId?: string };

export function normalizeOptions(raw: any): QuizOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o) => {
      if (typeof o === "string") return { label: o, action: "continue" as const };
      if (o && typeof o === "object" && typeof o.label === "string") {
        const action = o.action === "disqualify" || o.action === "jump" ? o.action : "continue";
        return { label: o.label, action, targetStepId: o.targetStepId };
      }
      return null;
    })
    .filter(Boolean) as QuizOption[];
}

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
  const { settings: settingsParam } = Route.useSearch();
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [clinic, setClinic] = useState<ClinicProfile>({ clinic_name: null, clinic_logo_url: null, instagram_url: null });
  const [steps, setSteps] = useState<Step[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "modified">("saved");
  const [slugDraft, setSlugDraft] = useState("");
  const [slugError, setSlugError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    if (settingsParam === "open") setSettingsOpen(true);
  }, [settingsParam]);

  async function load() {
    const { data: f } = await supabase.from("funnels").select("id, name, slug, status, gtm_id, meta_pixel_id, theme").eq("id", id).maybeSingle();
    const { data: s } = await supabase.from("funnel_steps").select("*").eq("funnel_id", id).order("order", { ascending: true });
    const { data: u } = await supabase.auth.getUser();
    if (u?.user) {
      const { data: p } = await supabase.from("profiles").select("clinic_name, clinic_logo_url, instagram_url").eq("id", u.user.id).maybeSingle();
      if (p) setClinic({ clinic_name: (p as any).clinic_name ?? null, clinic_logo_url: (p as any).clinic_logo_url ?? null, instagram_url: (p as any).instagram_url ?? null });
    }
    setFunnel(f as Funnel | null);
    setSlugDraft((f as Funnel | null)?.slug ?? "");
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
    setSaveStatus("modified");
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, ...patch } : s)));
    const { error } = await supabase.from("funnel_steps").update(patch).eq("id", stepId);
    if (error) {
      toast.error(error.message);
      setSaveStatus("modified");
    } else {
      setSaveStatus("saved");
    }
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
    setSaveStatus("modified");
    setFunnel({ ...funnel, ...patch });
    const { error } = await supabase.from("funnels").update(patch).eq("id", funnel.id);
    if (error) {
      toast.error(error.message);
      setSaveStatus("modified");
    } else {
      setSaveStatus("saved");
    }
  }

  async function updateThankYou(patch: Record<string, any>) {
    if (!funnel) return;
    const currentTheme = (funnel.theme && typeof funnel.theme === "object") ? funnel.theme : {};
    const currentTy = (currentTheme as any).thankYou && typeof (currentTheme as any).thankYou === "object" ? (currentTheme as any).thankYou : {};
    const nextTheme = { ...currentTheme, thankYou: { ...currentTy, ...patch } };
    await updateFunnel({ theme: nextTheme });
  }

  async function updateClinic(patch: Partial<ClinicProfile>) {
    setSaveStatus("modified");
    setClinic((prev) => ({ ...prev, ...patch }));
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) { setSaveStatus("modified"); return; }
    const { error } = await supabase.from("profiles").update(patch).eq("id", u.user.id);
    if (error) {
      toast.error(error.message);
      setSaveStatus("modified");
    } else {
      setSaveStatus("saved");
    }
  }

  function normalizeSlug(raw: string) {
    return raw
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async function saveSlug() {
    if (!funnel) return;
    const next = normalizeSlug(slugDraft);
    if (!next) {
      setSlugError("Informe ao menos 1 caractere válido.");
      setSlugDraft(funnel.slug);
      return;
    }
    if (next.length < 3 || next.length > 60) {
      setSlugError("Use entre 3 e 60 caracteres.");
      return;
    }
    if (next === funnel.slug) {
      setSlugError(null);
      setSlugDraft(next);
      return;
    }
    const { data: existing } = await supabase.from("funnels").select("id").eq("slug", next).maybeSingle();
    if (existing && existing.id !== funnel.id) {
      setSlugError("Esta URL já está em uso. Escolha outra.");
      return;
    }
    setSlugError(null);
    setSlugDraft(next);
    await updateFunnel({ slug: next });
    toast.success("URL pública atualizada!");
  }

  async function saveAll() {
    if (!funnel) return;
    setSaveStatus("saving");
    const promises = [
      supabase.from("funnels").update({ updated_at: new Date().toISOString() }).eq("id", funnel.id),
      ...steps.map((s) => supabase.from("funnel_steps").update({ config: s.config, type: s.type, order: s.order }).eq("id", s.id)),
    ];
    const results = await Promise.all(promises);
    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      toast.error("Erro ao salvar algumas alterações");
      setSaveStatus("modified");
    } else {
      setSaveStatus("saved");
      toast.success(
        <div className="space-y-1">
          <p>Funil salvo com sucesso!</p>
          <a href={publicUrl} target="_blank" rel="noreferrer" className="text-xs underline text-primary">Ver na slug →</a>
        </div>,
        { duration: 4000 }
      );
    }
  }

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!funnel) return <p>Funil não encontrado.</p>;

  const current = steps.find((s) => s.id === selected) ?? null;
  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/f/${funnel.slug}`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="rounded-full" title="Voltar">
            <Link to="/app"><ChevronLeft className="h-5 w-5" strokeWidth={1.5} /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight">{funnel.name}</h1>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  saveStatus === "saved"
                    ? "bg-green-100 text-green-700"
                    : saveStatus === "saving"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-orange-100 text-orange-700"
                }`}
              >
                {saveStatus === "saved" && <CheckCircle className="h-3 w-3" />}
                {saveStatus === "saving" && <Save className="h-3 w-3 animate-pulse" />}
                {saveStatus === "saved" ? "Salvo" : saveStatus === "saving" ? "Salvando..." : "Modificado"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">/{funnel.slug} · {funnel.status}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/app/funis/$id/leads" params={{ id }}>Ver leads capturados</Link>
          </Button>
          {funnel.status === "published" && (
            <a href={publicUrl} target="_blank" rel="noreferrer"><Button variant="outline" size="sm" className="rounded-full"><Eye className="h-4 w-4 mr-1" />Ver público</Button></a>
          )}
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full">
                <Settings className="h-4 w-4 mr-1" />Configurações do funil
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Configurações do funil</DialogTitle>
                <DialogDescription>Personalize o cabeçalho da clínica e configure o rastreamento.</DialogDescription>
              </DialogHeader>

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

              <ThankYouSettings funnel={funnel} onPatch={updateThankYou} />
            </DialogContent>
          </Dialog>
          <Button onClick={saveAll} disabled={saveStatus === "saving"} variant="secondary" className="rounded-full font-semibold" size="sm">
            <Save className="h-4 w-4 mr-1" />{saveStatus === "saving" ? "Salvando..." : "Salvar funil"}
          </Button>
          <Button onClick={togglePublish} className="rounded-full font-semibold" size="sm">
            <Globe className="h-4 w-4 mr-1" />{funnel.status === "published" ? "Despublicar" : "Publicar"}
          </Button>
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
            <StepEditor key={current.id} step={current} steps={steps} onChange={(patch) => updateStep(current.id, patch)} onDelete={() => removeStep(current.id)} onMoveUp={() => move(current.id, -1)} onMoveDown={() => move(current.id, 1)} />
          ) : (
            <p className="text-muted-foreground text-sm">Selecione uma etapa à esquerda ou crie uma nova.</p>
          )}
        </section>

        <aside className="hidden lg:block">
          <div className="sticky top-6">
            <PhonePreview
              step={current}
              clinicName={clinic.clinic_name}
              clinicLogo={clinic.clinic_logo_url}
              onChange={current ? (patch) => updateStep(current.id, { config: { ...current.config, ...patch } }) : undefined}
            />
          </div>
        </aside>
      </div>

    </div>
  );
}

function defaultConfig(type: string): any {
  switch (type) {
    case "text": return { title: "Bem-vindo!", body: "Vamos começar?", cta: "Começar" };
    case "single": return { title: "Escolha uma opção", options: [
      { label: "Opção A", action: "continue" },
      { label: "Opção B", action: "continue" },
      { label: "Opção C", action: "continue" },
    ] };
    case "multiple": return { title: "Selecione todas que se aplicam", options: ["Item 1", "Item 2"], cta: "Continuar" };
    case "input": return { title: "Qual a sua resposta?", placeholder: "Digite aqui...", cta: "Continuar" };
    case "lead": return { title: "Quase lá! Deixe seu contato", cta: "Receber resultado" };
    case "contact": return { title: "Deixe seu contato", cta: "Enviar", namePlaceholder: "Seu nome", phonePlaceholder: "Seu WhatsApp" };
    default: return {};
  }
}

function StepEditor({ step, steps, onChange, onDelete, onMoveUp, onMoveDown }: { step: Step; steps: Step[]; onChange: (patch: Partial<Step>) => void; onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void }) {
  const cfg = step.config ?? {};
  function setCfg(patch: any) { onChange({ config: { ...cfg, ...patch } }); }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 pb-4 border-b border-border">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Label className="text-xs text-muted-foreground shrink-0">Tipo</Label>
          <Select value={step.type} onValueChange={(v) => onChange({ type: v, config: defaultConfig(v) })}>
            <SelectTrigger className="w-full max-w-xs h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{STEP_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onMoveUp} title="Mover para cima">↑</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onMoveDown} title="Mover para baixo">↓</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete} title="Remover etapa"><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      </div>

      <Tabs defaultValue="content" className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="content">Conteúdo</TabsTrigger>
          <TabsTrigger value="media">Mídia</TabsTrigger>
          <TabsTrigger value="style">Estilo</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-4 mt-5">
          <div>
            <Label className="text-xs">Título</Label>
            <Input value={cfg.title ?? ""} onChange={(e) => setCfg({ title: e.target.value })} />
          </div>

          <div>
            <Label className="text-xs">Subtítulo / descrição</Label>
            <Textarea rows={2} value={cfg.subtitle ?? ""} onChange={(e) => setCfg({ subtitle: e.target.value })} placeholder="Texto opcional exibido junto da pergunta" />
          </div>

          {step.type === "text" && (
            <div>
              <Label className="text-xs">Texto</Label>
              <Textarea value={cfg.body ?? ""} onChange={(e) => setCfg({ body: e.target.value })} />
            </div>
          )}

          {step.type === "single" && (
            <SingleOptionsEditor
              options={normalizeOptions(cfg.options)}
              otherSteps={steps.filter((s) => s.id !== step.id)}
              onChange={(opts) => setCfg({ options: opts })}
            />
          )}

          {step.type === "multiple" && (
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
        </TabsContent>

        <TabsContent value="media" className="space-y-4 mt-5">
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
          {(cfg.mediaType === "none" || !cfg.mediaType) && (
            <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border p-4 text-center">
              Selecione um tipo de mídia acima para adicionar imagem ou vídeo.
            </p>
          )}
        </TabsContent>

        <TabsContent value="style" className="space-y-4 mt-5">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SingleOptionsEditor({ options, otherSteps, onChange }: { options: QuizOption[]; otherSteps: Step[]; onChange: (opts: QuizOption[]) => void }) {
  function update(i: number, patch: Partial<QuizOption>) {
    onChange(options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }
  function remove(i: number) {
    onChange(options.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...options, { label: `Opção ${options.length + 1}`, action: "continue" }]);
  }
  return (
    <div>
      <Label className="text-xs">Opções e ações</Label>
      <p className="text-[11px] text-muted-foreground mb-2">Defina o que acontece quando o lead escolhe cada resposta.</p>
      <div className="space-y-2">
        {options.map((o, i) => {
          const badge =
            o.action === "disqualify"
              ? "bg-red-100 text-red-700 border-red-200"
              : o.action === "jump"
              ? "bg-amber-100 text-amber-700 border-amber-200"
              : "bg-green-100 text-green-700 border-green-200";
          const label =
            o.action === "disqualify" ? "Desqualifica" : o.action === "jump" ? "Pula etapa" : "Continua";
          return (
            <div key={i} className="rounded-lg border border-border p-2 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={o.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                  placeholder={`Opção ${i + 1}`}
                  className="h-8 text-sm"
                />
                <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge}`}>{label}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => remove(i)} title="Remover">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-[11px] text-muted-foreground shrink-0">Se escolher:</Label>
                <Select
                  value={o.action}
                  onValueChange={(v) => update(i, { action: v as QuizOption["action"], targetStepId: v === "jump" ? o.targetStepId : undefined })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="continue">Continuar para próxima etapa</SelectItem>
                    <SelectItem value="disqualify">Desqualificar → Instagram da clínica</SelectItem>
                    <SelectItem value="jump">Pular para etapa específica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {o.action === "jump" && (
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] text-muted-foreground shrink-0">Ir para:</Label>
                  <Select
                    value={o.targetStepId ?? ""}
                    onValueChange={(v) => update(i, { targetStepId: v })}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione uma etapa" /></SelectTrigger>
                    <SelectContent>
                      {otherSteps.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Sem outras etapas</div>}
                      {otherSteps.map((s, idx) => (
                        <SelectItem key={s.id} value={s.id}>
                          Etapa: {s.config?.title || `#${idx + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          );
        })}
        {options.length === 0 && (
          <p className="text-[11px] text-muted-foreground rounded-lg border border-dashed border-border p-3 text-center">Nenhuma opção. Clique abaixo para adicionar.</p>
        )}
      </div>
      <Button variant="outline" size="sm" className="mt-2 rounded-full" onClick={add}>
        <Plus className="h-3.5 w-3.5 mr-1" />Adicionar opção
      </Button>
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
      (() => {
        const url = cfg.mediaUrl as string;
        const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
        if (yt) {
          return (
            <iframe
              src={`https://www.youtube.com/embed/${yt[1]}`}
              className="w-full h-full rounded-lg block"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          );
        }
        const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
        if (vimeo) {
          return (
            <iframe
              src={`https://player.vimeo.com/video/${vimeo[1]}`}
              className="w-full h-full rounded-lg block"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          );
        }
        return (
          <video src={url} controls className="w-full h-full object-cover rounded-lg block bg-black" />
        );
      })()
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
                  {(cfg.options ?? []).map((o: any, i: number) => {
                    const label = typeof o === "string" ? o : o?.label ?? "";
                    const action = typeof o === "object" ? o?.action : "continue";
                    return (
                      <div key={i} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border border-border text-[11px]">
                        <span className="truncate">{label}</span>
                        {action === "disqualify" && <span className="shrink-0 text-[9px] font-semibold text-red-600">✕</span>}
                        {action === "jump" && <span className="shrink-0 text-[9px] font-semibold text-amber-600">↪</span>}
                      </div>
                    );
                  })}
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

function ThankYouSettings({ funnel, onPatch }: { funnel: Funnel; onPatch: (patch: Record<string, any>) => void }) {
  const ty = ((funnel.theme && (funnel.theme as any).thankYou) || {}) as Record<string, any>;
  const [local, setLocal] = useState<Record<string, any>>(ty);
  useEffect(() => { setLocal(ty); /* eslint-disable-next-line */ }, [funnel.id]);
  const set = (k: string, v: any) => setLocal((p) => ({ ...p, [k]: v }));
  const blur = (k: string, v: any) => onPatch({ [k]: typeof v === "string" ? v.trim() || null : v });
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Tela final · WhatsApp</p>
      <p className="text-[11px] text-muted-foreground mb-3">Aparece após o lead concluir o funil. O número do WhatsApp é obrigatório para liberar o botão de agendamento.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <Label className="text-xs">WhatsApp da clínica <span className="text-destructive">*</span></Label>
          <Input
            value={local.whatsappNumber ?? ""}
            onChange={(e) => set("whatsappNumber", e.target.value)}
            onBlur={(e) => blur("whatsappNumber", e.target.value.replace(/\D/g, ""))}
            placeholder="5511999999999 (com DDI + DDD)"
          />
          <p className="text-[11px] text-muted-foreground mt-1">Formato internacional, só números. Ex: 55 11 99999-9999 → <code>5511999999999</code>.</p>
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Mensagem pré-preenchida</Label>
          <Textarea
            value={local.whatsappMessage ?? ""}
            onChange={(e) => set("whatsappMessage", e.target.value)}
            onBlur={(e) => blur("whatsappMessage", e.target.value)}
            placeholder="Olá! Sou {nome} e acabei de preencher o formulário, gostaria de agendar minha avaliação."
            rows={2}
          />
          <p className="text-[11px] text-muted-foreground mt-1">Use <code>{"{nome}"}</code> e <code>{"{clinica}"}</code> para personalizar.</p>
        </div>
        <div>
          <Label className="text-xs">Título de boas-vindas</Label>
          <Input
            value={local.greetingTitle ?? ""}
            onChange={(e) => set("greetingTitle", e.target.value)}
            onBlur={(e) => blur("greetingTitle", e.target.value)}
            placeholder="Solicitação Recebida, {nome}!"
          />
        </div>
        <div>
          <Label className="text-xs">Texto do botão</Label>
          <Input
            value={local.ctaLabel ?? ""}
            onChange={(e) => set("ctaLabel", e.target.value)}
            onBlur={(e) => blur("ctaLabel", e.target.value)}
            placeholder="Iniciar Agendamento no WhatsApp"
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Subtítulo</Label>
          <Input
            value={local.greetingSubtitle ?? ""}
            onChange={(e) => set("greetingSubtitle", e.target.value)}
            onBlur={(e) => blur("greetingSubtitle", e.target.value)}
            placeholder="Seu perfil foi pré-aprovado para uma consulta avaliativa em nossa unidade."
          />
        </div>
        <div>
          <Label className="text-xs">Nome do(a) atendente</Label>
          <Input
            value={local.attendantName ?? ""}
            onChange={(e) => set("attendantName", e.target.value)}
            onBlur={(e) => blur("attendantName", e.target.value)}
            placeholder="Ex: Roberta Silva"
          />
        </div>
        <div>
          <Label className="text-xs">Cargo</Label>
          <Input
            value={local.attendantRole ?? ""}
            onChange={(e) => set("attendantRole", e.target.value)}
            onBlur={(e) => blur("attendantRole", e.target.value)}
            placeholder="Consultora Online"
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Foto do(a) atendente (URL)</Label>
          <Input
            value={local.attendantPhotoUrl ?? ""}
            onChange={(e) => set("attendantPhotoUrl", e.target.value)}
            onBlur={(e) => blur("attendantPhotoUrl", e.target.value)}
            placeholder="https://..."
          />
        </div>
        <div>
          <Label className="text-xs">Tempo médio de resposta</Label>
          <Input
            value={local.responseTime ?? ""}
            onChange={(e) => set("responseTime", e.target.value)}
            onBlur={(e) => blur("responseTime", e.target.value)}
            placeholder="Tempo médio: 2 min"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Nota</Label>
            <Input
              value={local.rating ?? ""}
              onChange={(e) => set("rating", e.target.value)}
              onBlur={(e) => blur("rating", e.target.value)}
              placeholder="4.9"
            />
          </div>
          <div>
            <Label className="text-xs">Origem</Label>
            <Input
              value={local.reviewsLabel ?? ""}
              onChange={(e) => set("reviewsLabel", e.target.value)}
              onBlur={(e) => blur("reviewsLabel", e.target.value)}
              placeholder="Google Reviews"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
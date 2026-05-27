import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, GripVertical, Plus, Trash2, Eye, Globe, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/funis/$id/editar")({
  component: EditFunnel,
});

type Step = { id: string; type: string; order: number; config: any; funnel_id: string };
type Funnel = { id: string; name: string; slug: string; status: string };

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
    const { data: f } = await supabase.from("funnels").select("id, name, slug, status").eq("id", id).maybeSingle();
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

  async function togglePublish() {
    if (!funnel) return;
    const status = funnel.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("funnels").update({ status }).eq("id", funnel.id);
    if (error) return toast.error(error.message);
    setFunnel({ ...funnel, status });
    toast.success(status === "published" ? "Funil publicado!" : "Despublicado");
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

      <div className="grid lg:grid-cols-[280px_1fr_320px] gap-6">
        {/* Steps list */}
        <aside className="rounded-2xl border border-border bg-background p-4">
          <div className="text-xs font-semibold uppercase text-muted-foreground mb-3">Etapas</div>
          <div className="space-y-1.5">
            {steps.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition ${selected === s.id ? "bg-primary/10 text-primary" : "hover:bg-secondary"}`}
              >
                <GripVertical className="h-3.5 w-3.5 opacity-50" />
                <span className="font-medium">{i + 1}.</span>
                <span className="truncate flex-1">{s.config?.title || STEP_TYPES.find((t) => t.value === s.type)?.label}</span>
              </button>
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
            <PhonePreview step={current} />
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
            onChange={(e) => setCfg({ options: e.target.value.split("\n").map((s: string) => s.trim()).filter(Boolean) })}
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

        {(cfg.mediaType === "image" || cfg.mediaType === "video") && (
          <div>
            <Label className="text-xs">URL da mídia</Label>
            <Input value={cfg.mediaUrl ?? ""} onChange={(e) => setCfg({ mediaUrl: e.target.value })} placeholder="https://..." />
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

function PhonePreview({ step }: { step: Step | null }) {
  const cfg = step?.config ?? {};
  const align = cfg.align === "center" ? "text-center" : cfg.align === "right" ? "text-right" : "text-left";
  const btnCls =
    cfg.buttonStyle === "outline"
      ? "mt-auto px-3 py-2 rounded-full border-2 border-primary text-primary text-[11px] font-semibold text-center"
      : cfg.buttonStyle === "ghost"
      ? "mt-auto px-3 py-2 rounded-full text-primary text-[11px] font-semibold text-center"
      : "mt-auto px-3 py-2 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold text-center";

  const media = cfg.mediaUrl ? (
    cfg.mediaType === "image" ? (
      <img src={cfg.mediaUrl} alt="" className="w-full h-20 object-cover rounded-lg" />
    ) : cfg.mediaType === "video" ? (
      <div className="w-full h-20 rounded-lg bg-foreground/10 flex items-center justify-center text-[10px] text-muted-foreground">▶ vídeo</div>
    ) : null
  ) : null;
  const subtitle = cfg.subtitle ? <p className="text-[10px] text-muted-foreground mt-1">{cfg.subtitle}</p> : null;
  const mediaAbove = cfg.mediaPosition !== "below";
  const subtitleAbove = cfg.subtitlePosition === "above";

  return (
    <div className="mx-auto w-[260px] aspect-[9/19] rounded-[2.5rem] border-8 border-foreground shadow-card p-4 overflow-hidden" style={{ backgroundColor: cfg.bgColor || undefined }}>
      <div className={`h-full flex flex-col ${align}`}>
        <div className="h-1.5 w-16 bg-foreground/20 rounded-full mx-auto mb-4" />
        {!step ? (
          <p className="text-xs text-muted-foreground text-center mt-10">Sem etapa selecionada</p>
        ) : (
          <div className="flex-1 flex flex-col">
            {mediaAbove && media && <div className="mb-2">{media}</div>}
            {subtitleAbove && subtitle}
            <h3 className="text-sm font-bold">{cfg.title}</h3>
            {!subtitleAbove && subtitle}
            {!mediaAbove && media && <div className="mt-2">{media}</div>}
            {step.type === "text" && cfg.body && <p className="text-xs text-muted-foreground mt-2">{cfg.body}</p>}
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
            <div className={btnCls}>{cfg.cta || "Continuar"}</div>
          </div>
        )}
      </div>
    </div>
  );
}
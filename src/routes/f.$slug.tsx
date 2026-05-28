import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPublicFunnel, submitLead, trackStep, upsertPartialLead } from "@/lib/funnels.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

type Step = { id: string; type: string; config: any; order: number };
type FunnelData = { id: string; name: string; clinic_name: string | null; clinic_logo_url: string | null; instagram_url: string | null; gtm_id: string | null; meta_pixel_id: string | null; theme?: any };
type LeadData = { name?: string; email?: string; phone?: string };

function ThankYouScreen({ funnel, lead }: { funnel: FunnelData; lead: LeadData }) {
  const ty = (funnel.theme as any)?.thankYou ?? {};
  const firstName = (lead.name || "").trim().split(" ")[0] || "";
  const clinic = funnel.clinic_name || "nossa equipe";
  const attendantName: string = ty.attendantName || funnel.clinic_name || "Atendimento";
  const attendantRole: string = ty.attendantRole || "Consultora Online";
  const attendantPhoto: string | null = ty.attendantPhotoUrl || funnel.clinic_logo_url || null;
  const responseTime: string = ty.responseTime || "Tempo médio: 2 min";
  const rating: string = String(ty.rating || "4.9");
  const reviewsLabel: string = ty.reviewsLabel || "Google Reviews";
  const greetingTitle: string = (ty.greetingTitle || "Solicitação Recebida, {nome}!").replace(/\{nome\}/gi, firstName || "tudo certo");
  const greetingSubtitle: string = (ty.greetingSubtitle || "Seu perfil foi pré-aprovado para uma consulta avaliativa em nossa unidade.").replace(/\{clinica\}/gi, clinic);
  const ctaLabel: string = ty.ctaLabel || "Iniciar Agendamento no WhatsApp";

  const rawNumber: string = (ty.whatsappNumber || "").replace(/\D/g, "");
  const messageTpl: string = ty.whatsappMessage || "Olá! Sou {nome} e acabei de preencher o formulário, gostaria de agendar minha avaliação.";
  const message = messageTpl.replace(/\{nome\}/gi, firstName).replace(/\{clinica\}/gi, clinic);
  const waHref = rawNumber
    ? `https://wa.me/${rawNumber}?text=${encodeURIComponent(message)}`
    : null;

  const steps = [
    { title: "Triagem Concluída", desc: "Analisamos seus dados e priorizamos seu contato.", done: true },
    { title: "Acesso ao WhatsApp", desc: "Clique no botão abaixo para falar com nossa recepção.", done: false, active: true },
    { title: "Agendamento Presencial", desc: "Confirmação final de data e horário da avaliação.", done: false },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 p-4">
      <div className="max-w-[640px] w-full bg-background rounded-3xl shadow-2xl shadow-slate-200/60 overflow-hidden border border-border">
        {/* Header */}
        <div className="px-6 sm:px-8 pt-6 pb-5 flex justify-between items-center border-b border-border/60 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {funnel.clinic_logo_url ? (
              <img src={funnel.clinic_logo_url} alt={funnel.clinic_name ?? "logo"} className="h-9 w-9 rounded-lg object-cover border border-border" />
            ) : (
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04m17.236 0a11.959 11.959 0 01-2.251 7.161 11.952 11.952 0 01-6.367 4.511 11.945 11.945 0 01-6.367-4.511 11.959 11.959 0 01-2.251-7.161" /></svg>
              </div>
            )}
            {funnel.clinic_name && <span className="font-bold text-foreground tracking-tight text-base sm:text-lg truncate">{funnel.clinic_name}</span>}
          </div>
          <div className="flex items-center gap-1.5 bg-green-50 px-3 py-1 rounded-full shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-[10px] font-bold text-green-700 uppercase tracking-widest">Atendimento ativo</span>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {/* Greeting */}
          <div className="mb-8 text-center">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2 tracking-tight">{greetingTitle}</h1>
            <p className="text-muted-foreground text-sm sm:text-base">{greetingSubtitle}</p>
          </div>

          {/* Timeline */}
          <div className="space-y-5 relative mb-8">
            <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-border" />
            {steps.map((s, i) => (
              <div key={i} className={`relative flex gap-4 items-start ${!s.active && !s.done ? "opacity-40" : ""}`}>
                <div className={`z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${s.done ? "bg-primary shadow-lg shadow-primary/20" : s.active ? "bg-background border-2 border-primary" : "bg-muted border-2 border-border"}`}>
                  {s.done ? (
                    <svg className="w-5 h-5 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <span className={`font-bold ${s.active ? "text-primary" : "text-muted-foreground"}`}>{i + 1}</span>
                  )}
                </div>
                <div className="pt-1">
                  <h3 className="font-bold text-foreground leading-tight">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Attendant card */}
          <div className="bg-secondary/60 rounded-2xl p-4 mb-6 border border-border flex items-center justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative w-14 h-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                {attendantPhoto ? (
                  <img src={attendantPhoto} alt={attendantName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground font-bold text-lg">{attendantName.charAt(0)}</div>
                )}
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-background rounded-full" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{attendantRole}</p>
                <p className="font-bold text-foreground truncate">{attendantName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                  <span className="text-xs text-muted-foreground font-medium">{responseTime}</span>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          {waHref ? (
            <a href={waHref} target="_blank" rel="noopener noreferrer" className="group w-full bg-[#25D366] hover:bg-[#1ebe57] transition-all duration-300 py-5 rounded-2xl shadow-xl shadow-green-100 flex items-center justify-center gap-3 cursor-pointer">
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
              <span className="text-white font-bold text-base sm:text-lg">{ctaLabel}</span>
            </a>
          ) : (
            <div className="w-full py-4 rounded-2xl border-2 border-dashed border-border text-center text-sm text-muted-foreground">
              Configure o WhatsApp da clínica para liberar o agendamento.
            </div>
          )}

          {/* Trust footnote */}
          <div className="mt-6 flex flex-wrap justify-between items-center gap-3 px-1">
            <div className="flex items-center gap-1.5">
              <div className="flex text-amber-400 gap-0.5">
                {[0,1,2,3,4].map((i) => (
                  <svg key={i} className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                ))}
              </div>
              <span className="text-[11px] font-bold text-foreground">{rating}/5 {reviewsLabel}</span>
            </div>
            <div className="flex items-center gap-1.5 border-l border-border pl-4">
              <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04m17.236 0a11.959 11.959 0 01-2.251 7.161 11.952 11.952 0 01-6.367 4.511 11.945 11.945 0 01-6.367-4.511 11.959 11.959 0 01-2.251-7.161" /></svg>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Dados criptografados</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 py-3 px-8">
          <p className="text-[9px] text-slate-400 text-center uppercase tracking-[0.2em] font-medium">Sessão exclusiva • Resposta prioritária</p>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/f/$slug")({
  loader: async ({ params }) => {
    const res = await getPublicFunnel({ data: { slug: params.slug } });
    if (!res.funnel) throw notFound();
    return res;
  },
  component: PublicFunnel,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold">Funil não encontrado</h1>
        <p className="text-muted-foreground mt-2">Verifique o link ou se o funil está publicado.</p>
      </div>
    </div>
  ),
});

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)})${digits.slice(2)}`;
  return `(${digits.slice(0, 2)})${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

function PublicFunnel() {
  const { funnel, steps } = Route.useLoaderData() as { funnel: { id: string; name: string; clinic_name: string | null; clinic_logo_url: string | null; instagram_url: string | null; gtm_id: string | null; meta_pixel_id: string | null }; steps: Step[] };
  const submit = useServerFn(submitLead);
  const track = useServerFn(trackStep);
  const savePartial = useServerFn(upsertPartialLead);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [lead, setLead] = useState<{ name?: string; email?: string; phone?: string }>({});
  const [done, setDone] = useState(false);
  const sessionId = useMemo(() => genId(), []);

  // Inject GTM + Meta Pixel once
  useEffect(() => {
    if (typeof window === "undefined" || !funnel) return;
    const w = window as any;
    if (funnel.gtm_id && !w.__gtmLoaded) {
      w.__gtmLoaded = true;
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(funnel.gtm_id)}`;
      document.head.appendChild(s);
    }
    if (funnel.meta_pixel_id && !w.__fbqLoaded) {
      w.__fbqLoaded = true;
      // Meta Pixel base code
      (function (f: any, b: any, e: any, v: any) {
        if (f.fbq) return;
        const n: any = (f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        });
        if (!f._fbq) f._fbq = n;
        n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
        const t = b.createElement(e); t.async = true; t.src = v;
        const s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
      })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      w.fbq("init", funnel.meta_pixel_id);
      w.fbq("track", "PageView");
    }
  }, [funnel]);

  function fireEvent(name: "ViewContent" | "Lead" | "CompleteRegistration", payload?: Record<string, unknown>) {
    if (typeof window === "undefined") return;
    const w = window as any;
    if (w.fbq) w.fbq("track", name, payload ?? {});
    if (w.dataLayer) w.dataLayer.push({ event: `funnel_${name.toLowerCase()}`, funnel_id: funnel?.id, ...payload });
  }

  useEffect(() => {
    if (!funnel) return;
    track({ data: { funnelId: funnel.id, sessionId, stepIndex: index } }).catch(() => {});
    if (index === 1) fireEvent("ViewContent");
  }, [index, funnel, sessionId, track]);

  if (!steps.length) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-muted-foreground">Este funil ainda não tem etapas.</p>
      </div>
    );
  }

  async function finish(finalAnswers: Record<string, unknown>, finalLead: typeof lead) {
    await submit({ data: { funnelId: funnel.id, sessionId, answers: finalAnswers, ...finalLead } });
    await track({ data: { funnelId: funnel.id, sessionId, stepIndex: index, completed: true } }).catch(() => {});
    fireEvent("CompleteRegistration");
    setDone(true);
  }

  const step = steps[index];
  const isLast = index === steps.length - 1;
  const progress = ((index + 1) / steps.length) * 100;

  function next(extra?: Record<string, unknown>, leadExtra?: typeof lead) {
    const a = { ...answers, ...(extra ?? {}) };
    const l = { ...lead, ...(leadExtra ?? {}) };
    setAnswers(a);
    if (leadExtra) {
      setLead(l);
      fireEvent("Lead");
    }
    if (isLast) {
      finish(a, l);
    } else {
      // Salva lead parcial assim que houver qualquer informação capturável
      const hasContact = !!(l.name || l.phone || l.email);
      const hasAnswers = Object.keys(a).length > 0;
      if (hasContact || hasAnswers) {
        savePartial({
          data: {
            funnelId: funnel.id,
            sessionId,
            stepIndex: index + 1,
            answers: a,
            name: l.name,
            email: l.email,
            phone: l.phone,
          },
        }).catch(() => {});
      }
      setIndex(index + 1);
    }
  }

  function jumpToStep(stepId: string) {
    const i = steps.findIndex((s) => s.id === stepId);
    if (i >= 0) setIndex(i);
    else setIndex(Math.min(index + 1, steps.length - 1));
  }

  function disqualify() {
    const url = funnel.instagram_url?.trim();
    if (url) {
      const full = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      window.location.href = full;
    } else {
      // sem instagram configurado: encerra o funil
      setDone(true);
    }
  }

  if (done) {
    return <ThankYouScreen funnel={funnel} lead={lead} />;
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      {(funnel.clinic_name || funnel.clinic_logo_url) && (
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
          <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
            {funnel.clinic_logo_url && (
              <img src={funnel.clinic_logo_url} alt={funnel.clinic_name ?? "logo"} className="h-10 w-10 rounded-full object-cover border border-border" />
            )}
            {funnel.clinic_name && <span className="font-semibold tracking-tight">{funnel.clinic_name}</span>}
          </div>
        </header>
      )}
      <div className="max-w-xl mx-auto py-10 px-4">
        <Progress value={progress} className="mb-6" />
        <div
          className="rounded-3xl bg-background border border-border shadow-soft p-8"
          style={step.config?.bgColor ? { backgroundColor: step.config.bgColor } : undefined}
        >
          <StepView step={step} onNext={next} onJump={jumpToStep} onDisqualify={disqualify} isLast={isLast} />
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">Etapa {index + 1} de {steps.length}</p>
      </div>
    </div>
  );
}

type QuizOpt = { label: string; action: "continue" | "disqualify" | "jump"; targetStepId?: string };
function normalizeOpts(raw: any): QuizOpt[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((o) => {
    if (typeof o === "string") return { label: o, action: "continue" as const };
    if (o && typeof o === "object" && typeof o.label === "string") {
      const action = o.action === "disqualify" || o.action === "jump" ? o.action : "continue";
      return { label: o.label, action, targetStepId: o.targetStepId };
    }
    return null;
  }).filter(Boolean) as QuizOpt[];
}

function StepView({ step, onNext, onJump, onDisqualify, isLast }: { step: Step; onNext: (a?: Record<string, unknown>, l?: { name?: string; email?: string; phone?: string }) => void; onJump: (stepId: string) => void; onDisqualify: () => void; isLast: boolean }) {
  const cfg = step.config ?? {};
  const key = `step_${step.id}`;
  const [value, setValue] = useState<any>("");
  const [lead, setLead] = useState({ name: "", email: "", phone: "" });

  const delaySec = Math.max(0, Number(cfg.ctaDelaySeconds) || 0);
  const [ctaReady, setCtaReady] = useState(delaySec === 0);
  const [remaining, setRemaining] = useState(delaySec);
  useEffect(() => {
    setCtaReady(delaySec === 0);
    setRemaining(delaySec);
    if (delaySec === 0) return;
    const startedAt = Date.now();
    const tick = setInterval(() => {
      const left = Math.max(0, delaySec - Math.floor((Date.now() - startedAt) / 1000));
      setRemaining(left);
      if (left === 0) {
        setCtaReady(true);
        clearInterval(tick);
      }
    }, 250);
    return () => clearInterval(tick);
  }, [step.id, delaySec]);

  function Cta({ disabled, onClick, children }: { disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
    if (!ctaReady) {
      return (
        <p className="mt-6 text-center text-sm text-muted-foreground animate-pulse">
          Assista ao vídeo para liberar o próximo passo{remaining > 0 ? ` (${remaining}s)` : ""}…
        </p>
      );
    }
    return (
      <Button className={`${btnClass} animate-in fade-in duration-500`} disabled={disabled} onClick={onClick}>
        {children}
      </Button>
    );
  }

  const align = cfg.align === "center" ? "text-center" : cfg.align === "right" ? "text-right" : "text-left";
  const titleSize = ({ sm: "text-lg", md: "text-2xl", lg: "text-3xl", xl: "text-4xl" } as Record<string, string>)[cfg.titleSize ?? "md"] ?? "text-2xl";
  const subtitleSizeCls = ({ sm: "text-xs", md: "text-sm", lg: "text-base", xl: "text-lg" } as Record<string, string>)[cfg.subtitleSize ?? "md"] ?? "text-sm";
  const bodySizeCls = ({ sm: "text-sm", md: "text-base", lg: "text-lg", xl: "text-xl" } as Record<string, string>)[cfg.bodySize ?? "md"] ?? "text-base";
  const mediaMaxH = ({ sm: "max-h-40", md: "max-h-72", lg: "max-h-96", xl: "max-h-[32rem]" } as Record<string, string>)[cfg.mediaSize ?? "md"] ?? "max-h-72";
  const btnClass = cfg.buttonStyle === "outline"
    ? "mt-6 rounded-full w-full font-semibold border-2 border-primary bg-transparent text-primary hover:bg-primary/5"
    : cfg.buttonStyle === "ghost"
    ? "mt-6 rounded-full w-full font-semibold bg-transparent text-primary hover:bg-primary/10"
    : "mt-6 rounded-full w-full font-semibold";

  const media = useMemo(() => {
    if (!cfg.mediaUrl) return null;
    const hasW = typeof cfg.mediaWidthPct === "number";
    const hasH = typeof cfg.mediaHeight === "number";
    const style: React.CSSProperties = {
      width: hasW ? `${cfg.mediaWidthPct}%` : undefined,
      height: hasH ? `${cfg.mediaHeight}px` : undefined,
    };
    const hCls = hasH ? "" : mediaMaxH;
    if (cfg.mediaType === "image") {
      return <img src={cfg.mediaUrl} alt="" style={style} className={`${hasW ? "" : "w-full"} rounded-2xl object-cover ${hCls} mb-4`} />;
    }
    if (cfg.mediaType === "video") {
      const url: string = cfg.mediaUrl;
      const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
      if (yt) {
        return (
          <div style={style} className={`${hasW ? "" : "w-full"} ${hasH ? "" : "aspect-video"} mb-4 rounded-2xl overflow-hidden`}>
            <iframe src={`https://www.youtube.com/embed/${yt[1]}?autoplay=1&mute=1`} className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen />
          </div>
        );
      }
      return <video src={url} controls autoPlay muted playsInline style={style} className={`${hasW ? "" : "w-full"} rounded-2xl mb-4 ${hCls}`} />;
    }
    return null;
  }, [cfg.mediaUrl, cfg.mediaType, cfg.mediaWidthPct, cfg.mediaHeight, mediaMaxH]);

  const mediaAbove = cfg.mediaPosition !== "below";
  const subtitleAbove = cfg.subtitlePosition === "above";
  const subtitle = cfg.subtitle ? <p className={`text-muted-foreground mt-2 ${subtitleSizeCls}`}>{cfg.subtitle}</p> : null;
  const header = (
    <div className={align}>
      {mediaAbove && media}
      {subtitleAbove && subtitle}
      {cfg.title && <h2 className={`${titleSize} font-black tracking-tight`}>{cfg.title}</h2>}
      {!subtitleAbove && subtitle}
      {!mediaAbove && <div className="mt-4">{media}</div>}
    </div>
  );

  if (step.type === "text") {
    return (
      <div>
        {header}
        {cfg.body && <p className={`mt-3 text-muted-foreground ${bodySizeCls} ${align}`}>{cfg.body}</p>}
        <Cta onClick={() => onNext()}>{cfg.cta || (isLast ? "Enviar" : "Continuar")}</Cta>
      </div>
    );
  }

  if (step.type === "single") {
    const opts = normalizeOpts(cfg.options);
    const selectedLabel: string = typeof value === "string" ? value : "";
    const selectedOpt = opts.find((o) => o.label === selectedLabel);
    function confirm() {
      if (!selectedOpt) return;
      const extra = { [key]: selectedOpt.label };
      if (selectedOpt.action === "disqualify") { onDisqualify(); return; }
      if (selectedOpt.action === "jump" && selectedOpt.targetStepId) { onJump(selectedOpt.targetStepId); return; }
      onNext(extra);
    }
    return (
      <div>
        {header}
        <div className="mt-6 space-y-2">
          {opts.map((o, i) => {
            const isOn = selectedLabel === o.label;
            return (
              <button key={i} onClick={() => setValue(o.label)} className={`w-full text-left px-4 py-3 rounded-xl border transition font-medium ${isOn ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>{o.label}</button>
            );
          })}
        </div>
        <Cta disabled={!selectedOpt} onClick={confirm}>{cfg.cta || (isLast ? "Enviar" : "Continuar")}</Cta>
      </div>
    );
  }

  if (step.type === "multiple") {
    const opts: string[] = Array.isArray(cfg.options) ? cfg.options.map((o: any) => (typeof o === "string" ? o : o?.label)).filter(Boolean) : [];
    const multi = true;
    const selected: string[] = Array.isArray(value) ? value : (typeof value === "string" && value ? [value] : []);
    function toggle(o: string) {
      if (multi) {
        setValue(selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o]);
      } else {
        setValue(o);
      }
    }
    return (
      <div>
        {header}
        <div className="mt-6 space-y-2">
          {opts.map((o) => {
            const isOn = selected.includes(o);
            return (
              <button key={o} onClick={() => toggle(o)} className={`w-full text-left px-4 py-3 rounded-xl border transition font-medium ${isOn ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>{o}</button>
            );
          })}
        </div>
        <Cta disabled={!selected.length} onClick={() => onNext({ [key]: multi ? selected : selected[0] })}>{cfg.cta || (isLast ? "Enviar" : "Continuar")}</Cta>
      </div>
    );
  }

  if (step.type === "input") {
    return (
      <div>
        {header}
        <Input className="mt-6" placeholder={cfg.placeholder || ""} value={value} onChange={(e) => setValue(e.target.value)} />
        <Cta disabled={!value} onClick={() => onNext({ [key]: value })}>{cfg.cta || (isLast ? "Enviar" : "Continuar")}</Cta>
      </div>
    );
  }

  if (step.type === "lead") {
    return (
      <div>
        {header}
        <div className="mt-6 space-y-3">
          <Input placeholder="Seu nome" value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} />
          <Input placeholder="Seu e-mail" type="email" value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} />
          <Input placeholder="Seu WhatsApp" value={lead.phone} onChange={(e) => setLead({ ...lead, phone: maskPhone(e.target.value) })} />
        </div>
        <Cta disabled={!lead.email} onClick={() => onNext(undefined, lead)}>{cfg.cta || "Receber resultado"}</Cta>
      </div>
    );
  }

  if (step.type === "contact") {
    return (
      <div>
        {header}
        <div className="mt-6 space-y-3">
          <Input placeholder={cfg.namePlaceholder || "Seu nome"} value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} />
          <Input placeholder={cfg.phonePlaceholder || "Seu WhatsApp"} type="tel" value={lead.phone} onChange={(e) => setLead({ ...lead, phone: maskPhone(e.target.value) })} />
        </div>
        <Cta disabled={!lead.name || !lead.phone} onClick={() => onNext(undefined, { name: lead.name, phone: lead.phone })}>{cfg.cta || (isLast ? "Enviar" : "Continuar")}</Cta>
      </div>
    );
  }

  return (
    <div>
      <p className="text-muted-foreground">Tipo de etapa desconhecido.</p>
      <Button className="mt-4 rounded-full w-full" onClick={() => onNext()}>Continuar</Button>
    </div>
  );
}
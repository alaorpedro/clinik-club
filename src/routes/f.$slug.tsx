import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPublicFunnel, submitLead, trackStep } from "@/lib/funnels.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

type Step = { id: string; type: string; config: any; order: number };

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
    await submit({ data: { funnelId: funnel.id, answers: finalAnswers, ...finalLead } });
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
    if (isLast) finish(a, l);
    else setIndex(index + 1);
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
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-secondary/30">
        <div className="max-w-md text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-3xl">✓</div>
          <h1 className="text-2xl font-bold mt-4">Obrigado!</h1>
          <p className="text-muted-foreground mt-2">Recebemos suas respostas. Em breve entraremos em contato.</p>
        </div>
      </div>
    );
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

  function Media() {
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
            <iframe src={`https://www.youtube.com/embed/${yt[1]}`} className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen />
          </div>
        );
      }
      return <video src={url} controls style={style} className={`${hasW ? "" : "w-full"} rounded-2xl mb-4 ${hCls}`} />;
    }
    return null;
  }

  const mediaAbove = cfg.mediaPosition !== "below";
  const subtitleAbove = cfg.subtitlePosition === "above";
  const subtitle = cfg.subtitle ? <p className={`text-muted-foreground mt-2 ${subtitleSizeCls}`}>{cfg.subtitle}</p> : null;
  const header = (
    <div className={align}>
      {mediaAbove && <Media />}
      {subtitleAbove && subtitle}
      {cfg.title && <h2 className={`${titleSize} font-black tracking-tight`}>{cfg.title}</h2>}
      {!subtitleAbove && subtitle}
      {!mediaAbove && <div className="mt-4"><Media /></div>}
    </div>
  );

  if (step.type === "text") {
    return (
      <div>
        {header}
        {cfg.body && <p className={`mt-3 text-muted-foreground ${bodySizeCls} ${align}`}>{cfg.body}</p>}
        <Button className={btnClass} onClick={() => onNext()}>{cfg.cta || (isLast ? "Enviar" : "Continuar")}</Button>
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
        <Button className={btnClass} disabled={!selectedOpt} onClick={confirm}>{cfg.cta || (isLast ? "Enviar" : "Continuar")}</Button>
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
        <Button className={btnClass} disabled={!selected.length} onClick={() => onNext({ [key]: multi ? selected : selected[0] })}>{cfg.cta || (isLast ? "Enviar" : "Continuar")}</Button>
      </div>
    );
  }

  if (step.type === "input") {
    return (
      <div>
        {header}
        <Input className="mt-6" placeholder={cfg.placeholder || ""} value={value} onChange={(e) => setValue(e.target.value)} />
        <Button className={btnClass} disabled={!value} onClick={() => onNext({ [key]: value })}>{cfg.cta || (isLast ? "Enviar" : "Continuar")}</Button>
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
        <Button className={btnClass} disabled={!lead.email} onClick={() => onNext(undefined, lead)}>{cfg.cta || "Receber resultado"}</Button>
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
        <Button className={btnClass} disabled={!lead.name || !lead.phone} onClick={() => onNext(undefined, { name: lead.name, phone: lead.phone })}>{cfg.cta || (isLast ? "Enviar" : "Continuar")}</Button>
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
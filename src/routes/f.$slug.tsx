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

function PublicFunnel() {
  const { funnel, steps } = Route.useLoaderData() as { funnel: { id: string; name: string }; steps: Step[] };
  const submit = useServerFn(submitLead);
  const track = useServerFn(trackStep);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [lead, setLead] = useState<{ name?: string; email?: string; phone?: string }>({});
  const [done, setDone] = useState(false);
  const sessionId = useMemo(() => genId(), []);

  useEffect(() => {
    if (!funnel) return;
    track({ data: { funnelId: funnel.id, sessionId, stepIndex: index } }).catch(() => {});
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
    setDone(true);
  }

  const step = steps[index];
  const isLast = index === steps.length - 1;
  const progress = ((index + 1) / steps.length) * 100;

  function next(extra?: Record<string, unknown>, leadExtra?: typeof lead) {
    const a = { ...answers, ...(extra ?? {}) };
    const l = { ...lead, ...(leadExtra ?? {}) };
    setAnswers(a);
    if (leadExtra) setLead(l);
    if (isLast) finish(a, l);
    else setIndex(index + 1);
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
    <div className="min-h-screen bg-secondary/30 py-10 px-4">
      <div className="max-w-xl mx-auto">
        <Progress value={progress} className="mb-6" />
        <div className="rounded-3xl bg-background border border-border shadow-soft p-8">
          <StepView step={step} onNext={next} isLast={isLast} />
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">Etapa {index + 1} de {steps.length}</p>
      </div>
    </div>
  );
}

function StepView({ step, onNext, isLast }: { step: Step; onNext: (a?: Record<string, unknown>, l?: { name?: string; email?: string; phone?: string }) => void; isLast: boolean }) {
  const cfg = step.config ?? {};
  const key = `step_${step.id}`;
  const [value, setValue] = useState<any>("");
  const [lead, setLead] = useState({ name: "", email: "", phone: "" });

  if (step.type === "text") {
    return (
      <div>
        {cfg.title && <h2 className="text-2xl font-black tracking-tight">{cfg.title}</h2>}
        {cfg.body && <p className="mt-3 text-muted-foreground">{cfg.body}</p>}
        <Button className="mt-6 rounded-full w-full font-semibold" onClick={() => onNext()}>{cfg.cta || (isLast ? "Enviar" : "Continuar")}</Button>
      </div>
    );
  }

  if (step.type === "single" || step.type === "multiple") {
    const opts: string[] = Array.isArray(cfg.options) ? cfg.options : [];
    const multi = step.type === "multiple";
    const selected: string[] = Array.isArray(value) ? value : [];
    function toggle(o: string) {
      if (multi) {
        setValue(selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o]);
      } else {
        onNext({ [key]: o });
      }
    }
    return (
      <div>
        {cfg.title && <h2 className="text-2xl font-black tracking-tight">{cfg.title}</h2>}
        <div className="mt-6 space-y-2">
          {opts.map((o) => {
            const isOn = multi && selected.includes(o);
            return (
              <button key={o} onClick={() => toggle(o)} className={`w-full text-left px-4 py-3 rounded-xl border transition font-medium ${isOn ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>{o}</button>
            );
          })}
        </div>
        {multi && (
          <Button className="mt-6 rounded-full w-full font-semibold" disabled={!selected.length} onClick={() => onNext({ [key]: selected })}>{cfg.cta || (isLast ? "Enviar" : "Continuar")}</Button>
        )}
      </div>
    );
  }

  if (step.type === "input") {
    return (
      <div>
        {cfg.title && <h2 className="text-2xl font-black tracking-tight">{cfg.title}</h2>}
        <Input className="mt-6" placeholder={cfg.placeholder || ""} value={value} onChange={(e) => setValue(e.target.value)} />
        <Button className="mt-4 rounded-full w-full font-semibold" disabled={!value} onClick={() => onNext({ [key]: value })}>{cfg.cta || (isLast ? "Enviar" : "Continuar")}</Button>
      </div>
    );
  }

  if (step.type === "lead") {
    return (
      <div>
        <h2 className="text-2xl font-black tracking-tight">{cfg.title || "Quase lá! Deixe seu contato"}</h2>
        <div className="mt-6 space-y-3">
          <Input placeholder="Seu nome" value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} />
          <Input placeholder="Seu e-mail" type="email" value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} />
          <Input placeholder="Seu WhatsApp" value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })} />
        </div>
        <Button className="mt-6 rounded-full w-full font-semibold" disabled={!lead.email} onClick={() => onNext(undefined, lead)}>{cfg.cta || "Receber resultado"}</Button>
      </div>
    );
  }

  if (step.type === "contact") {
    return (
      <div>
        <h2 className="text-2xl font-black tracking-tight">{cfg.title || "Deixe seu contato"}</h2>
        <div className="mt-6 space-y-3">
          <Input placeholder={cfg.namePlaceholder || "Seu nome"} value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} />
          <Input placeholder={cfg.phonePlaceholder || "Seu WhatsApp"} type="tel" value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })} />
        </div>
        <Button className="mt-6 rounded-full w-full font-semibold" disabled={!lead.name || !lead.phone} onClick={() => onNext(undefined, { name: lead.name, phone: lead.phone })}>{cfg.cta || (isLast ? "Enviar" : "Continuar")}</Button>
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
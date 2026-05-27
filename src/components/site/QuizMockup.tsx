import { useEffect, useState } from "react";

const options = [
  { label: "Clareamento dental", icon: "✨" },
  { label: "Implante", icon: "🦷" },
  { label: "Ortodontia / Aparelho", icon: "😁" },
  { label: "Limpeza e prevenção", icon: "🪥" },
];

export function QuizMockup() {
  const [selected, setSelected] = useState(1);
  const [progress, setProgress] = useState(40);
  const [step, setStep] = useState(2);

  useEffect(() => {
    const t = setInterval(() => {
      setSelected((s) => (s + 1) % options.length);
      setProgress((p) => (p >= 80 ? 40 : p + 15));
      setStep((s) => (s >= 5 ? 2 : s + 1));
    }, 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-sm">
      {/* Floating block hints — positioned outside phone, hidden on small screens */}
      <div className="pointer-events-none absolute -left-28 top-24 hidden xl:flex flex-col gap-2 z-20">
        {[
          { i: "T", label: "Texto" },
          { i: "≡", label: "Escolha única" },
          { i: "▭", label: "Botão CTA" },
          { i: "✉", label: "Captura de lead" },
        ].map(({ i, label }) => (
          <div
            key={label}
            className="flex items-center gap-2 rounded-lg bg-card shadow-soft border border-border/60 px-3 py-2 text-xs font-medium text-foreground/70"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary font-bold">
              {i}
            </span>
            {label}
          </div>
        ))}
      </div>

      {/* Floating metric badge — top right */}
      <div className="pointer-events-none absolute -right-6 top-20 hidden lg:flex items-center gap-2 rounded-full bg-card shadow-card border border-border/60 px-3 py-2 text-xs font-semibold z-20">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>+128 leads esta semana</span>
      </div>

      {/* Phone frame */}
      <div className="relative rounded-[2.5rem] border-[10px] border-foreground bg-background shadow-card overflow-hidden">
        {/* Clinic header bar */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
              C+
            </div>
            <div className="text-[11px] leading-tight">
              <div className="font-semibold">Clínica Sorriso</div>
              <div className="text-muted-foreground">Avaliação gratuita</div>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground font-medium">
            Etapa {step}/5
          </div>
        </div>

        <div className="h-1.5 bg-muted mx-5 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-700 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="px-5 pt-5 pb-7">
          <h3 className="text-xl font-bold tracking-tight leading-snug">
            Qual tratamento você procura?
          </h3>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Personalizamos sua avaliação em 2 minutos.
          </p>

          <div className="mt-4 space-y-2">
            {options.map((opt, i) => (
              <button
                key={opt.label}
                onClick={() => setSelected(i)}
                className={`flex w-full items-center gap-3 rounded-xl border-2 px-3.5 py-2.5 text-sm font-medium transition ${
                  i === selected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-foreground/30"
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full border-2 shrink-0 ${
                    i === selected ? "border-primary bg-primary" : "border-border"
                  }`}
                >
                  {i === selected && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                  )}
                </span>
                <span className="text-base leading-none">{opt.icon}</span>
                <span className="text-left">{opt.label}</span>
              </button>
            ))}
          </div>

          <button className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition">
            Continuar 👉
          </button>

          <p className="mt-3 text-center text-[10px] text-muted-foreground">
            🔒 Seus dados ficam protegidos — LGPD
          </p>
        </div>
      </div>
    </div>
  );
}
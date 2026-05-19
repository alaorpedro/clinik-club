import { useEffect, useState } from "react";

const options = ["18-24", "25-34", "35-55", "55-65+"];

export function QuizMockup() {
  const [selected, setSelected] = useState(1);
  const [progress, setProgress] = useState(20);

  useEffect(() => {
    const t = setInterval(() => {
      setSelected((s) => (s + 1) % options.length);
      setProgress((p) => (p >= 80 ? 20 : p + 20));
    }, 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-sm">
      {/* Floating block hints */}
      <div className="absolute -left-8 top-32 hidden lg:flex flex-col gap-2 z-20">
        {["T  Texto", "≡  Escolha única", "▭  Botão"].map((label) => (
          <div key={label} className="rounded-lg bg-card shadow-soft border border-border/60 px-3 py-2 text-xs font-medium text-foreground/70">
            {label}
          </div>
        ))}
      </div>
      {/* Phone frame */}
      <div className="relative rounded-[2.5rem] border-[10px] border-foreground bg-background shadow-card overflow-hidden">
        <div className="h-2 bg-muted">
          <div className="h-full bg-primary transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>
        <div className="p-7 pb-10">
          <h3 className="text-2xl font-bold tracking-tight">Vamos começar!</h3>
          <p className="mt-2 text-sm text-muted-foreground">Selecione a sua idade para iniciarmos o quiz.</p>
          <p className="mt-4 text-xs text-muted-foreground">⏳ Duração de 2min para responder</p>
          <div className="mt-5 space-y-2">
            {options.map((opt, i) => (
              <button
                key={opt}
                onClick={() => setSelected(i)}
                className={`w-full text-left rounded-xl border-2 px-4 py-3 text-sm font-medium transition ${
                  i === selected ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30"
                }`}
              >
                <span className={`mr-3 inline-block h-4 w-4 rounded-full border-2 align-middle ${
                  i === selected ? "border-primary bg-primary" : "border-border"
                }`} />
                {opt}
              </button>
            ))}
          </div>
          <button className="mt-5 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground">
            Continuar 👉
          </button>
        </div>
      </div>
    </div>
  );
}
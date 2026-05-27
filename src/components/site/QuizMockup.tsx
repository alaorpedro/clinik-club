import { useEffect, useState } from "react";
import { Sparkles, Smile, HeartPulse } from "lucide-react";
import { ToothMark } from "@/components/site/ToothMark";
import dentistAvatar from "@/assets/dentist-avatar.jpg";

const options = [
  { label: "Clareamento dental", Icon: Sparkles },
  { label: "Implante", Icon: ToothMark },
  { label: "Ortodontia / Aparelho", Icon: Smile },
  { label: "Limpeza e prevenção", Icon: HeartPulse },
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
      {/* Phone frame */}
      <div className="relative rounded-[2.25rem] border-[8px] border-foreground bg-background shadow-card overflow-hidden">
        {/* Clinic header bar with dentist avatar */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 bg-secondary/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={dentistAvatar}
              alt="Dra. Camila Ribeiro"
              loading="lazy"
              width={1024}
              height={1024}
              className="h-9 w-9 rounded-full object-cover ring-2 ring-background shrink-0"
            />
            <div className="text-[11px] leading-tight min-w-0">
              <div className="font-semibold truncate">Dra. Camila Ribeiro</div>
              <div className="text-muted-foreground truncate">CRO-SP 54.321 · responde agora</div>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground font-medium shrink-0 ml-2">
            {step}/5
          </div>
        </div>

        <div className="h-1 bg-muted mx-4 mt-3 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-700 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="px-4 pt-4 pb-5">
          {/* Human greeting bubble */}
          <div className="flex gap-2 mb-3">
            <img
              src={dentistAvatar}
              alt=""
              loading="lazy"
              width={1024}
              height={1024}
              className="h-7 w-7 rounded-full object-cover shrink-0 mt-0.5"
            />
            <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-[12px] leading-snug text-foreground/80">
              Oi! Em 2 minutos eu monto sua avaliação. Primeiro me conta:
            </div>
          </div>

          <h3 className="text-[17px] font-bold tracking-tight leading-snug">
            Qual tratamento você procura?
          </h3>

          <div className="mt-3 space-y-2">
            {options.map((opt, i) => {
              const Icon = opt.Icon;
              return (
                <button
                  key={opt.label}
                  onClick={() => setSelected(i)}
                  className={`flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-[13px] font-medium transition ${
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
                  <Icon className={`h-4 w-4 shrink-0 ${i === selected ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-left">{opt.label}</span>
                </button>
              );
            })}
          </div>

          <button className="mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition">
            Continuar
          </button>

          <p className="mt-3 text-center text-[10px] text-muted-foreground">
            🔒 Dados protegidos — LGPD
          </p>
        </div>
      </div>
    </div>
  );
}
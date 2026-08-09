import { useEffect, useState } from "react";

const options = [
  "Clareamento dental",
  "Implante",
  "Ortodontia / Aparelho",
  "Limpeza e prevenção",
];

/**
 * Demonstração do produto no hero.
 * Duas superfícies contando a história inteira: a etapa que o paciente vê e o
 * lead que chega na recepção. Sem moldura de celular, sem foto de banco de
 * imagem e sem emoji — a régua é o manual da marca.
 */
export function QuizMockup() {
  const [selected, setSelected] = useState(2);

  useEffect(() => {
    const t = setInterval(() => setSelected((s) => (s + 1) % options.length), 2600);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-md pb-24 lg:pb-28">
      {/* Etapa do funil, como o paciente vê */}
      <div className="ck-r-sig relative border border-border bg-card shadow-card">
        {/* Cabeçalho: a marca é da clínica, não a nossa */}
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          <span className="ck-r-sig-sm flex h-9 w-9 shrink-0 items-center justify-center bg-primary text-[11px] font-medium text-primary-foreground">
            CB
          </span>
          <span className="min-w-0 text-[13px] font-medium">Clínica Bertola</span>
          <span className="ck-eyebrow ml-auto shrink-0">Etapa 2 de 5</span>
        </div>

        {/* Progresso: régua fina, não barra arredondada */}
        <div className="h-px w-full bg-border">
          <div className="h-px bg-primary transition-all duration-[260ms] ease-in-out" style={{ width: "40%" }} />
        </div>

        <div className="px-6 pb-6 pt-6">
          <h3 className="ck-display text-[26px] leading-[1.15]">
            Qual tratamento você procura?
          </h3>

          <div className="mt-5 space-y-2">
            {options.map((label, i) => {
              const on = i === selected;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setSelected(i)}
                  aria-pressed={on}
                  className={`flex w-full items-center gap-3 border px-4 py-3 text-[13.5px] transition-colors duration-[180ms] ease-out ${
                    on
                      ? "border-primary bg-accent font-medium text-foreground"
                      : "border-border text-muted-foreground hover:border-input"
                  }`}
                  style={{ borderRadius: "var(--ck-r-flat)" }}
                >
                  <span
                    className={`flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border transition-colors duration-[180ms] ease-out ${
                      on ? "border-primary" : "border-input"
                    }`}
                  >
                    {on && <span className="h-[7px] w-[7px] rounded-full bg-primary" />}
                  </span>
                  <span className="text-left">{label}</span>
                </button>
              );
            })}
          </div>

          <div className="ck-btn mt-5 w-full bg-primary py-3 text-center text-[13.5px] font-medium text-primary-foreground">
            Continuar
          </div>

          <p className="ck-eyebrow mt-4 text-center">Dados protegidos · LGPD</p>
        </div>
      </div>

      {/* O outro lado: o lead chegando na recepção */}
      <div
        className="ck-r-sig absolute bottom-0 left-2 w-[85%] border border-border bg-card px-5 py-4 shadow-card sm:left-6 lg:-left-10 lg:w-[78%]"
        aria-hidden
      >
        <div className="ck-eyebrow">Novo lead · agora</div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-[15px] font-medium">Ana Silva</span>
          <span className="ck-num text-[12.5px] text-muted-foreground">(48) 99631-2044</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span
            className="px-2 py-[3px] text-[11px] font-medium"
            style={{
              borderRadius: "var(--ck-r-flat-sm)",
              background: "var(--ck-tag-azul-bg)",
              color: "var(--ck-tag-azul-fg)",
            }}
          >
            Ortodontia
          </span>
          <span
            className="px-2 py-[3px] text-[11px] font-medium"
            style={{
              borderRadius: "var(--ck-r-flat-sm)",
              background: "var(--ck-success-bg)",
              color: "var(--ck-success)",
            }}
          >
            Qualificado
          </span>
        </div>
      </div>
    </div>
  );
}

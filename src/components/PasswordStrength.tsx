import { useMemo } from "react";
import { Check, X } from "lucide-react";

interface PasswordStrengthProps {
  password: string;
}

const REQUIREMENTS = [
  { label: "Pelo menos 8 caracteres", test: (v: string) => v.length >= 8 },
  { label: "Uma letra maiúscula (A-Z)", test: (v: string) => /[A-Z]/.test(v) },
  { label: "Uma letra minúscula (a-z)", test: (v: string) => /[a-z]/.test(v) },
  { label: "Um número (0-9)", test: (v: string) => /\d/.test(v) },
  { label: "Um símbolo (!@#$% etc.)", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const results = useMemo(() => REQUIREMENTS.map((r) => r.test(password)), [password]);
  const passed = results.filter(Boolean).length;

  const strength = passed <= 2 ? "fraca" : passed <= 3 ? "média" : passed <= 4 ? "boa" : "forte";
  const strengthColor =
    passed <= 2 ? "bg-red-500" : passed <= 3 ? "bg-yellow-500" : passed <= 4 ? "bg-blue-500" : "bg-green-500";

  if (password.length === 0) return null;

  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${strengthColor}`}
            style={{ width: `${(passed / REQUIREMENTS.length) * 100}%` }}
          />
        </div>
        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
          {strength}
        </span>
      </div>
      <ul className="space-y-1">
        {REQUIREMENTS.map((req, i) => {
          const ok = results[i];
          return (
            <li key={req.label} className="flex items-center gap-2 text-xs">
              {ok ? (
                <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
              ) : (
                <X className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
              )}
              <span className={ok ? "text-foreground" : "text-muted-foreground"}>{req.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

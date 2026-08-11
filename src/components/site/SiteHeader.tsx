import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

const NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/sobre", label: "Sobre" },
  { to: "/planos", label: "Planos" },
  { to: "/contato", label: "Contato" },
] as const;

export function SiteHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-6 lg:px-10">
        <Button 
          variant="ghost" 
          className="flex items-center p-0 h-auto hover:bg-transparent" 
          onClick={() => navigate({ to: user ? "/app" : "/" })}
          aria-label="Clinik.Club"
        >
          <img src="/brand/clinik-logo-vetor.svg" alt="Clinik.Club" className="h-9 w-auto" />
        </Button>
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
          {NAV_LINKS.map((l) => {
            const active = path === l.to;
            return (
              <Button
                key={l.to}
                variant="ghost"
                onClick={() => navigate({ to: l.to })}
                className={`relative h-auto p-0 transition-colors duration-[180ms] ease-out hover:bg-transparent focus-visible:bg-transparent after:content-[''] after:absolute after:-bottom-2 after:left-0 after:h-px after:bg-primary after:transition-[width] after:duration-[180ms] after:ease-out ${
                  active
                    ? "text-foreground after:w-full"
                    : "text-muted-foreground hover:text-foreground after:w-0 hover:after:w-full"
                }`}
              >
                {l.label}
              </Button>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Button onClick={() => navigate({ to: "/app" })} size="sm">Ir para o app</Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => navigate({ to: "/login" })}>Entrar</Button>
              <Button size="sm" className="ck-btn font-semibold" onClick={() => navigate({ to: "/cadastro" })}>Inscrever-se</Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

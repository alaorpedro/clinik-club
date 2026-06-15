import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/clinik-club-logo.png";


export function SiteHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Button 
          variant="ghost" 
          className="flex items-center p-0 h-auto hover:bg-transparent" 
          onClick={() => navigate({ to: user ? "/app" : "/" })}
          aria-label="Clinik.Club"
        >
          <img src={logo} alt="Clinik.Club" className="h-7 w-auto" />
        </Button>
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
          <Button variant="ghost" className="text-foreground/70 hover:text-foreground h-auto p-0" onClick={() => navigate({ to: "/" })}>Home</Button>
          <Button variant="ghost" className="text-foreground/70 hover:text-foreground h-auto p-0" onClick={() => navigate({ to: "/sobre" })}>Sobre</Button>
          <Button variant="ghost" className="text-foreground/70 hover:text-foreground h-auto p-0" onClick={() => navigate({ to: "/planos" })}>Planos</Button>
          <Button variant="ghost" className="text-foreground/70 hover:text-foreground h-auto p-0" onClick={() => navigate({ to: "/contato" })}>Contato</Button>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Button onClick={() => navigate({ to: "/app" })} size="sm">Ir para o app</Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => navigate({ to: "/login" })}>Entrar</Button>
              <Button size="sm" className="rounded-full font-semibold" onClick={() => navigate({ to: "/cadastro" })}>Inscrever-se</Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

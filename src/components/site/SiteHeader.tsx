import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/clinik-club-logo.png";
import icon from "@/assets/clinik-icon.png";


export function SiteHeader() {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to={user ? "/app" : "/"} className="flex items-center gap-2" aria-label="Clinik.Club">
          <img src={icon} alt="" className="h-8 w-8" />
          <img src={logo} alt="Clinik.Club" className="h-7 w-auto hidden sm:block" />
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
          <Link to="/" activeOptions={{ exact: true }} activeProps={{ className: "text-primary" }} className="text-foreground/70 hover:text-foreground transition">Home</Link>
          <Link to="/sobre" activeProps={{ className: "text-primary" }} className="text-foreground/70 hover:text-foreground transition">Sobre</Link>
          <Link to="/planos" activeProps={{ className: "text-primary" }} className="text-foreground/70 hover:text-foreground transition">Planos</Link>
          <Link to="/contato" activeProps={{ className: "text-primary" }} className="text-foreground/70 hover:text-foreground transition">Contato</Link>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Button asChild size="sm"><Link to="/app">Ir para o app</Link></Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link to="/login">Entrar</Link></Button>
              <Button asChild size="sm" className="rounded-full font-semibold"><Link to="/cadastro">Inscrever-se</Link></Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/clinik-club-logo.png";
import icon from "@/assets/clinik-icon.png";

export const APP_VERSION = "1.07";

export function SiteFooter() {
  const { user } = useAuth();
  
  return (
    <footer className="border-t border-border/60 bg-secondary/40 mt-24">
      <div className="container mx-auto px-4 py-12 grid gap-8 md:grid-cols-4">
        <div>
          <Link to={user ? "/app" : "/"} className="flex items-center gap-2" aria-label="Clinik.Club">
            <img src={icon} alt="" className="h-8 w-8" />
            <img src={logo} alt="Clinik.Club" className="h-7 w-auto" />
          </Link>
          <p className="mt-3 text-sm text-muted-foreground max-w-xs">
            Funis de vendas interativos para clínicas e profissionais da saúde.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold mb-3">Produto</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/planos" className="hover:text-foreground">Planos</Link></li>
            <li><Link to="/sobre" className="hover:text-foreground">Sobre</Link></li>
            <li><Link to="/contato" className="hover:text-foreground">Contato</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold mb-3">Conta</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/login" className="hover:text-foreground">Entrar</Link></li>
            <li><Link to="/cadastro" className="hover:text-foreground">Cadastrar</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold mb-3">Legal</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/termos" className="hover:text-foreground">Termos de uso</Link></li>
            <li><Link to="/privacidade" className="hover:text-foreground">Privacidade</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Clinik.Club. Todos os direitos reservados.
        <span className="ml-2 opacity-60">v{APP_VERSION}</span>
      </div>
    </footer>
  );
}

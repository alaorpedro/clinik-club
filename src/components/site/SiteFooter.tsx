import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-secondary/40 mt-24">
      <div className="container mx-auto px-4 py-12 grid gap-8 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-background font-bold text-sm">OD</div>
            <span className="text-lg font-bold">odontolink</span>
          </div>
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
            <li>Termos de uso</li>
            <li>Privacidade</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} odontolink. Todos os direitos reservados.
      </div>
    </footer>
  );
}
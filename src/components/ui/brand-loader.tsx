// Ícone da marca com o pulso dos 4 pontos (docs/brand/design-system.md §movimento —
// "o detalhe mais próprio da marca"). Usa a animação .ck-loader já definida em
// clinik-theme.css; endereço: carregamento de rota, de painel e de página inteira
// — não para spinner solto dentro de botão (esse continua com o ícone genérico).
export function BrandLoader({
  className = "h-8 w-8",
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 466.85 501.85 501.85"
      fill="currentColor"
      className={`ck-loader ${className}`}
      role="status"
      aria-label="Carregando"
      {...props}
    >
      <path d="M366.56,736.62c-46.97,13.04-83.79,49.88-96.82,96.85,21.84,5.76,39.73,21.23,48.8,41.5,13.86-42.35,47.05-75.57,89.38-89.47-20.24-9.12-35.65-27.04-41.36-48.88Z" />
      <path d="M269.76,602.13c12.42,46.95,47.49,83.77,92.22,96.81,5.44-21.83,20.11-39.74,39.36-48.86-40.24-13.9-71.8-47.05-85.02-89.31-8.68,20.24-25.76,35.65-46.56,41.36Z" />
      <path d="M135.27,736.61c-5.71,21.83-21.11,39.74-41.32,48.86,42.17,13.88,75.26,46.94,89.18,89.09,9.17-20.18,27.1-35.53,48.94-41.19-13.05-46.93-49.86-83.73-96.79-96.77Z" />
      <path d="M183.21,560.8c-13.9,42.24-47.05,75.37-89.31,89.25,20.24,9.12,35.65,27.04,41.36,48.88,46.95-13.04,83.77-49.85,96.81-96.81-21.83-5.71-39.74-21.11-48.86-41.32Z" />
      <circle cx="63.45" cy="717.77" r="63.45" />
      <circle cx="438.39" cy="717.76" r="63.45" />
      <circle cx="250.92" cy="530.3" r="63.45" />
      <circle cx="250.92" cy="905.25" r="63.45" />
    </svg>
  );
}

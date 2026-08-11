import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Sonner tema por CSS custom properties próprias (--normal-bg, --success-text,
// --gray1..12, --border-radius...), não pelas classes do shadcn/Tailwind — daí
// o override ser feito via `style`, remapeando pra --ck-*. Como tudo aqui é
// var(--ck-*) e não hex fixo, o toast já acompanha .dark .theme-clinik sozinho.
// Raio: "Toast, popover" é assinatura (design-system.md §3) — --ck-r-sig-md,
// a mesma família de botão/input.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="top-center"
      richColors
      closeButton
      style={
        {
          "--border-radius": "var(--ck-r-sig-md)",
          fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
          "--gray1": "var(--ck-surface)",
          "--gray2": "var(--ck-n-100)",
          "--gray3": "var(--ck-n-100)",
          "--gray4": "var(--ck-n-300)",
          "--gray5": "var(--ck-n-300)",
          "--gray11": "var(--ck-n-600)",
          "--gray12": "var(--ck-navy)",
          "--normal-bg": "var(--ck-surface)",
          "--normal-border": "var(--ck-n-300)",
          "--normal-text": "var(--ck-navy)",
          "--success-bg": "var(--ck-success-bg)",
          "--success-border": "var(--ck-n-300)",
          "--success-text": "var(--ck-success)",
          "--warning-bg": "var(--ck-warning-bg)",
          "--warning-border": "var(--ck-n-300)",
          "--warning-text": "var(--ck-warning)",
          "--error-bg": "var(--ck-danger-bg)",
          "--error-border": "var(--ck-n-300)",
          "--error-text": "var(--ck-danger)",
          "--info-bg": "var(--ck-nevoa)",
          "--info-border": "var(--ck-n-300)",
          "--info-text": "var(--ck-sereno-text)",
        } as React.CSSProperties
      }
      toastOptions={{
        style: {
          boxShadow: "var(--ck-elev-3)",
        },
        classNames: {
          title: "font-medium",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };

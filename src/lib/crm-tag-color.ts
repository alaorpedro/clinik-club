// Dez pares bg/fg da marca (docs/brand/design-system.md §2, tokens --ck-tag-* em
// clinik-theme.css). A cor é atribuída por hash estável do nome — o usuário nunca
// escolhe cor livre, senão qualquer CRM vira arco-íris.
const TAG_PALETTE = [
  "azul",
  "petroleo",
  "verde",
  "oliva",
  "ambar",
  "terracota",
  "rosa",
  "vinho",
  "roxo",
  "ardosia",
] as const;

export function tagColorClass(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const key = TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length];
  return `bg-[var(--ck-tag-${key}-bg)] text-[var(--ck-tag-${key}-fg)]`;
}

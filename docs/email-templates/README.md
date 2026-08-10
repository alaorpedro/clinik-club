# Padrao de emails Clinik.Club

Diretriz visual para todos os emails transacionais — tokens espelhados de
`docs/brand/design-system.md` e `src/styles/clinik-theme.css` (ver comentarios com o hex
canonico ao lado de cada `--ck-*`):

- Idioma: portugues do Brasil.
- Logo: lockup Clinik.Club (icone + lettering + "CLUB") no canto superior esquerdo, navy.
- Fundo da pagina: off-white (`#F5F4F1`).
- Cartao do email: branco de superficie (`#FCFCFC`), borda `#D5D2C9`.
- Titulo: Italiana (serif, peso unico 400) — mesma fonte de titulo de secao no site.
- Corpo, eyebrow e botao: Jost, peso maximo 600 (a fonte nao tem pesos acima disso; pedir
  mais sintetiza negrito falso no client de email).
- Texto principal/titulo: Azul Clinik (`#0A2148`).
- Texto secundario: cinza texto auxiliar (`#6E6A5F`).
- CTA principal: Azul Clinik (`#0A2148`) com texto branco de superficie.
- Raio: familia assinatura em tudo (cartao `20px 4px 20px 4px`, botao/codigo OTP
  `16px 4px 16px 4px` / `10px 3px 10px 3px`) — email e conteudo singular, nunca repetido ou
  aninhado, entao a assinatura nunca sai de cena (design-system.md §3).
- Link de suporte padrao: `suporte@clinik.club`.
- URL publica do logo: `https://clinik.club/email/clinik-club-logo.png`.

## Supabase Auth

Os templates ficam em:

`docs/email-templates/supabase/apply-supabase-email-templates.mjs`

Emails cobertos:

- Confirmacao de cadastro
- Recuperacao de senha
- Link magico / OTP
- Convite
- Alteracao de email
- Reautenticacao
- Notificacao de senha alterada
- Notificacao de email alterado
- Notificacao de telefone alterado
- Metodo de acesso conectado
- Metodo de acesso removido
- Metodo de verificacao adicionado
- Metodo de verificacao removido

Para visualizar o payload sem aplicar:

```bash
node docs/email-templates/supabase/apply-supabase-email-templates.mjs
```

Para aplicar no Supabase remoto:

```bash
SUPABASE_ACCESS_TOKEN=sbp_xxx node docs/email-templates/supabase/apply-supabase-email-templates.mjs
```

## Stripe

O Stripe nao permite controlar o HTML completo dos emails transacionais pelo codigo do app.
Para padronizar os emails de compra, fatura, recibo e falha de pagamento, configurar no painel Stripe:

- Logo: usar o mesmo logo publico ou fazer upload do PNG.
- Cor da marca: `#0A2148` (Azul Clinik).
- Nome da marca: `Clinik.Club`.
- Emails ativos: recibos, faturas, falha de pagamento e notificacoes de assinatura conforme estrategia comercial.

Emails Stripe dependentes do painel:

- Recibo / compra aprovada
- Fatura enviada
- Falha de pagamento
- Proxima cobranca, se habilitado
- Cancelamento/alteracao de assinatura, se habilitado

## Emails proprios do app

Hoje o app nao tem provedor proprio de emails transacionais. Para emails 100% personalizados fora de Supabase/Stripe, adicionar um provedor como Resend, Postmark ou SendGrid.

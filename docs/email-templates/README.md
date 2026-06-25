# Padrao de emails Clinik.Club

Diretriz visual para todos os emails transacionais:

- Idioma: portugues do Brasil.
- Logo: Clinik.Club no canto superior esquerdo.
- Fundo: azul clinico claro (`#f3fbff`).
- Texto principal: quase preto (`#07111f`).
- Texto secundario: cinza azulado (`#5f6b7a`).
- CTA principal: azul Clinik (`#0889b2`) com texto branco.
- Destaques de saude/frescor: verde menta (`#54d6ad`).
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
- Cor da marca: `#0889b2`.
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

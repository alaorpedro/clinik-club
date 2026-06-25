const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "gyemtbjqzqzdqybwgmyp";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

const BRAND = {
  logoUrl: "https://clinik.club/email/clinik-club-logo.png",
  siteUrl: "https://clinik.club",
  supportEmail: "suporte@clinik.club",
  primary: "#0889b2",
  mint: "#54d6ad",
  background: "#f3fbff",
  foreground: "#07111f",
  muted: "#5f6b7a",
  border: "#dbe8ef",
};

function emailLayout({ eyebrow, title, body, ctaLabel, ctaHref, code, note }) {
  const cta = ctaLabel && ctaHref
    ? `<tr><td style="padding:24px 0 8px 0;"><a href="${ctaHref}" style="display:inline-block;background:${BRAND.primary};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;line-height:20px;padding:14px 22px;border-radius:999px;">${ctaLabel}</a></td></tr>`
    : "";
  const codeBlock = code
    ? `<tr><td style="padding:18px 0 8px 0;"><div style="display:inline-block;background:#ffffff;border:1px solid ${BRAND.border};border-radius:12px;padding:14px 18px;font-size:28px;letter-spacing:6px;font-weight:800;color:${BRAND.foreground};">${code}</div></td></tr>`
    : "";
  const noteBlock = note
    ? `<tr><td style="padding-top:18px;color:${BRAND.muted};font-size:13px;line-height:20px;">${note}</td></tr>`
    : "";

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.background};font-family:Inter,Arial,sans-serif;color:${BRAND.foreground};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.background};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border:1px solid ${BRAND.border};border-radius:18px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 12px 32px;">
                <a href="${BRAND.siteUrl}" style="display:inline-block;text-decoration:none;">
                  <img src="${BRAND.logoUrl}" width="176" alt="Clinik.Club" style="display:block;border:0;max-width:176px;height:auto;">
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 32px 32px 32px;">
                <div style="color:${BRAND.primary};font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;">${eyebrow}</div>
                <h1 style="margin:0 0 14px 0;font-size:28px;line-height:34px;font-weight:900;color:${BRAND.foreground};">${title}</h1>
                <div style="font-size:16px;line-height:25px;color:${BRAND.muted};">${body}</div>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  ${cta}
                  ${codeBlock}
                  ${noteBlock}
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#f8fcff;border-top:1px solid ${BRAND.border};padding:20px 32px;color:${BRAND.muted};font-size:12px;line-height:18px;">
                Clinik.Club<br>
                Este é um email automático. Se precisar de ajuda, fale com ${BRAND.supportEmail}.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

const payload = {
  mailer_subjects_confirmation: "Confirme seu email na Clinik.Club",
  mailer_templates_confirmation_content: emailLayout({
    eyebrow: "Confirmação de cadastro",
    title: "Confirme seu email",
    body: "Recebemos seu cadastro na Clinik.Club. Confirme seu email para ativar sua conta e continuar usando a plataforma.",
    ctaLabel: "Confirmar email",
    ctaHref: "{{ .ConfirmationURL }}",
    note: "Se você não criou uma conta na Clinik.Club, pode ignorar este email.",
  }),

  mailer_subjects_recovery: "Redefina sua senha da Clinik.Club",
  mailer_templates_recovery_content: emailLayout({
    eyebrow: "Recuperação de senha",
    title: "Redefina sua senha",
    body: "Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha.",
    ctaLabel: "Redefinir senha",
    ctaHref: "{{ .ConfirmationURL }}",
    note: "Se você não solicitou essa alteração, ignore este email. Sua senha atual continuará a mesma.",
  }),

  mailer_subjects_magic_link: "Seu link de acesso da Clinik.Club",
  mailer_templates_magic_link_content: emailLayout({
    eyebrow: "Acesso seguro",
    title: "Entre na sua conta",
    body: "Use o botão abaixo para acessar sua conta Clinik.Club com segurança. Este link expira em alguns minutos.",
    ctaLabel: "Entrar na Clinik.Club",
    ctaHref: "{{ .ConfirmationURL }}",
    note: "Se você não pediu este acesso, ignore este email.",
  }),

  mailer_subjects_invite: "Você foi convidado para a Clinik.Club",
  mailer_templates_invite_content: emailLayout({
    eyebrow: "Convite",
    title: "Aceite seu convite",
    body: "Você recebeu um convite para criar uma conta na Clinik.Club. Clique abaixo para aceitar e configurar seu acesso.",
    ctaLabel: "Aceitar convite",
    ctaHref: "{{ .ConfirmationURL }}",
    note: "Se você não esperava este convite, pode ignorar este email.",
  }),

  mailer_subjects_email_change: "Confirme seu novo email na Clinik.Club",
  mailer_templates_email_change_content: emailLayout({
    eyebrow: "Alteração de email",
    title: "Confirme seu novo email",
    body: "Recebemos uma solicitação para alterar o email da sua conta para <strong>{{ .NewEmail }}</strong>. Confirme abaixo para concluir a alteração.",
    ctaLabel: "Confirmar novo email",
    ctaHref: "{{ .ConfirmationURL }}",
    note: "Se você não solicitou essa alteração, ignore este email e mantenha sua conta protegida.",
  }),

  mailer_subjects_reauthentication: "{{ .Token }} é seu código de verificação",
  mailer_templates_reauthentication_content: emailLayout({
    eyebrow: "Verificação de segurança",
    title: "Confirme que é você",
    body: "Use o código abaixo para confirmar sua identidade na Clinik.Club.",
    code: "{{ .Token }}",
    note: "Nunca compartilhe este código. A equipe Clinik.Club não solicita códigos por telefone ou mensagem.",
  }),

  mailer_notifications_password_changed_enabled: true,
  mailer_subjects_password_changed_notification: "Sua senha da Clinik.Club foi alterada",
  mailer_templates_password_changed_notification_content: emailLayout({
    eyebrow: "Segurança da conta",
    title: "Sua senha foi alterada",
    body: "A senha da sua conta Clinik.Club foi alterada recentemente.",
    ctaLabel: "Acessar conta",
    ctaHref: "{{ .SiteURL }}",
    note: "Se você não fez essa alteração, redefina sua senha imediatamente e fale com nosso suporte.",
  }),

  mailer_notifications_email_changed_enabled: true,
  mailer_subjects_email_changed_notification: "O email da sua conta foi alterado",
  mailer_templates_email_changed_notification_content: emailLayout({
    eyebrow: "Segurança da conta",
    title: "Email alterado",
    body: "O email da sua conta Clinik.Club foi alterado de <strong>{{ .OldEmail }}</strong> para <strong>{{ .Email }}</strong>.",
    ctaLabel: "Acessar conta",
    ctaHref: "{{ .SiteURL }}",
    note: "Se você não fez essa alteração, fale com nosso suporte imediatamente.",
  }),

  mailer_notifications_phone_changed_enabled: true,
  mailer_subjects_phone_changed_notification: "O telefone da sua conta foi alterado",
  mailer_templates_phone_changed_notification_content: emailLayout({
    eyebrow: "Segurança da conta",
    title: "Telefone alterado",
    body: "O telefone da sua conta Clinik.Club foi alterado de <strong>{{ .OldPhone }}</strong> para <strong>{{ .Phone }}</strong>.",
    ctaLabel: "Acessar conta",
    ctaHref: "{{ .SiteURL }}",
    note: "Se você não fez essa alteração, fale com nosso suporte imediatamente.",
  }),

  mailer_notifications_identity_linked_enabled: true,
  mailer_subjects_identity_linked_notification: "Um método de acesso foi conectado à sua conta",
  mailer_templates_identity_linked_notification_content: emailLayout({
    eyebrow: "Segurança da conta",
    title: "Método de acesso conectado",
    body: "Sua conta <strong>{{ .Provider }}</strong> foi conectada como método de acesso para <strong>{{ .Email }}</strong>.",
    ctaLabel: "Acessar conta",
    ctaHref: "{{ .SiteURL }}",
    note: "Se você não fez essa alteração, fale com nosso suporte imediatamente.",
  }),

  mailer_notifications_identity_unlinked_enabled: true,
  mailer_subjects_identity_unlinked_notification: "Um método de acesso foi removido da sua conta",
  mailer_templates_identity_unlinked_notification_content: emailLayout({
    eyebrow: "Segurança da conta",
    title: "Método de acesso removido",
    body: "Sua conta <strong>{{ .Provider }}</strong> foi removida como método de acesso para <strong>{{ .Email }}</strong>.",
    ctaLabel: "Acessar conta",
    ctaHref: "{{ .SiteURL }}",
    note: "Se você não fez essa alteração, fale com nosso suporte imediatamente.",
  }),

  mailer_notifications_mfa_factor_enrolled_enabled: true,
  mailer_subjects_mfa_factor_enrolled_notification: "Um novo método de verificação foi adicionado",
  mailer_templates_mfa_factor_enrolled_notification_content: emailLayout({
    eyebrow: "Segurança da conta",
    title: "Novo método de verificação",
    body: "Um método de verificação do tipo <strong>{{ .FactorType }}</strong> foi adicionado à sua conta Clinik.Club.",
    ctaLabel: "Acessar conta",
    ctaHref: "{{ .SiteURL }}",
    note: "Se você não fez essa alteração, fale com nosso suporte imediatamente.",
  }),

  mailer_notifications_mfa_factor_unenrolled_enabled: true,
  mailer_subjects_mfa_factor_unenrolled_notification: "Um método de verificação foi removido",
  mailer_templates_mfa_factor_unenrolled_notification_content: emailLayout({
    eyebrow: "Segurança da conta",
    title: "Método de verificação removido",
    body: "Um método de verificação do tipo <strong>{{ .FactorType }}</strong> foi removido da sua conta Clinik.Club.",
    ctaLabel: "Acessar conta",
    ctaHref: "{{ .SiteURL }}",
    note: "Se você não fez essa alteração, fale com nosso suporte imediatamente.",
  }),
};

if (!ACCESS_TOKEN) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

if (!response.ok) {
  const text = await response.text();
  throw new Error(`Supabase returned ${response.status}: ${text}`);
}

console.log(`Templates de email atualizados no projeto ${PROJECT_REF}.`);

import * as React from 'react'

import {
  Body, Button, Container, Head, Heading, Html, Hr, Img, Link, Preview, Section, Text,
} from '@react-email/components'
import { brand, styles } from './_brand'

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme a alteração de email no {siteName}</Preview>
    <Body style={styles.main}>
      <Section style={styles.outer}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Link href={brand.siteUrl}><Img src={brand.logoUrl} alt={siteName} style={styles.logo} /></Link>
          </Section>
          <Section style={styles.body}>
            <Heading style={styles.h1}>Confirme seu novo email</Heading>
            <Text style={styles.text}>
              Você pediu para alterar o email da sua conta no <strong>{siteName}</strong> de{' '}
              <Link href={`mailto:${oldEmail}`} style={styles.link}>{oldEmail}</Link> para{' '}
              <Link href={`mailto:${newEmail}`} style={styles.link}>{newEmail}</Link>.
            </Text>
            <Button style={styles.button} href={confirmationUrl}>Confirmar novo email</Button>
            <Hr style={styles.hr} />
            <Text style={styles.footer}>Se você não solicitou essa mudança, proteja sua conta imediatamente trocando a senha.</Text>
          </Section>
        </Container>
      </Section>
    </Body>
  </Html>
)

export default EmailChangeEmail

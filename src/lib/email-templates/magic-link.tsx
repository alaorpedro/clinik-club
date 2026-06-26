import * as React from 'react'

import {
  Body, Button, Container, Head, Heading, Html, Hr, Img, Link, Preview, Section, Text,
} from '@react-email/components'
import { brand, styles } from './_brand'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu link de acesso ao {siteName}</Preview>
    <Body style={styles.main}>
      <Section style={styles.outer}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Link href={brand.siteUrl}>
              <Img src={brand.logoUrl} alt={siteName} style={styles.logo} />
            </Link>
          </Section>
          <Section style={styles.body}>
            <Heading style={styles.h1}>Seu link de acesso</Heading>
            <Text style={styles.text}>
              Clique no botão abaixo para entrar no <strong>{siteName}</strong>. O link expira em alguns minutos.
            </Text>
            <Button style={styles.button} href={confirmationUrl}>Entrar</Button>
            <Hr style={styles.hr} />
            <Text style={styles.footer}>Se não foi você que solicitou, ignore este email.</Text>
          </Section>
        </Container>
      </Section>
    </Body>
  </Html>
)

export default MagicLinkEmail

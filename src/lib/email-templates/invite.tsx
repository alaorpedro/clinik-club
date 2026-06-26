import * as React from 'react'

import {
  Body, Button, Container, Head, Heading, Html, Hr, Img, Link, Preview, Section, Text,
} from '@react-email/components'
import { brand, styles } from './_brand'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Você foi convidado para o {siteName}</Preview>
    <Body style={styles.main}>
      <Section style={styles.outer}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Link href={siteUrl}><Img src={brand.logoUrl} alt={siteName} style={styles.logo} /></Link>
          </Section>
          <Section style={styles.body}>
            <Heading style={styles.h1}>Você foi convidado(a)</Heading>
            <Text style={styles.text}>
              Você recebeu um convite para participar do <strong>{siteName}</strong>. Clique no botão abaixo para aceitar e criar sua conta.
            </Text>
            <Button style={styles.button} href={confirmationUrl}>Aceitar convite</Button>
            <Hr style={styles.hr} />
            <Text style={styles.footer}>Se não estava esperando este convite, pode ignorar este email com segurança.</Text>
          </Section>
        </Container>
      </Section>
    </Body>
  </Html>
)

export default InviteEmail

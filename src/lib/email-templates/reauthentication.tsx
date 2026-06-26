import * as React from 'react'

import {
  Body, Container, Head, Heading, Html, Hr, Img, Link, Preview, Section, Text,
} from '@react-email/components'
import { brand, styles } from './_brand'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu código de verificação Clinik.Club</Preview>
    <Body style={styles.main}>
      <Section style={styles.outer}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Link href={brand.siteUrl}><Img src={brand.logoUrl} alt="Clinik.Club" style={styles.logo} /></Link>
          </Section>
          <Section style={styles.body}>
            <Heading style={styles.h1}>Confirmar identidade</Heading>
            <Text style={styles.text}>Use o código abaixo para confirmar sua identidade:</Text>
            <Text style={styles.code}>{token}</Text>
            <Hr style={styles.hr} />
            <Text style={styles.footer}>Este código expira em alguns minutos. Se não foi você, ignore este email.</Text>
          </Section>
        </Container>
      </Section>
    </Body>
  </Html>
)

export default ReauthenticationEmail

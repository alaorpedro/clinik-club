import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Hr,
  Img,
  Link,
  Section,
  Preview,
  Text,
} from '@react-email/components'
import { brand, styles } from './_brand'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Redefina sua senha do {siteName}</Preview>
    <Body style={styles.main}>
      <Section style={styles.outer}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Link href={brand.siteUrl}>
              <Img src={brand.logoUrl} alt={siteName} style={styles.logo} />
            </Link>
          </Section>
          <Section style={styles.body}>
            <Heading style={styles.h1}>Redefinir sua senha</Heading>
            <Text style={styles.text}>
              Recebemos um pedido para redefinir a senha da sua conta no{' '}
              <strong>{siteName}</strong>. Clique no botão abaixo para
              escolher uma nova senha. Este link expira em 1 hora.
            </Text>
            <Button style={styles.button} href={confirmationUrl}>
              Redefinir senha
            </Button>
            <Hr style={styles.hr} />
            <Text style={styles.footer}>
              Se você não solicitou essa alteração, pode ignorar este email —
              sua senha não será modificada. Dúvidas? Escreva para
              contato@clinik.club.
            </Text>
          </Section>
        </Container>
      </Section>
    </Body>
  </Html>
)

export default RecoveryEmail

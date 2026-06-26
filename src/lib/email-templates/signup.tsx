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
  Section,
  Link,
  Preview,
  Text,
} from '@react-email/components'
import { brand, styles } from './_brand'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme seu email para acessar o {siteName}</Preview>
    <Body style={styles.main}>
      <Section style={styles.outer}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Link href={siteUrl || brand.siteUrl}>
              <Img src={brand.logoUrl} alt={siteName} style={styles.logo} />
            </Link>
          </Section>
          <Section style={styles.body}>
            <Heading style={styles.h1}>Confirme seu email</Heading>
            <Text style={styles.text}>
              Bem-vindo(a) ao <strong>{siteName}</strong>! Para ativar sua
              conta ({recipient}), clique no botão abaixo:
            </Text>
            <Button style={styles.button} href={confirmationUrl}>
              Confirmar email
            </Button>
            <Hr style={styles.hr} />
            <Text style={styles.footer}>
              Se você não criou esta conta, pode ignorar este email com
              segurança. Em caso de dúvidas, responda este email ou escreva
              para contato@clinik.club.
            </Text>
          </Section>
        </Container>
      </Section>
    </Body>
  </Html>
)

export default SignupEmail

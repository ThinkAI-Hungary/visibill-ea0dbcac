import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface PasswordResetProps {
  supabase_url: string
  email_action_type: string
  redirect_to: string
  token_hash: string
  token: string
}

export const PasswordReset = ({
  token,
  supabase_url,
  email_action_type,
  redirect_to,
  token_hash,
}: PasswordResetProps) => (
  <Html>
    <Head />
    <Preview>Jelszó visszaállítás</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Jelszó visszaállítás</Heading>
        <Text style={text}>
          Jelszó visszaállítást kértél. Kérjük, másold be az alábbi egyszer használatos biztonsági kódot a weboldalon megnyílt felületre:
        </Text>
        
        <div style={{ margin: '24px 0', textAlign: 'center' }}>
          <code style={code}>{token}</code>
        </div>

        <Text style={{ ...text, marginTop: '32px', marginBottom: '8px', fontWeight: 'bold' }}>
          Biztonsági kapcsolat (Fallback link):
        </Text>
        <Text style={{ ...text, marginTop: '0px', color: '#666666', fontSize: '13px' }}>
          Ha az egyszer használatos kód nem működik, vagy a böngészőablakot véletlenül bezártad, kattints az alábbi linkre a közvetlen visszaállításhoz:
        </Text>

        <Link
          href={`${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`}
          target="_blank"
          style={{
            ...link,
            display: 'inline-block',
            padding: '10px 20px',
            backgroundColor: '#f4f4f4',
            border: '1px solid #dcdcdc',
            color: '#333333',
            textDecoration: 'none',
            borderRadius: '5px',
            fontSize: '13px',
            marginBottom: '24px',
          }}
        >
          Közvetlen jelszó visszaállítás (Link)
        </Link>

        <Text
          style={{
            ...text,
            color: '#ababab',
            marginTop: '24px',
            marginBottom: '16px',
          }}
        >
          Ha nem te kérted a jelszó visszaállítást, nyugodtan figyelmen kívül hagyhatod ezt az emailt.
        </Text>
        <Text style={footer}>
          <Link
            href="https://visibill.hu"
            target="_blank"
            style={{ ...link, color: '#898989' }}
          >
            Visibill
          </Link>
          {' '}– Számlakezelés egyszerűen
        </Text>
      </Container>
    </Body>
  </Html>
)

export default PasswordReset

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
}

const container = {
  paddingLeft: '12px',
  paddingRight: '12px',
  margin: '0 auto',
  maxWidth: '600px',
}

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0',
}

const link = {
  color: '#0070f3',
  fontSize: '14px',
  textDecoration: 'underline',
}

const text = {
  color: '#333',
  fontSize: '14px',
  margin: '24px 0',
  lineHeight: '1.5',
}

const footer = {
  color: '#898989',
  fontSize: '12px',
  lineHeight: '22px',
  marginTop: '12px',
  marginBottom: '24px',
}

const code = {
  display: 'inline-block',
  padding: '16px 4.5%',
  width: '90.5%',
  backgroundColor: '#f4f4f4',
  borderRadius: '5px',
  border: '1px solid #eee',
  color: '#333',
  fontSize: '16px',
  fontWeight: 'bold',
  letterSpacing: '2px',
  textAlign: 'center' as const,
}

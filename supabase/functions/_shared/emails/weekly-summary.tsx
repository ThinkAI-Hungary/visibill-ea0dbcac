import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
  Row,
  Column,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface WeeklySummaryEmailProps {
  userName: string;
  companyName: string;
  weekStart: string;
  weekEnd: string;
  // Financial summary
  outboundCount: number;
  outboundNetAmount: number;
  outboundGrossAmount: number;
  inboundCount: number;
  inboundNetAmount: number;
  inboundGrossAmount: number;
  vatPosition: number;
  // Tasks
  payableCount: number;
  payableAmount: number;
  missingCount: number;
  // Activity
  newNavInvoices: number;
  uploadedInvoices: number;
  processingErrors: number;
  // Links
  dashboardUrl: string;
  invoicesUrl: string;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('hu-HU', {
    style: 'currency',
    currency: 'HUF',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const WeeklySummaryEmail = ({
  userName,
  companyName,
  weekStart,
  weekEnd,
  outboundCount,
  outboundNetAmount,
  outboundGrossAmount,
  inboundCount,
  inboundNetAmount,
  inboundGrossAmount,
  vatPosition,
  payableCount,
  payableAmount,
  missingCount,
  newNavInvoices,
  uploadedInvoices,
  processingErrors,
  dashboardUrl,
  invoicesUrl,
}: WeeklySummaryEmailProps) => (
  <Html>
    <Head />
    <Preview>Visibill heti összesítő - {weekStart} - {weekEnd}</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header */}
        <Section style={headerSection}>
          <Heading style={logo}>Visibill</Heading>
          <Text style={subtitle}>Heti Összesítő</Text>
          <Text style={dateRange}>{weekStart} - {weekEnd}</Text>
        </Section>

        <Text style={greeting}>
          Kedves {userName || 'Felhasználó'}!
        </Text>

        <Text style={intro}>
          Íme a(z) <strong>{companyName}</strong> elmúlt hetének összesítője:
        </Text>

        {/* Financial Summary */}
        <Section style={section}>
          <Heading as="h2" style={sectionTitle}>
            📊 Pénzügyi Összesítő
          </Heading>
          
          <Section style={statsGrid}>
            <Row>
              <Column style={statCard}>
                <Text style={statLabel}>Kimenő számlák</Text>
                <Text style={statValue}>{outboundCount} db</Text>
                <Text style={statSubValue}>
                  Nettó: {formatCurrency(outboundNetAmount)}
                </Text>
                <Text style={statSubValue}>
                  Bruttó: {formatCurrency(outboundGrossAmount)}
                </Text>
              </Column>
              <Column style={statCard}>
                <Text style={statLabel}>Bejövő számlák</Text>
                <Text style={statValue}>{inboundCount} db</Text>
                <Text style={statSubValue}>
                  Nettó: {formatCurrency(inboundNetAmount)}
                </Text>
                <Text style={statSubValue}>
                  Bruttó: {formatCurrency(inboundGrossAmount)}
                </Text>
              </Column>
            </Row>
          </Section>

          <Section style={vatSection}>
            <Text style={vatLabel}>Becsült ÁFA pozíció</Text>
            <Text style={vatPosition >= 0 ? vatValuePositive : vatValueNegative}>
              {formatCurrency(vatPosition)}
            </Text>
            <Text style={vatHint}>
              {vatPosition >= 0 
                ? '(Fizetendő ÁFA)' 
                : '(Visszaigényelhető ÁFA)'}
            </Text>
          </Section>
        </Section>

        <Hr style={divider} />

        {/* Tasks */}
        <Section style={section}>
          <Heading as="h2" style={sectionTitle}>
            ⚠️ Teendők
          </Heading>
          
          {payableCount > 0 || missingCount > 0 ? (
            <Section>
              {payableCount > 0 && (
                <Section style={taskItem}>
                  <Text style={taskTitle}>
                    🔴 Fizetendő számlák: {payableCount} db
                  </Text>
                  <Text style={taskDetail}>
                    Összesen: {formatCurrency(payableAmount)}
                  </Text>
                </Section>
              )}
              {missingCount > 0 && (
                <Section style={taskItem}>
                  <Text style={taskTitle}>
                    🟡 Hiányzó (nem beküldött) számlák: {missingCount} db
                  </Text>
                </Section>
              )}
            </Section>
          ) : (
            <Text style={noTasks}>
              ✅ Nincs teendő - minden rendben!
            </Text>
          )}
        </Section>

        <Hr style={divider} />

        {/* Activity */}
        <Section style={section}>
          <Heading as="h2" style={sectionTitle}>
            📈 Heti Aktivitás
          </Heading>
          
          <Section style={activityGrid}>
            <Text style={activityItem}>
              • Új NAV számlák: <strong>{newNavInvoices} db</strong>
            </Text>
            <Text style={activityItem}>
              • Feltöltött számlák: <strong>{uploadedInvoices} db</strong>
            </Text>
            {processingErrors > 0 && (
              <Text style={activityItemError}>
                • Feldolgozási hibák: <strong>{processingErrors} db</strong>
              </Text>
            )}
          </Section>
        </Section>

        <Hr style={divider} />

        {/* Quick Links */}
        <Section style={linksSection}>
          <Link href={dashboardUrl} style={primaryButton}>
            Irány a Dashboard
          </Link>
          <Link href={invoicesUrl} style={secondaryLink}>
            Számlák megtekintése
          </Link>
        </Section>

        {/* Footer */}
        <Section style={footer}>
          <Text style={footerText}>
            Ez az email automatikusan lett kiküldve a Visibill rendszerből.
          </Text>
          <Text style={footerText}>
            Ha nem szeretnél több heti összesítőt kapni, a{' '}
            <Link href={`${dashboardUrl}/settings`} style={footerLink}>
              Beállításokban
            </Link>{' '}
            tudod kikapcsolni.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default WeeklySummaryEmail

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
  borderRadius: '8px',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
}

const headerSection = {
  padding: '32px 40px 24px',
  textAlign: 'center' as const,
  backgroundColor: '#0d9488',
  borderRadius: '8px 8px 0 0',
}

const logo = {
  color: '#ffffff',
  fontSize: '32px',
  fontWeight: 'bold' as const,
  margin: '0 0 8px',
}

const subtitle = {
  color: '#99f6e4',
  fontSize: '18px',
  margin: '0 0 4px',
}

const dateRange = {
  color: '#99f6e4',
  fontSize: '14px',
  margin: '0',
}

const greeting = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '24px',
  padding: '32px 40px 0',
}

const intro = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '24px',
  padding: '8px 40px 16px',
}

const section = {
  padding: '0 40px',
}

const sectionTitle = {
  color: '#111827',
  fontSize: '18px',
  fontWeight: '600' as const,
  margin: '24px 0 16px',
}

const statsGrid = {
  width: '100%',
}

const statCard = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  padding: '16px',
  textAlign: 'center' as const,
  width: '48%',
}

const statLabel = {
  color: '#6b7280',
  fontSize: '12px',
  fontWeight: '500' as const,
  textTransform: 'uppercase' as const,
  margin: '0 0 8px',
}

const statValue = {
  color: '#111827',
  fontSize: '24px',
  fontWeight: 'bold' as const,
  margin: '0 0 4px',
}

const statSubValue = {
  color: '#6b7280',
  fontSize: '13px',
  margin: '2px 0',
}

const vatSection = {
  backgroundColor: '#f0fdfa',
  borderRadius: '8px',
  padding: '20px',
  marginTop: '16px',
  textAlign: 'center' as const,
}

const vatLabel = {
  color: '#0d9488',
  fontSize: '14px',
  fontWeight: '500' as const,
  margin: '0 0 8px',
}

const vatValuePositive = {
  color: '#dc2626',
  fontSize: '28px',
  fontWeight: 'bold' as const,
  margin: '0',
}

const vatValueNegative = {
  color: '#16a34a',
  fontSize: '28px',
  fontWeight: 'bold' as const,
  margin: '0',
}

const vatHint = {
  color: '#6b7280',
  fontSize: '12px',
  margin: '4px 0 0',
}

const divider = {
  borderColor: '#e5e7eb',
  margin: '24px 40px',
}

const taskItem = {
  backgroundColor: '#fef3c7',
  borderRadius: '8px',
  padding: '12px 16px',
  marginBottom: '8px',
}

const taskTitle = {
  color: '#92400e',
  fontSize: '14px',
  fontWeight: '500' as const,
  margin: '0',
}

const taskDetail = {
  color: '#92400e',
  fontSize: '13px',
  margin: '4px 0 0',
}

const noTasks = {
  color: '#16a34a',
  fontSize: '14px',
  backgroundColor: '#dcfce7',
  borderRadius: '8px',
  padding: '12px 16px',
}

const activityGrid = {
  padding: '0',
}

const activityItem = {
  color: '#374151',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '0',
}

const activityItemError = {
  color: '#dc2626',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '0',
}

const linksSection = {
  padding: '24px 40px',
  textAlign: 'center' as const,
}

const primaryButton = {
  backgroundColor: '#0d9488',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: '600' as const,
  padding: '12px 24px',
  textDecoration: 'none',
  marginBottom: '12px',
}

const secondaryLink = {
  color: '#0d9488',
  display: 'block',
  fontSize: '14px',
  textDecoration: 'underline',
}

const footer = {
  padding: '24px 40px',
  textAlign: 'center' as const,
}

const footerText = {
  color: '#9ca3af',
  fontSize: '12px',
  lineHeight: '20px',
  margin: '0 0 8px',
}

const footerLink = {
  color: '#0d9488',
  textDecoration: 'underline',
}

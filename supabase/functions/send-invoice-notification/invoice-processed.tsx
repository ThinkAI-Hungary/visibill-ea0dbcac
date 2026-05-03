import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
  Section,
  Hr,
} from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface InvoiceProcessedEmailProps {
  name: string;
  fileName: string;
  status: 'success' | 'error';
  errorMessage?: string;
  invoiceDetails?: {
    seller?: string;
    amount?: string;
    date?: string;
  };
}

export const InvoiceProcessedEmail = ({
  name,
  fileName,
  status,
  errorMessage,
  invoiceDetails,
}: InvoiceProcessedEmailProps) => (
  <Html>
    <Head />
    <Preview>
      {status === 'success' 
        ? 'Your invoice has been processed successfully' 
        : 'Invoice processing encountered an error'}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {status === 'success' ? '✅ Invoice Processed' : '⚠️ Processing Error'}
        </Heading>
        
        <Text style={text}>
          Hi {name || 'there'},
        </Text>
        
        {status === 'success' ? (
          <>
            <Text style={text}>
              Your invoice <strong>{fileName}</strong> has been successfully processed and added to your account.
            </Text>
            
            {invoiceDetails && (
              <Section style={detailsBox}>
                <Heading style={h2}>Invoice Details:</Heading>
                {invoiceDetails.seller && (
                  <Text style={detailText}>
                    <strong>Seller:</strong> {invoiceDetails.seller}
                  </Text>
                )}
                {invoiceDetails.amount && (
                  <Text style={detailText}>
                    <strong>Amount:</strong> {invoiceDetails.amount}
                  </Text>
                )}
                {invoiceDetails.date && (
                  <Text style={detailText}>
                    <strong>Date:</strong> {invoiceDetails.date}
                  </Text>
                )}
              </Section>
            )}
            
            <Text style={text}>
              You can view the full details in your dashboard.
            </Text>
          </>
        ) : (
          <>
            <Text style={text}>
              We encountered an issue while processing your invoice <strong>{fileName}</strong>.
            </Text>
            
            {errorMessage && (
              <Section style={errorBox}>
                <Text style={errorText}>
                  <strong>Error:</strong> {errorMessage}
                </Text>
              </Section>
            )}
            
            <Text style={text}>
              Please check the invoice file and try uploading it again. If the problem persists, contact our support team.
            </Text>
          </>
        )}
        
        <Hr style={hr} />
        
        <Text style={footer}>
          Best regards,
          <br />
          The Visibill Team
        </Text>
      </Container>
    </Body>
  </Html>
);

export default InvoiceProcessedEmail;

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const h1 = {
  color: '#1a1a1a',
  fontSize: '32px',
  fontWeight: '700',
  margin: '40px 0',
  padding: '0',
  textAlign: 'center' as const,
};

const h2 = {
  color: '#1a1a1a',
  fontSize: '18px',
  fontWeight: '600',
  margin: '16px 0 12px',
};

const text = {
  color: '#484848',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 0',
};

const detailsBox = {
  backgroundColor: '#f6f9fc',
  borderRadius: '8px',
  padding: '16px',
  margin: '24px 0',
};

const detailText = {
  color: '#484848',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '8px 0',
};

const errorBox = {
  backgroundColor: '#fff5f5',
  borderLeft: '4px solid #e53e3e',
  borderRadius: '4px',
  padding: '16px',
  margin: '24px 0',
};

const errorText = {
  color: '#c53030',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0',
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '32px 0',
};

const footer = {
  color: '#8898aa',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '32px 0 0',
};

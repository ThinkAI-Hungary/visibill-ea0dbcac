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

interface WelcomeEmailProps {
  name: string;
  email: string;
}

export const WelcomeEmail = ({ name, email }: WelcomeEmailProps) => (
  <Html>
    <Head />
    <Preview>Welcome to Visibill - Your Invoice Management Platform</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Welcome to Visibill! 🎉</Heading>
        
        <Text style={text}>
          Hi {name || 'there'},
        </Text>
        
        <Text style={text}>
          Thank you for joining Visibill! We're excited to help you streamline your invoice management and accounting processes.
        </Text>
        
        <Section style={features}>
          <Heading style={h2}>What you can do with Visibill:</Heading>
          <Text style={featureItem}>✅ Upload and process invoices automatically</Text>
          <Text style={featureItem}>✅ Connect to NAV (Hungarian Tax Authority) for seamless integration</Text>
          <Text style={featureItem}>✅ Manage email aliases for invoice receipt</Text>
          <Text style={featureItem}>✅ Track salaries and tax obligations</Text>
          <Text style={featureItem}>✅ Generate comprehensive financial reports</Text>
        </Section>
        
        <Hr style={hr} />
        
        <Section>
          <Heading style={h2}>Get Started:</Heading>
          <Text style={text}>
            1. <strong>Set up NAV integration</strong> - Connect your NAV credentials in the Integrations section
          </Text>
          <Text style={text}>
            2. <strong>Create email aliases</strong> - Set up custom email addresses to receive invoices
          </Text>
          <Text style={text}>
            3. <strong>Upload your first invoice</strong> - Start managing your invoices right away
          </Text>
        </Section>
        
        <Hr style={hr} />
        
        <Text style={text}>
          If you have any questions or need assistance, feel free to reach out to our support team.
        </Text>
        
        <Text style={footer}>
          Best regards,
          <br />
          The Visibill Team
        </Text>
      </Container>
    </Body>
  </Html>
);

export default WelcomeEmail;

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
  fontSize: '20px',
  fontWeight: '600',
  margin: '24px 0 16px',
};

const text = {
  color: '#484848',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 0',
};

const features = {
  margin: '24px 0',
};

const featureItem = {
  color: '#484848',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '8px 0',
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

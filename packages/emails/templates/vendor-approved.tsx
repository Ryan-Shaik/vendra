import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'

interface VendorApprovedEmailProps {
  storeName:      string
  vendorName:     string
  onboardingUrl:  string
}

export function VendorApprovedEmail({
  storeName,
  vendorName,
  onboardingUrl,
}: VendorApprovedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your store {storeName} has been approved on Vendra</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>
            Welcome to Vendra, {vendorName}
          </Heading>
          <Text style={styles.text}>
            Your store <strong>{storeName}</strong> has been approved.
            Complete your onboarding to start listing products and receiving orders.
          </Text>
          <Section style={{ marginTop: '24px' }}>
            <Button href={onboardingUrl} style={styles.button}>
              Complete onboarding
            </Button>
          </Section>
          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            Vendra Marketplace &middot; Questions? Reply to this email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export function vendorApprovedSubject(storeName: string): string {
  return `Your store "${storeName}" is approved — welcome to Vendra`
}

const styles = {
  body: {
    backgroundColor: '#F9F8F6',
    fontFamily:      'sans-serif',
  },
  container: {
    maxWidth:  '600px',
    margin:    '0 auto',
    padding:   '40px 20px',
  },
  heading: {
    color:      '#1C1C1A',
    fontSize:   '24px',
    fontWeight: '700',
    margin:     '0 0 16px',
  },
  text: {
    color:      '#6B6B67',
    fontSize:   '16px',
    lineHeight: '1.6',
  },
  button: {
    backgroundColor: '#1A6B4A',
    color:           '#FFFFFF',
    padding:         '12px 24px',
    borderRadius:    '10px',
    textDecoration:  'none',
    display:         'inline-block',
  },
  hr: {
    borderColor: 'rgba(28,28,26,0.12)',
    margin:      '32px 0',
  },
  footer: {
    color:    '#6B6B67',
    fontSize: '12px',
  },
} as const

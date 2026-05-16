import { Html, Head, Body, Container, Text } from '@react-email/components'
import * as React from 'react'

interface OrderConfirmationEmailProps {
  orderId:      string
  customerName: string
  items:        Array<{ name: string; quantity: number; price: string }>
  total:        string
  trackingUrl:  string
}

export function OrderConfirmationEmail({
  orderId,
  customerName,
  items,
  total,
  trackingUrl,
}: OrderConfirmationEmailProps) {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          {/* TODO: Complete in Order Management spec */}
          <Text>Order confirmation stub — {orderId}, {customerName}, {items.length} items, {total}, {trackingUrl}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export function orderConfirmationSubject(orderId: string): string {
  return `Order confirmed — #${orderId}`
}

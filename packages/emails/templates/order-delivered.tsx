import { Html, Head, Body, Container, Text } from '@react-email/components'
import * as React from 'react'

interface OrderDeliveredEmailProps {
  orderId:      string
  customerName: string
  reviewUrl:    string
}

export function OrderDeliveredEmail({
  orderId,
  customerName,
  reviewUrl,
}: OrderDeliveredEmailProps) {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          {/* TODO: Complete in Order Management spec */}
          <Text>Order delivered stub — {orderId}, {customerName}, {reviewUrl}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export function orderDeliveredSubject(orderId: string): string {
  return `Your order #${orderId} has been delivered`
}

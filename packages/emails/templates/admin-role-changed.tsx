import { Html, Head, Body, Container, Text } from '@react-email/components'
import * as React from 'react'

interface AdminRoleChangedEmailProps {
  recipientName: string
  oldRole:       string
  newRole:       string
}

export function AdminRoleChangedEmail({
  recipientName,
  oldRole,
  newRole,
}: AdminRoleChangedEmailProps) {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          {/* TODO: Complete in Admin Role Management spec */}
          <Text>Admin role changed stub — {recipientName}, {oldRole}, {newRole}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export function adminRoleChangedSubject(newRole: string): string {
  return `Your Vendra account role has been updated to ${newRole}`
}

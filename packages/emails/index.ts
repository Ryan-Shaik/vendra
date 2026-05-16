// Core
export { resend }    from './client'
export { sendEmail } from './send'

// Templates
export {
  VendorApprovedEmail,
  vendorApprovedSubject,
} from './templates/vendor-approved'
export {
  VendorRejectedEmail,
  vendorRejectedSubject,
} from './templates/vendor-rejected'
export {
  VendorSuspendedEmail,
  vendorSuspendedSubject,
} from './templates/vendor-suspended'
export {
  VendorNewOrderEmail,
  vendorNewOrderSubject,
} from './templates/vendor-new-order'
export {
  VendorPayoutReleasedEmail,
  vendorPayoutReleasedSubject,
} from './templates/vendor-payout-released'
export {
  VendorPayoutHeldEmail,
  vendorPayoutHeldSubject,
} from './templates/vendor-payout-held'
export {
  OrderConfirmationEmail,
  orderConfirmationSubject,
} from './templates/order-confirmation'
export {
  OrderShippedEmail,
  orderShippedSubject,
} from './templates/order-shipped'
export {
  OrderDeliveredEmail,
  orderDeliveredSubject,
} from './templates/order-delivered'
export {
  DisputeOpenedEmail,
  disputeOpenedSubject,
} from './templates/dispute-opened'
export {
  DisputeResolvedEmail,
  disputeResolvedSubject,
} from './templates/dispute-resolved'
export {
  CustomerWelcomeEmail,
  customerWelcomeSubject,
} from './templates/customer-welcome'
export {
  AdminRoleChangedEmail,
  adminRoleChangedSubject,
} from './templates/admin-role-changed'

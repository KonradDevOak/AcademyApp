// The academy's payment redirect is the app-wide one — kept under its original name so academy code and
// specs keep injecting/providing the same DI token.
export { PaymentRedirectService as AcademyPaymentRedirectService } from '../shared/payments/payment-redirect';

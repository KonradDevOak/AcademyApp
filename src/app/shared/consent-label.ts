import { PendingMemberConsentDto } from '../core/models/member';

const KNOWN_DOCUMENT_TYPES = ['StudioTerms', 'StudioRodo'];

// Translation key naming a club document in the consent list. An unknown document type falls back to its raw
// version label (the translate pipe echoes a non-key string back unchanged).
export function consentLabelKey(consent: PendingMemberConsentDto): string {
  return KNOWN_DOCUMENT_TYPES.includes(consent.documentType)
    ? `legal.consentLabels.${consent.documentType}`
    : consent.versionLabel;
}

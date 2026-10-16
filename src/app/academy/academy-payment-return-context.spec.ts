import {
  clearAcademyPaymentReturnContext,
  readAcademyPaymentReturnContext,
  saveAcademyPaymentReturnContext
} from './academy-payment-return-context';

describe('academy-payment-return-context', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing was saved', () => {
    expect(readAcademyPaymentReturnContext()).toBeNull();
  });

  it('round-trips a saved context', () => {
    saveAcademyPaymentReturnContext({ guardianChargeId: 'gc-1' });

    expect(readAcademyPaymentReturnContext()).toEqual({ guardianChargeId: 'gc-1' });
  });

  it('does not remove the context on read, so a page reload can resume polling', () => {
    saveAcademyPaymentReturnContext({ guardianChargeId: 'gc-1' });

    readAcademyPaymentReturnContext();

    expect(readAcademyPaymentReturnContext()).toEqual({ guardianChargeId: 'gc-1' });
  });

  it('clears the context', () => {
    saveAcademyPaymentReturnContext({ guardianChargeId: 'gc-1' });

    clearAcademyPaymentReturnContext();

    expect(readAcademyPaymentReturnContext()).toBeNull();
  });

  it('returns null for malformed JSON instead of throwing', () => {
    localStorage.setItem('academy.academy-payment-return', '{not json');

    expect(readAcademyPaymentReturnContext()).toBeNull();
  });

  it('returns null when the stored object has no guardianChargeId (e.g. a stale pre-guardian entry)', () => {
    localStorage.setItem('academy.academy-payment-return', JSON.stringify({ athleteId: 'ath-1' }));

    expect(readAcademyPaymentReturnContext()).toBeNull();
  });
});

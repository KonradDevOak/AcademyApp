import { clearInviteContext, readInviteContext, saveInviteContext } from './invite-context';

describe('invite-context', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing was saved', () => {
    expect(readInviteContext()).toBeNull();
  });

  it('round-trips a saved context', () => {
    saveInviteContext({ token: 'tok-1', storefrontId: 'sf-1' });

    expect(readInviteContext()).toEqual({ token: 'tok-1', storefrontId: 'sf-1' });
  });

  it('does not remove the context on read, so a page reload can resume the flow', () => {
    saveInviteContext({ token: 'tok-1', storefrontId: 'sf-1' });

    readInviteContext();

    expect(readInviteContext()).toEqual({ token: 'tok-1', storefrontId: 'sf-1' });
  });

  it('clears the context', () => {
    saveInviteContext({ token: 'tok-1', storefrontId: 'sf-1' });

    clearInviteContext();

    expect(readInviteContext()).toBeNull();
  });

  it('returns null for malformed JSON instead of throwing', () => {
    localStorage.setItem('academy.academy-invite-context', '{not json');

    expect(readInviteContext()).toBeNull();
  });

  it('returns null when the stored object is missing a required field', () => {
    localStorage.setItem('academy.academy-invite-context', JSON.stringify({ token: 'tok-1' }));

    expect(readInviteContext()).toBeNull();
  });
});

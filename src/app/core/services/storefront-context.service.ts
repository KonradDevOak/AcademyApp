import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Preferences } from '@capacitor/preferences';
import { ActionSheetController } from '@ionic/angular/standalone';
import { MembershipDto } from '../models/member.model';

const STORAGE_KEY = 'selected-storefront-id';

// Grafik/Karnet are storefront-scoped, but a member can belong to several clubs — this holds "which
// club am I currently looking at" so those tabs don't force a picker tap on every visit for the common
// (one-club) case. Persisted so the choice survives an app restart.
@Injectable({ providedIn: 'root' })
export class StorefrontContextService {
  private readonly actionSheetController = inject(ActionSheetController);
  private readonly subject = new BehaviorSubject<string | null>(null);
  private restored = false;

  readonly selectedStorefrontId$ = this.subject.asObservable();

  get current(): string | null {
    return this.subject.value;
  }

  async select(storefrontId: string): Promise<void> {
    this.subject.next(storefrontId);
    await Preferences.set({ key: STORAGE_KEY, value: storefrontId });
  }

  async clear(): Promise<void> {
    this.subject.next(null);
    await Preferences.remove({ key: STORAGE_KEY });
  }

  private async restore(): Promise<void> {
    if (this.restored) return;
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    this.subject.next(value);
    this.restored = true;
  }

  // Resolves which storefront a Grafik/Karnet-style page should show, given the member's current
  // memberships: zero → null (caller shows an empty state), one → auto-selected silently, more than
  // one and no valid remembered choice → an ActionSheet picker. Returns null if the user dismisses the
  // picker without choosing.
  async resolve(memberships: MembershipDto[]): Promise<string | null> {
    await this.restore();

    if (memberships.length === 0) {
      await this.clear();
      return null;
    }

    if (memberships.length === 1) {
      await this.select(memberships[0].storefrontId);
      return this.current;
    }

    const remembered = this.current;
    if (remembered && memberships.some((m) => m.storefrontId === remembered)) {
      return remembered;
    }

    return this.pickStorefront(memberships);
  }

  // Read-only variant of resolve(): never auto-selects a single membership and never opens the picker.
  // Used to check "is a club already chosen" without forcing a choice — e.g. deciding whether to land
  // on Grafik straight after login/app restart, or highlighting the active tile on "Moje kluby".
  async getPersistedIfValid(memberships: MembershipDto[]): Promise<string | null> {
    await this.restore();
    return this.current && memberships.some((m) => m.storefrontId === this.current) ? this.current : null;
  }

  async pickStorefront(memberships: MembershipDto[]): Promise<string | null> {
    return new Promise((resolve) => {
      this.actionSheetController
        .create({
          header: 'Wybierz klub',
          buttons: [
            ...memberships.map((m) => ({
              text: m.storefrontName ?? 'Klub ' + m.storefrontId.substring(0, 8),
              handler: () => {
                this.select(m.storefrontId).then(() => resolve(m.storefrontId));
              }
            })),
            { text: 'Anuluj', role: 'cancel', handler: () => resolve(null) }
          ]
        })
        .then((sheet) => sheet.present());
    });
  }
}

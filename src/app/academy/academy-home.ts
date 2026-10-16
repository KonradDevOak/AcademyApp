import { ChangeDetectionStrategy, Component, effect, signal, viewChild } from '@angular/core';
import { IonAccordion, IonAccordionGroup, IonItem, IonLabel } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { AcademyChildrenComponent } from './children/academy-children';
import { AcademyPaymentsComponent } from './payments/academy-payments';

// Academy landing. Renders the parent's payments (the one place they see and pay what the club agreed for
// all their children) and the roster as a single-open accordion (only one of the two sections expanded at
// a time), ordered and seeded-open by whether the current period is already paid: due/no-charge-yet keeps
// payments on top and open (needs attention), paid pushes it below the roster and opens that instead
// (nothing to act on); no amount set by the organizer yet keeps payments on top but opens the roster — see the template's [class.academy-home--settled] binding, academy-home.scss, and
// the childrenExpanded seeding below. When the trainer/owner role lands (no backend support yet),
// branch here: parent -> <app-academy-payments> + <app-academy-children>, trainer
// -> their groups. Kept as the role-aware entry point instead of routing straight to the list.
@Component({
  selector: 'app-academy-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonAccordionGroup, IonAccordion, IonItem, IonLabel, TranslatePipe, AcademyPaymentsComponent, AcademyChildrenComponent],
  templateUrl: './academy-home.html',
  styleUrl: './academy-home.scss'
})
export class AcademyHomeComponent {
  protected readonly paymentsCmp = viewChild.required(AcademyPaymentsComponent);

  // Which panel is open (true = roster, false = payments). Defaults to the roster per the original ask,
  // then seeded once from the real payment status below — after that it's left alone, so the user's own
  // taps aren't fought: the group's `value` binding is re-pushed on every change-detection cycle, so a
  // binding kept live against currentPeriodPaid() would snap a manually-opened panel back shut the moment
  // anything else triggers a CD run.
  protected readonly childrenExpanded = signal(true);
  private seeded = false;

  constructor() {
    effect(() => {
      if (this.seeded) {
        return;
      }
      const payments = this.paymentsCmp();
      if (!payments.resolved()) {
        return;
      }
      this.childrenExpanded.set(payments.currentPeriodPaid() || payments.hasNothing());
      this.seeded = true;
    });
  }

  // Single-open, never both closed: collapsing the open panel opens the other one. ionChange also bubbles
  // up from form controls inside the panels — only the group's own event counts.
  protected onPanelChange(event: Event): void {
    if (event.target !== event.currentTarget) {
      return;
    }
    const value = (event as CustomEvent<{ value?: string | string[] | null }>).detail.value;
    this.childrenExpanded.set(value ? value === 'children' : !this.childrenExpanded());
  }
}

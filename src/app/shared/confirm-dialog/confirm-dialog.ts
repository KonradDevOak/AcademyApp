import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

// Thin wrapper over the native <dialog> element (no Angular Material).
// Two modes, driven by `confirmLabel`: with it, a cancel + confirm pair; without it, an
// informational popup with a single "close" button. All text inputs are i18n keys, translated here.
// The parent owns the `open` state: it flips it to false on `dismissed`/`confirmed`, and the effect
// below syncs the native dialog to it. Esc and backdrop clicks only emit `dismissed` (never close
// the element themselves) so the parent stays the single source of truth.
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss'
})
export class ConfirmDialogComponent {
  readonly open = input(false);
  readonly heading = input.required<string>();
  readonly message = input.required<string>();
  readonly messageParams = input<Record<string, unknown>>({});
  readonly confirmLabel = input<string | null>(null);
  readonly confirmDanger = input(false);
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly confirmed = output<void>();
  readonly dismissed = output<void>();

  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialogRef()?.nativeElement;
      if (!dialog) {
        return;
      }

      if (this.open()) {
        if (!dialog.open) {
          dialog.showModal();
        }
      } else if (dialog.open) {
        dialog.close();
      }
    });
  }

  protected onCancel(event: Event): void {
    // Stop the browser from closing the element on Esc — the parent closes it via `open`.
    event.preventDefault();
    if (!this.busy()) {
      this.dismissed.emit();
    }
  }

  protected onDialogClick(event: MouseEvent): void {
    // The dialog has no padding of its own, so a click whose target is the dialog element itself
    // can only have landed on the ::backdrop.
    if (event.target === event.currentTarget && !this.busy()) {
      this.dismissed.emit();
    }
  }
}

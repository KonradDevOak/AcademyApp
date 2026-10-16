import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { ConfirmDialogComponent } from './confirm-dialog';

describe('ConfirmDialogComponent', () => {
  let fixture: ComponentFixture<ConfirmDialogComponent>;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function dialog(): HTMLDialogElement {
    return root().querySelector('dialog') as HTMLDialogElement;
  }

  function buttons(): HTMLButtonElement[] {
    return Array.from(root().querySelectorAll('button'));
  }

  function setInputs(inputs: Record<string, unknown>): void {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTranslateService()] });
    fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.componentRef.setInput('heading', 'test.heading');
    fixture.componentRef.setInput('message', 'test.message');
    fixture.detectChanges();
  });

  it('renders nothing and keeps the native dialog closed while `open` is false', () => {
    expect(dialog().open).toBeFalse();
    expect(root().textContent).not.toContain('test.heading');
  });

  it('opens the native dialog modally and shows heading + message when `open` becomes true', () => {
    setInputs({ open: true });

    expect(dialog().open).toBeTrue();
    expect(root().textContent).toContain('test.heading');
    expect(root().textContent).toContain('test.message');
  });

  it('closes the native dialog again when `open` goes back to false', () => {
    setInputs({ open: true });
    setInputs({ open: false });

    expect(dialog().open).toBeFalse();
  });

  it('is informational without a confirmLabel: a single close button that emits dismissed', () => {
    const dismissed = jasmine.createSpy('dismissed');
    fixture.componentInstance.dismissed.subscribe(dismissed);
    setInputs({ open: true });

    expect(buttons().length).toBe(1);
    expect(buttons()[0].textContent).toContain('common.dialog.close');

    buttons()[0].click();
    expect(dismissed).toHaveBeenCalledTimes(1);
  });

  it('shows cancel + confirm with a confirmLabel; confirm emits confirmed, cancel emits dismissed', () => {
    const confirmed = jasmine.createSpy('confirmed');
    const dismissed = jasmine.createSpy('dismissed');
    fixture.componentInstance.confirmed.subscribe(confirmed);
    fixture.componentInstance.dismissed.subscribe(dismissed);
    setInputs({ open: true, confirmLabel: 'test.confirm' });

    expect(buttons().length).toBe(2);
    expect(buttons()[0].textContent).toContain('common.dialog.cancel');
    expect(buttons()[1].textContent).toContain('test.confirm');

    buttons()[1].click();
    expect(confirmed).toHaveBeenCalledTimes(1);
    expect(dismissed).not.toHaveBeenCalled();

    buttons()[0].click();
    expect(dismissed).toHaveBeenCalledTimes(1);
  });

  it('styles the confirm button as danger only when confirmDanger is set', () => {
    setInputs({ open: true, confirmLabel: 'test.confirm' });
    expect(buttons()[1].classList).toContain('btn--primary');

    setInputs({ confirmDanger: true });
    expect(buttons()[1].classList).toContain('btn--danger');
    expect(buttons()[1].classList).not.toContain('btn--primary');
  });

  it('shows the error banner when an error key is provided', () => {
    setInputs({ open: true, error: 'test.error' });

    expect(root().querySelector('.banner--error')?.textContent).toContain('test.error');
  });

  it('disables both buttons while busy and ignores Esc', () => {
    const dismissed = jasmine.createSpy('dismissed');
    fixture.componentInstance.dismissed.subscribe(dismissed);
    setInputs({ open: true, confirmLabel: 'test.confirm', busy: true });

    expect(buttons().every((b) => b.disabled)).toBeTrue();

    dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(dismissed).not.toHaveBeenCalled();
  });

  it('emits dismissed on Esc (cancel event) and keeps the element open for the parent to close', () => {
    const dismissed = jasmine.createSpy('dismissed');
    fixture.componentInstance.dismissed.subscribe(dismissed);
    setInputs({ open: true });

    const event = new Event('cancel', { cancelable: true });
    dialog().dispatchEvent(event);

    expect(dismissed).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBeTrue();
    expect(dialog().open).toBeTrue();
  });

  it('emits dismissed when the backdrop (the dialog element itself) is clicked, not its content', () => {
    const dismissed = jasmine.createSpy('dismissed');
    fixture.componentInstance.dismissed.subscribe(dismissed);
    setInputs({ open: true });

    (root().querySelector('.confirm-dialog__body') as HTMLElement).click();
    expect(dismissed).not.toHaveBeenCalled();

    dialog().click();
    expect(dismissed).toHaveBeenCalledTimes(1);
  });
});

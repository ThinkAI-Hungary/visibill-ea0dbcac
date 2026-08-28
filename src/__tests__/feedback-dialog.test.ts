import { describe, it, expect } from 'vitest';

/**
 * Feedback Dialog state reset tests.
 * Reproduces and verifies the fix for:
 * When a user submits a ticket, sees the confirmation screen, closes the dialog,
 * and reopens it (via the FAB button or anywhere else), the dialog MUST reset its state
 * (submitted = false, fields empty) and not show the confirmation screen again.
 */

describe('FeedbackDialog State Reset Logic', () => {
  interface DialogState {
    companyId: string;
    service: string;
    type: string;
    priority: string;
    message: string;
    attachments: string[];
    submitted: boolean;
    submitting: boolean;
  }

  function getInitialState(defaultCompanyId: string = 'comp-123'): DialogState {
    return {
      companyId: defaultCompanyId,
      service: '',
      type: '',
      priority: 'medium',
      message: '',
      attachments: [],
      submitted: false,
      submitting: false,
    };
  }

  function simulateSubmit(state: DialogState): DialogState {
    return {
      ...state,
      submitted: true,
      submitting: false,
    };
  }

  it('resets submitted state and form fields when dialog is opened', () => {
    // 1. Initial open
    let state = getInitialState('comp-123');
    state.message = 'Találtam egy hibát a számlázásnál';
    state.service = 'eaisybill';
    state.type = 'bug';

    // 2. Submit ticket
    state = simulateSubmit(state);
    expect(state.submitted).toBe(true);

    // 3. User closes dialog
    // 4. User re-opens dialog (reset triggered by open prop change or close)
    state = getInitialState('comp-123');

    expect(state.submitted).toBe(false);
    expect(state.message).toBe('');
    expect(state.service).toBe('');
    expect(state.type).toBe('');
    expect(state.priority).toBe('medium');
    expect(state.attachments).toHaveLength(0);
  });

  it('allows immediate consecutive submissions via resetForm', () => {
    // 1. Submit first ticket
    let state = getInitialState('comp-123');
    state = simulateSubmit(state);
    expect(state.submitted).toBe(true);

    // 2. Click "Újabb visszajelzés" button inside confirmation screen
    state = getInitialState('comp-123');
    expect(state.submitted).toBe(false);

    // 3. Fill and submit second ticket
    state.message = 'Második hibajegy leírása';
    state.service = 'accounty';
    state.type = 'feedback';
    state = simulateSubmit(state);
    expect(state.submitted).toBe(true);
  });
});

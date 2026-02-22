/**
 * Toast notification: top center of the window.
 * Dismisses on click or after AUTO_DISMISS_MS (5s).
 */

const AUTO_DISMISS_MS = 5000;
const TOAST_CLASS = 'app-toast';

let activeToast = null;
let dismissTimer = null;

function dismiss(toastEl) {
  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
  if (toastEl && toastEl.parentNode) {
    toastEl.remove();
  }
  if (activeToast === toastEl) {
    activeToast = null;
  }
}

/**
 * Show a toast with the given message.
 * Dismisses when the user clicks the toast or after 5 seconds.
 * @param {string} message - User-facing message (no stack traces).
 */
export function showToast(message) {
  const safeMessage = typeof message === 'string' && message.length > 0
    ? message
    : 'Something went wrong.';

  if (activeToast) {
    dismiss(activeToast);
  }

  const toast = document.createElement('button');
  toast.type = 'button';
  toast.className = TOAST_CLASS;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.setAttribute('aria-label', 'Notification. Click or press Enter to dismiss.');
  toast.textContent = safeMessage;

  function remove() {
    dismiss(toast);
  }

  toast.addEventListener('click', remove);
  toast.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      remove();
    }
  });
  dismissTimer = setTimeout(remove, AUTO_DISMISS_MS);

  document.body.appendChild(toast);
  activeToast = toast;
  toast.focus();
}

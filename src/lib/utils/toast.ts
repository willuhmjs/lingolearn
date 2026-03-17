import toast from 'svelte-french-toast';

/**
 * Display a success toast notification
 * Auto-dismisses after 3 seconds
 */
export const toastSuccess = (message: string, duration = 3000) => {
  return toast.success(message, { duration });
};

/**
 * Display an error toast notification
 * Auto-dismisses after 5 seconds
 */
export const toastError = (message: string, duration = 5000) => {
  return toast.error(message, { duration });
};

/**
 * Display a loading toast notification
 * Must be manually dismissed with toastDismiss
 */
export const toastLoading = (message: string) => {
  return toast.loading(message);
};

/**
 * Dismiss a specific toast by ID
 */
export const toastDismiss = (toastId: string) => {
  toast.dismiss(toastId);
};

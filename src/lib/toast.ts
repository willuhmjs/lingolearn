import toast from 'svelte-french-toast';

export { toast };

export function addToast(message: string, type: 'success' | 'error' = 'success') {
	if (type === 'error') {
		toast.error(message);
	} else {
		toast.success(message);
	}
}

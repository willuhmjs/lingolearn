import { toast } from 'svelte-french-toast';
import type { HandleClientError } from '@sveltejs/kit';

export const handleError: HandleClientError = ({ error, event }) => {
	console.error('Unhandled client error:', error, event);

	let message = 'An unexpected error occurred.';
	if (error instanceof Error) {
		message = error.message;
	} else if (typeof error === 'string') {
		message = error;
	}

	toast.error(message, {
		position: 'bottom-right',
		duration: 4000
	});

	return {
		message
	};
};

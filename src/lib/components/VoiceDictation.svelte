<script lang="ts">
	import { onDestroy } from 'svelte';

	export let lang: string = 'en-US';
	export let value: string = '';
	export let inputElement: HTMLInputElement | HTMLTextAreaElement | null = null;
	export let disabled: boolean = false;

	let isListening = false;
	let isRequesting = false; // True while awaiting mic permission
	let errorMsg: string | null = null;
	let recognition: any = null;

	const isSupported =
		typeof window !== 'undefined' &&
		('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

	async function startListening() {
		if (!isSupported || disabled || isListening || isRequesting) return;
		errorMsg = null;

		// Pre-warm mic permission before starting recognition.
		// Without this, Chrome ends the recognition session while
		// the permission prompt is on screen, making it appear to
		// "fail immediately" after the user clicks Allow.
		if (navigator.mediaDevices?.getUserMedia) {
			isRequesting = true;
			let stream: MediaStream | null = null;
			try {
				stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			} catch (err: any) {
				isRequesting = false;
				const name = err?.name || '';
				if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
					errorMsg = 'Microphone access was denied';
				} else if (name === 'NotFoundError') {
					errorMsg = 'No microphone found';
				} else {
					errorMsg = 'Could not access microphone';
				}
				setTimeout(() => (errorMsg = null), 4000);
				return;
			} finally {
				// Release the stream — we only needed it to prime the permission
				stream?.getTracks().forEach((t) => t.stop());
				isRequesting = false;
			}
		}

		const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
		recognition = new SR();
		recognition.lang = lang;
		recognition.continuous = false;
		recognition.interimResults = false;
		recognition.maxAlternatives = 1;

		recognition.onstart = () => {
			isListening = true;
		};

		recognition.onend = () => {
			isListening = false;
			recognition = null;
			if (inputElement) {
				requestAnimationFrame(() => inputElement?.focus());
			}
		};

		recognition.onerror = (e: any) => {
			isListening = false;
			recognition = null;
			if (e.error === 'no-speech') {
				// Silently reset — user just didn't speak
				return;
			}
			if (e.error === 'aborted') return;
			if (e.error === 'not-allowed') {
				errorMsg = 'Microphone access was denied';
			} else if (e.error === 'network') {
				errorMsg = 'Network error — check your connection';
			} else if (e.error === 'audio-capture') {
				errorMsg = 'No microphone found';
			} else {
				errorMsg = 'Voice input failed — try again';
			}
			setTimeout(() => (errorMsg = null), 4000);
		};

		recognition.onresult = (event: any) => {
			const transcript = event.results[0][0].transcript.trim();
			if (transcript) {
				value = value ? value + ' ' + transcript : transcript;
			}
		};

		try {
			recognition.start();
		} catch {
			isListening = false;
			recognition = null;
		}
	}

	function stopListening() {
		if (recognition) {
			recognition.stop();
		}
	}

	async function handleClick() {
		if (isListening) stopListening();
		else await startListening();
	}

	onDestroy(() => {
		if (recognition) recognition.abort();
	});
</script>

{#if isSupported}
	<button
		type="button"
		class="voice-btn"
		class:listening={isListening}
		class:requesting={isRequesting}
		disabled={(disabled && !isListening) || isRequesting}
		on:click={handleClick}
		title={isListening ? 'Stop listening' : isRequesting ? 'Requesting permission…' : 'Dictate your answer'}
		aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
		aria-pressed={isListening}
	>
		{#if isRequesting}
			<!-- Spinner while awaiting permission -->
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				xmlns="http://www.w3.org/2000/svg"
				class="voice-icon spinning"
				aria-hidden="true"
			>
				<circle cx="12" cy="12" r="9" stroke-opacity="0.25" />
				<path d="M12 3a9 9 0 0 1 9 9" />
			</svg>
		{:else if isListening}
			<!-- Stop icon -->
			<svg
				viewBox="0 0 24 24"
				fill="currentColor"
				xmlns="http://www.w3.org/2000/svg"
				class="voice-icon"
				aria-hidden="true"
			>
				<rect x="6" y="6" width="12" height="12" rx="2" />
			</svg>
		{:else}
			<!-- Mic icon -->
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				xmlns="http://www.w3.org/2000/svg"
				class="voice-icon"
				aria-hidden="true"
			>
				<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
				<path d="M19 10v2a7 7 0 0 1-14 0v-2" />
				<line x1="12" y1="19" x2="12" y2="23" />
				<line x1="8" y1="23" x2="16" y2="23" />
			</svg>
		{/if}
	</button>
{/if}

{#if errorMsg}
	<span class="voice-error" role="alert">{errorMsg}</span>
{/if}

<style>
	.voice-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		min-width: 2.5rem;
		border-radius: 50%;
		border: 2px solid var(--color-gray-200, #e5e7eb);
		background: white;
		color: var(--color-gray-500, #6b7280);
		cursor: pointer;
		transition: all 0.2s ease;
		flex-shrink: 0;
		touch-action: manipulation;
	}

	.voice-btn:hover:not(:disabled) {
		border-color: #3b82f6;
		color: #3b82f6;
		background: #eff6ff;
	}

	.voice-btn:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	.voice-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.voice-btn.listening {
		border-color: #ef4444;
		color: #ef4444;
		background: #fef2f2;
		animation: pulse-ring 1.4s ease-in-out infinite;
	}

	.voice-btn.requesting {
		border-color: #94a3b8;
		color: #64748b;
	}

	.voice-icon {
		width: 1.125rem;
		height: 1.125rem;
	}

	.voice-icon.spinning {
		animation: spin 0.9s linear infinite;
	}

	.voice-error {
		font-size: 0.75rem;
		color: #ef4444;
		margin-top: 0.25rem;
	}

	@keyframes pulse-ring {
		0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
		70% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
		100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	:global(html[data-theme='dark']) .voice-btn {
		background: #1e293b;
		border-color: #334155;
		color: #94a3b8;
	}

	:global(html[data-theme='dark']) .voice-btn:hover:not(:disabled) {
		border-color: #3b82f6;
		color: #60a5fa;
		background: rgba(59, 130, 246, 0.1);
	}

	:global(html[data-theme='dark']) .voice-btn.listening {
		border-color: #ef4444;
		color: #f87171;
		background: rgba(239, 68, 68, 0.1);
	}
</style>

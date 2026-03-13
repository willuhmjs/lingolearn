<script lang="ts">
	import { onMount } from 'svelte';
	import SpecialCharKeyboard from '$lib/components/SpecialCharKeyboard.svelte';
	import VoiceDictation from '$lib/components/VoiceDictation.svelte';
	import { charSets } from '$lib/utils/keyboard';

	export let challenge: any;
	export let submitting: boolean;
	export let feedback: any;
	export let loading: boolean;
	export let userInput: string;
	export let lessonLanguage: { name: string } | null | undefined;

	let inputEl: HTMLTextAreaElement | null = null;

	// Only show special keyboard when typing in the target language and chars are available
	$: isTargetToNative = challenge?.gameMode === 'target-to-native';
	$: langKey = lessonLanguage?.name?.toLowerCase() || '';
	$: showSpecialKeyboard = !isTargetToNative && langKey in charSets;

	// Speech recognition language: English for target-to-native, target lang otherwise
	$: speechLang = isTargetToNative ? 'en-US' : getLangCode(lessonLanguage?.name);

	function getLangCode(name: string | undefined): string {
		const map: Record<string, string> = {
			german: 'de-DE',
			french: 'fr-FR',
			spanish: 'es-ES',
			italian: 'it-IT',
			portuguese: 'pt-PT',
			russian: 'ru-RU',
			japanese: 'ja-JP',
			korean: 'ko-KR',
			chinese: 'zh-CN'
		};
		return map[(name || '').toLowerCase()] || 'en-US';
	}

	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey && !submitting && !feedback && !loading) {
			e.preventDefault();
			dispatch('submit');
		}
	}

	// Auto-focus when the component mounts (challenge is ready since parent only renders this when !loading)
	onMount(() => {
		inputEl?.focus();
	});
</script>

<div class="form-group">
	<div class="input-label-row">
		<label for="answer" class="dark:text-slate-300">Your Translation</label>
		<VoiceDictation
			lang={speechLang}
			bind:value={userInput}
			inputElement={inputEl}
			disabled={!!(submitting || feedback || loading)}
		/>
	</div>

	{#if showSpecialKeyboard}
		<SpecialCharKeyboard
			bind:value={userInput}
			inputElement={inputEl}
			language={langKey}
		/>
	{/if}

	<textarea
		id="answer"
		bind:this={inputEl}
		bind:value={userInput}
		disabled={submitting || !!feedback || loading}
		rows="3"
		placeholder={loading
			? 'Generating challenge...'
			: challenge?.gameMode === 'target-to-native'
				? 'Type your English translation here... (Enter to submit)'
				: `Type your ${lessonLanguage?.name || 'Target'} translation here... (Enter to submit)`}
		class="dark:bg-slate-900 dark:text-white dark:border-slate-700"
		on:keydown={handleKeydown}
	></textarea>
</div>

<style>
	.form-group {
		margin-bottom: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.input-label-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.input-label-row label {
		font-size: 0.875rem;
		font-weight: 500;
		color: #334155;
		flex: 1;
	}

	.form-group textarea {
		width: 100%;
		padding: 0.875rem;
		border: 1px solid var(--input-border, #cbd5e1);
		border-radius: 8px;
		font-family: inherit;
		font-size: 1rem;
		color: var(--input-text, #0f172a);
		background: var(--input-bg, #ffffff);
		box-sizing: border-box;
		resize: vertical;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
		/* Larger minimum on mobile for comfortable typing */
		min-height: 5rem;
	}

	.form-group textarea:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.form-group textarea:disabled {
		background-color: #f1f5f9;
		color: #94a3b8;
		cursor: not-allowed;
	}

	:global(html[data-theme='dark']) .form-group textarea:disabled {
		background-color: #1e293b;
		color: #64748b;
	}

	:global(html[data-theme='dark']) .input-label-row label {
		color: #cbd5e1;
	}

	/* Mobile optimizations */
	@media (max-width: 640px) {
		.form-group textarea {
			font-size: 1rem; /* Prevent iOS zoom on focus (must be >= 16px) */
			padding: 0.875rem;
			min-height: 6rem;
		}
	}
</style>

<script lang="ts">
	import { onMount } from 'svelte';
	import SpecialCharKeyboard from '$lib/components/SpecialCharKeyboard.svelte';
	import VoiceDictation from '$lib/components/VoiceDictation.svelte';
	import { charSets } from '$lib/utils/keyboard';

	export let challenge: any;
	export let submitting: boolean;
	export let feedback: any;
	export let loading: boolean;
	export let fillBlankAnswers: string[];
	export let lessonLanguage: { name: string } | null | undefined;
	export const submitAnswer = () => {};

	// Track which input is focused for the shared special keyboard
	let focusedIndex = 0;
	let inputEls: (HTMLInputElement | null)[] = [];

	$: langKey = lessonLanguage?.name?.toLowerCase() || '';
	$: showSpecialKeyboard = langKey in charSets;
	$: speechLang = getLangCode(lessonLanguage?.name);
	$: activeInputEl = inputEls[focusedIndex] ?? null;

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

	// Auto-focus first blank when component mounts
	onMount(() => {
		inputEls[0]?.focus();
	});
</script>

<div class="fill-blank-inputs">
	{#each fillBlankAnswers as _, i}
		<div class="form-group">
			<div class="input-label-row">
				<label for="blank-{i}" class="dark:text-slate-300">
					Blank {i + 1}{challenge.hints?.[i] ? ` (${challenge.hints[i].hint})` : ''}
				</label>
				<VoiceDictation
					lang={speechLang}
					bind:value={fillBlankAnswers[i]}
					inputElement={inputEls[i]}
					disabled={!!(submitting || feedback !== null || loading)}
				/>
			</div>

			<input
				id="blank-{i}"
				type="text"
				bind:this={inputEls[i]}
				bind:value={fillBlankAnswers[i]}
				disabled={submitting || feedback !== null || loading}
				placeholder="Type the missing {lessonLanguage?.name || 'Target'} word..."
				class="blank-input dark:bg-slate-900 dark:text-white dark:border-slate-700"
				on:focus={() => (focusedIndex = i)}
			/>
		</div>
	{/each}

	{#if showSpecialKeyboard && fillBlankAnswers.length > 0}
		<SpecialCharKeyboard
			bind:value={fillBlankAnswers[focusedIndex]}
			inputElement={activeInputEl}
			language={langKey}
		/>
	{/if}
</div>

<style>
	.fill-blank-inputs {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
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

	.blank-input {
		width: 100%;
		padding: 0.875rem;
		border: 1px solid #cbd5e1;
		border-radius: 8px;
		font-family: inherit;
		font-size: 1rem;
		color: #0f172a;
		box-sizing: border-box;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
	}

	.blank-input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.blank-input:disabled {
		background-color: #f1f5f9;
		color: #94a3b8;
		cursor: not-allowed;
	}

	/* Mobile: prevent iOS zoom (font-size must be >= 16px) */
	@media (max-width: 640px) {
		.blank-input {
			font-size: 1rem;
			padding: 0.875rem;
		}
	}
</style>

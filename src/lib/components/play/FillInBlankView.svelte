<script lang="ts">
	export let challenge: any;
	export let submitting: boolean;
	export let feedback: any;
	export let loading: boolean;
	export let fillBlankAnswers: string[];
	export let lessonLanguage: { name: string } | null | undefined;
	export const submitAnswer = () => {};
</script>

<div class="fill-blank-inputs">
	{#each fillBlankAnswers as _, i}
		<div class="form-group">
			<label for="blank-{i}" class="dark:text-slate-300">
				Blank {i + 1}{challenge.hints?.[i] ? ` (${challenge.hints[i].hint})` : ''}
			</label>
			<input
				id="blank-{i}"
				type="text"
				bind:value={fillBlankAnswers[i]}
				disabled={submitting || feedback !== null || loading}
				placeholder="Type the missing {lessonLanguage?.name || 'Target'} word..."
				class="blank-input dark:bg-slate-900 dark:text-white dark:border-slate-700"
			/>
		</div>
	{/each}
</div>

<style>
	.fill-blank-inputs {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.form-group {
		margin-bottom: 1rem;
	}

	.form-group label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: #334155;
		margin-bottom: 0.5rem;
	}

	.blank-input {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #cbd5e1;
		border-radius: 8px;
		font-family: inherit;
		font-size: 1rem;
		color: #0f172a;
		box-sizing: border-box;
		transition: border-color 0.15s, box-shadow 0.15s;
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
</style>

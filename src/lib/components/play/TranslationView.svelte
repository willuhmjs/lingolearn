<script lang="ts">
	export let challenge: any;
	export let submitting: boolean;
	export let feedback: any;
	export let loading: boolean;
	export let userInput: string;
	export let lessonLanguage: any;
</script>

<div class="form-group">
	<label for="answer" class="dark:text-slate-300">Your Translation</label>
	<textarea
		id="answer"
		bind:value={userInput}
		disabled={submitting || feedback || loading}
		rows="3"
		placeholder={loading
			? 'Generating challenge...'
			: challenge?.gameMode === 'target-to-native'
				? 'Type your English translation here...'
				: `Type your ${lessonLanguage?.name || 'Target'} translation here... (Or ask for help / translation in English)`}
		class="dark:bg-slate-900 dark:text-white dark:border-slate-700"
	></textarea>
</div>

<style>
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

	.form-group textarea {
		width: 100%;
		padding: 0.75rem;
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
</style>

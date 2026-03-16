<script lang="ts">
	import toast from 'svelte-french-toast';

	let {
		word,
		languageId = '',
		vocabularyId = ''
	}: {
		word: string;
		languageId?: string;
		vocabularyId?: string;
	} = $props();

	let saving = $state(false);
	let saved = $state(false);

	async function bookmark() {
		if (saving || saved) return;
		saving = true;
		try {
			const payload: Record<string, string> = {};
			if (vocabularyId) {
				payload.vocabularyId = vocabularyId;
			} else {
				payload.lemma = word;
				payload.languageId = languageId;
			}

			const res = await fetch('/api/user/vocabulary/bookmark', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (res.ok) {
				saved = true;
				toast.success(`Bookmarked "${word}"`);
			} else {
				const err = await res.json().catch(() => ({}));
				toast.error(err.error || 'Failed to bookmark');
			}
		} catch {
			toast.error('Failed to bookmark');
		} finally {
			saving = false;
		}
	}
</script>

<button
	type="button"
	class="bookmark-btn"
	class:saved
	onclick={bookmark}
	disabled={saving || saved}
	title={saved ? `"${word}" bookmarked` : `Bookmark "${word}"`}
	aria-label={saved ? `"${word}" bookmarked` : `Bookmark "${word}"`}
>
	{#if saved}
		<svg class="bookmark-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none">
			<path
				d="M5 2h14a1 1 0 0 1 1 1v19.143a.5.5 0 0 1-.766.424L12 18.03l-7.234 4.537A.5.5 0 0 1 4 22.143V3a1 1 0 0 1 1-1z"
			/>
		</svg>
	{:else if saving}
		<svg
			class="bookmark-icon spin"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<path
				d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4m-3.93 7.07l-2.83-2.83M7.76 7.76L4.93 4.93"
				stroke-linecap="round"
			/>
		</svg>
	{:else}
		<svg
			class="bookmark-icon"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<path
				d="M5 2h14a1 1 0 0 1 1 1v19.143a.5.5 0 0 1-.766.424L12 18.03l-7.234 4.537A.5.5 0 0 1 4 22.143V3a1 1 0 0 1 1-1z"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	{/if}
</button>

<style>
	.bookmark-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		padding: 0;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: #64748b;
		cursor: pointer;
		transition:
			color 0.15s,
			transform 0.15s;
		flex-shrink: 0;
		vertical-align: middle;
	}

	.bookmark-btn:hover:not(:disabled) {
		color: #3b82f6;
		transform: scale(1.15);
	}

	.bookmark-btn:disabled {
		cursor: default;
	}

	.bookmark-btn.saved {
		color: #3b82f6;
	}

	:global(html[data-theme='dark']) .bookmark-btn {
		color: #94a3b8;
	}

	:global(html[data-theme='dark']) .bookmark-btn:hover:not(:disabled) {
		color: #60a5fa;
	}

	:global(html[data-theme='dark']) .bookmark-btn.saved {
		color: #60a5fa;
	}

	.bookmark-icon {
		width: 1rem;
		height: 1rem;
	}

	.spin {
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>

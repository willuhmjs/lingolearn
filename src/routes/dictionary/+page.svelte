<script lang="ts">
	import { fade, fly } from 'svelte/transition';

	export let data;

	let query = '';
	let results: any[] = [];
	let loading = false;
	let llmLoading = false;
	let llmError: string | null = null;
	let debounceTimer: ReturnType<typeof setTimeout>;
	let searchInputEl: HTMLInputElement;

	// Keep track of which words have been added in this session
	let addedWords = new Set<string>();

	$: currentLanguage = data.user?.activeLanguage?.name || 'German';
	$: activeLanguageId = data.user?.activeLanguage?.id;

	function handleKeydown(e: KeyboardEvent) {
		if ((e.key === '/' || (e.ctrlKey && e.key === 'k') || (e.metaKey && e.key === 'k')) && document.activeElement !== searchInputEl) {
			e.preventDefault();
			searchInputEl?.focus();
		}
	}

	async function performSearch(q: string) {
		if (!q.trim()) {
			results = [];
			llmError = null;
			return;
		}

		loading = true;
		llmError = null;
		try {
			const res = await fetch(`/api/vocabulary/search?q=${encodeURIComponent(q)}`);
			if (res.ok) {
				const data = await res.json();
				results = data.results;
			}
		} catch (error) {
			console.error('Search failed:', error);
		} finally {
			loading = false;
		}
	}

	function handleInput() {
		if (currentLanguage === 'German') {
			query = query
				.replace(/ae/g, 'ä')
				.replace(/oe/g, 'ö')
				.replace(/ue/g, 'ü')
				.replace(/ss/g, 'ß')
				.replace(/Ae/g, 'Ä')
				.replace(/Oe/g, 'Ö')
				.replace(/Ue/g, 'Ü');
		}

		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			performSearch(query);
		}, 300);
	}

	async function handleAskAI() {
		if (!query.trim() || !activeLanguageId) return;

		llmLoading = true;
		llmError = null;

		try {
			const res = await fetch('/api/vocabulary/llm-lookup', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					word: query.trim(),
					languageId: activeLanguageId
				})
			});

			if (res.ok) {
				const responseData = await res.json();
				results = [responseData.data || responseData]; // Show the newly added word
			} else {
				if (res.status === 400) {
					llmError = "This doesn't seem to be a valid word in the target language.";
				} else if (res.status === 429) {
					llmError = "You've asked the AI too many times recently. Please try again later.";
				} else {
					llmError = "An error occurred while asking the AI. Please try again.";
				}
			}
		} catch (error) {
			console.error('LLM lookup failed:', error);
			llmError = "An error occurred while connecting to the AI.";
		} finally {
			llmLoading = false;
		}
	}

	async function handleAddWord(vocabularyId: string) {
		try {
			const res = await fetch('/api/user/vocabulary', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ vocabularyId })
			});

			if (res.ok) {
				// Update local state to show it was added
				addedWords = new Set(addedWords).add(vocabularyId);
			} else {
				console.error('Failed to add word');
			}
		} catch (error) {
			console.error('Error adding word:', error);
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<svelte:head>
	<title>Dictionary - LernenDeutsch</title>
</svelte:head>

<div class="dictionary-container">
	<div class="header" in:fly={{ y: 20, duration: 400 }}>
		<h1 class="title">Dictionary</h1>
		<p class="subtitle">Search for words and add them to your learning list.</p>
	</div>

	<div class="search-section" in:fly={{ y: 20, duration: 400, delay: 100 }}>
		<div class="search-wrapper">
			<div class="search-icon-wrapper">
				<svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
				</svg>
			</div>
			<input
				bind:this={searchInputEl}
				type="search"
				bind:value={query}
				on:input={handleInput}
				class="search-input"
				placeholder="Search for words in {currentLanguage} or English..."
				autofocus
			/>
			{#if loading}
				<div class="loading-wrapper">
					<div class="spinner"></div>
				</div>
			{/if}
		</div>
	</div>

	{#if results.length > 0}
		<div class="results-container" transition:fade>
			<ul class="results-list">
				{#each results as result}
					<li class="result-item">
						<div class="result-content">
							<div class="result-details">
								<h3 class="result-word">
									{result.lemma}
									{#if result.gender}
										<span class="result-gender">
											{result.gender.toLowerCase()}
										</span>
									{/if}
								</h3>
								<p class="result-meaning">
									{result.meaning}
								</p>
								{#if result.partOfSpeech}
									<p class="result-pos">
										{result.partOfSpeech}
									</p>
								{/if}
							</div>
							
							<div class="result-action">
								{#if addedWords.has(result.id)}
									<button disabled class="btn-added">
										Added
									</button>
								{:else}
									<button on:click={() => handleAddWord(result.id)} class="btn-add">
										Add
									</button>
								{/if}
							</div>
						</div>
					</li>
				{/each}
			</ul>
		</div>
	{:else if query.trim() && !loading}
		<div class="no-results" transition:fade>
			<svg class="no-results-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<h3 class="no-results-title">Word not found</h3>
			<p class="no-results-text">Would you like to ask the AI to define it?</p>
		</div>
	{/if}

	{#if query.trim() && !loading}
		<div class="ask-ai-section" transition:fade>
			{#if llmError}
				<div class="error-message">
					{llmError}
				</div>
			{/if}

			{#if activeLanguageId}
				<button on:click={handleAskAI} class="btn-ask-ai" disabled={llmLoading}>
					{#if llmLoading}
						<span class="spinner-small"></span> Asking AI...
					{:else}
						Ask AI
					{/if}
				</button>
			{:else}
				<p class="no-language-text">Please set an active language to use the AI.</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.dictionary-container {
		margin-left: auto;
		margin-right: auto;
		max-width: 56rem;
		padding-left: 1rem;
		padding-right: 1rem;
		padding-top: 2rem;
		padding-bottom: 2rem;
	}

	.header {
		margin-bottom: 2rem;
	}

	.title {
		margin-bottom: 0.5rem;
		font-size: 1.875rem;
		line-height: 2.25rem;
		font-weight: 700;
		color: var(--text-color, #111827);
	}

	:global(.dark) .title {
		color: #ffffff;
	}

	.subtitle {
		color: var(--text-muted, #4b5563);
	}

	:global(.dark) .subtitle {
		color: #9ca3af;
	}

	.search-section {
		margin-bottom: 2rem;
	}

	.search-wrapper {
		position: relative;
	}

	.search-icon-wrapper {
		pointer-events: none;
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		display: flex;
		align-items: center;
		padding-left: 0.75rem;
	}

	.search-icon {
		height: 1.25rem;
		width: 1.25rem;
		color: #9ca3af;
	}

	.search-input {
		display: block;
		width: 100%;
		border-radius: 0.5rem;
		border: 1px solid #d1d5db;
		background-color: #f9fafb;
		padding: 1rem;
		padding-left: 2.5rem;
		font-size: 0.875rem;
		line-height: 1.25rem;
		color: #111827;
	}

	.search-input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 1px #3b82f6;
	}

	:global(.dark) .search-input {
		border-color: #4b5563;
		background-color: #374151;
		color: #ffffff;
	}

	:global(.dark) .search-input::placeholder {
		color: #9ca3af;
	}

	:global(.dark) .search-input:focus {
		border-color: #3b82f6;
		box-shadow: 0 0 0 1px #3b82f6;
	}

	.loading-wrapper {
		position: absolute;
		top: 0;
		bottom: 0;
		right: 0;
		display: flex;
		align-items: center;
		padding-right: 0.75rem;
	}

	.spinner {
		height: 1.25rem;
		width: 1.25rem;
		border-radius: 9999px;
		border: 2px solid rgba(17, 24, 39, 0.1);
		border-bottom-color: #111827;
		animation: spin 1s linear infinite;
	}

	:global(.dark) .spinner {
		border: 2px solid rgba(255, 255, 255, 0.1);
		border-bottom-color: #ffffff;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.results-container {
		overflow: hidden;
		border-radius: 0.5rem;
		background-color: #ffffff;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
	}

	:global(.dark) .results-container {
		background-color: #1f2937;
	}

	.results-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.result-item {
		padding: 1rem;
		border-bottom: 1px solid #e5e7eb;
		transition: background-color 0.2s;
	}

	.result-item:last-child {
		border-bottom: none;
	}

	@media (min-width: 640px) {
		.result-item {
			padding: 1.5rem;
		}
	}

	.result-item:hover {
		background-color: #f9fafb;
	}

	:global(.dark) .result-item {
		border-bottom-color: #374151;
	}

	:global(.dark) .result-item:hover {
		background-color: rgba(55, 65, 81, 0.5);
	}

	.result-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.result-details {
		flex: 1;
	}

	.result-word {
		font-size: 1.125rem;
		line-height: 1.75rem;
		font-weight: 500;
		color: #111827;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
	}

	:global(.dark) .result-word {
		color: #ffffff;
	}

	.result-gender {
		font-size: 0.75rem;
		line-height: 1rem;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		background-color: #f3f4f6;
		color: #4b5563;
	}

	:global(.dark) .result-gender {
		background-color: #374151;
		color: #d1d5db;
	}

	.result-meaning {
		margin-top: 0.25rem;
		font-size: 0.875rem;
		line-height: 1.25rem;
		color: #6b7280;
		margin-bottom: 0;
	}

	:global(.dark) .result-meaning {
		color: #9ca3af;
	}

	.result-pos {
		margin-top: 0.25rem;
		font-size: 0.75rem;
		line-height: 1rem;
		color: #9ca3af;
		margin-bottom: 0;
	}

	:global(.dark) .result-pos {
		color: #6b7280;
	}

	.result-action {
		margin-left: 1rem;
	}

	.btn-added {
		display: inline-flex;
		align-items: center;
		border-radius: 0.375rem;
		border: 1px solid transparent;
		background-color: #dcfce7;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		line-height: 1.25rem;
		font-weight: 500;
		color: #15803d;
		cursor: not-allowed;
	}

	:global(.dark) .btn-added {
		background-color: #14532d;
		color: #86efac;
	}

	.btn-add {
		display: inline-flex;
		align-items: center;
		border-radius: 0.375rem;
		border: 1px solid transparent;
		background-color: #2563eb;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		line-height: 1.25rem;
		font-weight: 500;
		color: #ffffff;
		cursor: pointer;
		box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
	}

	.btn-add:hover {
		background-color: #1d4ed8;
	}

	.btn-add:focus {
		outline: none;
		box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px #3b82f6;
	}

	:global(.dark) .btn-add {
		background-color: #3b82f6;
	}

	:global(.dark) .btn-add:hover {
		background-color: #2563eb;
	}

	.no-results {
		text-align: center;
		padding-top: 3rem;
		padding-bottom: 3rem;
	}

	.no-results-icon {
		margin-left: auto;
		margin-right: auto;
		height: 3rem;
		width: 3rem;
		color: #9ca3af;
	}

	.no-results-title {
		margin-top: 0.5rem;
		font-size: 0.875rem;
		line-height: 1.25rem;
		font-weight: 500;
		color: #111827;
	}

	:global(.dark) .no-results-title {
		color: #ffffff;
	}

	.no-results-text {
		margin-top: 0.25rem;
		font-size: 0.875rem;
		line-height: 1.25rem;
		color: #6b7280;
		margin-bottom: 1.5rem;
	}

	:global(.dark) .no-results-text {
		color: #9ca3af;
	}

	.error-message {
		margin-top: 1rem;
		margin-bottom: 1rem;
		padding: 0.75rem;
		background-color: #fee2e2;
		color: #b91c1c;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		text-align: center;
		max-width: 24rem;
		margin-left: auto;
		margin-right: auto;
	}

	:global(.dark) .error-message {
		background-color: #7f1d1d;
		color: #fecaca;
	}

	.btn-ask-ai {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		border-radius: 0.5rem;
		border: 1px solid transparent;
		background-color: #8b5cf6;
		padding: 0.75rem 1.5rem;
		font-size: 1rem;
		line-height: 1.5rem;
		font-weight: 500;
		color: #ffffff;
		cursor: pointer;
		box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
		transition: background-color 0.2s;
	}

	.btn-ask-ai:hover:not(:disabled) {
		background-color: #7c3aed;
	}

	.btn-ask-ai:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	:global(.dark) .btn-ask-ai {
		background-color: #7c3aed;
	}

	:global(.dark) .btn-ask-ai:hover:not(:disabled) {
		background-color: #6d28d9;
	}

	.spinner-small {
		height: 1rem;
		width: 1rem;
		border-radius: 9999px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-bottom-color: #ffffff;
		animation: spin 1s linear infinite;
	}

	.no-language-text {
		margin-top: 1rem;
		font-size: 0.875rem;
		color: #ef4444;
	}

	:global(.dark) .no-language-text {
		color: #f87171;
	}

	.ask-ai-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-top: 2rem;
		padding-bottom: 2rem;
	}

	@media (max-width: 768px) {
		.dictionary-container {
			padding: 1rem 0.5rem;
		}

		.title {
			font-size: 1.5rem;
		}

		.result-content {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.result-action {
			margin-left: 0;
			width: 100%;
		}

		.btn-add, .btn-added {
			width: 100%;
			justify-content: center;
		}
	}
</style>
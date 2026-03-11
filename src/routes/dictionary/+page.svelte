<script lang="ts">
	import { fade, fly, slide } from 'svelte/transition';
	import { marked } from 'marked';
	import SpecialCharKeyboard from '$lib/components/SpecialCharKeyboard.svelte';

	export let data;

	let activeTab: 'vocabulary' | 'grammar' = 'vocabulary';
	let query = '';
	let results: any[] = [];
	let loading = false;
	let llmLoading = false;
	let llmError: string | null = null;
	let debounceTimer: ReturnType<typeof setTimeout>;
	let searchInputEl: HTMLInputElement;

	// Keep track of which words have been added in this session
	let addedWords: string[] = [];

	// Track selected word for modal
	let selectedResult: any | null = null;
	
	// Track expanded grammar rules
	let expandedGrammarId: string | null = null;

	function openModal(result: any) {
		selectedResult = result;
	}

	function closeModal() {
		selectedResult = null;
	}

	function toggleGrammar(id: string) {
		expandedGrammarId = expandedGrammarId === id ? null : id;
	}

	$: currentLanguage = data.user?.activeLanguage?.name || 'German';
	$: activeLanguageId = data.user?.activeLanguage?.id;
	$: grammarRules = data.grammarRules || [];
	
	// Group grammar rules by level
	$: groupedGrammar = grammarRules.reduce((acc: any, rule: any) => {
		if (!acc[rule.level]) acc[rule.level] = [];
		acc[rule.level].push(rule);
		return acc;
	}, {});
	$: sortedLevels = Object.keys(groupedGrammar).sort();

	function handleKeydown(e: KeyboardEvent) {
		if (activeTab !== 'vocabulary') return;
		if (
			(e.key === '/' || (e.ctrlKey && e.key === 'k') || (e.metaKey && e.key === 'k')) &&
			document.activeElement !== searchInputEl
		) {
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

	let showEssetPrompt = false;

	function handleInput() {
		if (currentLanguage === 'German') {
			// Check if 'ss' was typed to show prompt
			if (query.includes('ss')) {
				showEssetPrompt = true;
			} else {
				showEssetPrompt = false;
			}

			query = query
				.replace(/ae/g, 'ä')
				.replace(/oe/g, 'ö')
				.replace(/ue/g, 'ü')
				.replace(/Ae/g, 'Ä')
				.replace(/Oe/g, 'Ö')
				.replace(/Ue/g, 'Ü');
		}

		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			performSearch(query);
		}, 300);
	}

	function convertToEsset() {
		query = query.replace(/ss/g, 'ß');
		showEssetPrompt = false;
		searchInputEl?.focus();
		performSearch(query);
	}

	function dismissEssetPrompt() {
		showEssetPrompt = false;
		searchInputEl?.focus();
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
					llmError = 'An error occurred while asking the AI. Please try again.';
				}
			}
		} catch (error) {
			console.error('LLM lookup failed:', error);
			llmError = 'An error occurred while connecting to the AI.';
		} finally {
			llmLoading = false;
		}
	}

	async function handleAskAIForExisting(vocabularyId: string, lemma: string) {
		if (!lemma.trim() || !activeLanguageId) return;

		llmLoading = true;
		llmError = null;

		try {
			const res = await fetch('/api/vocabulary/llm-lookup', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					word: lemma.trim(),
					languageId: activeLanguageId,
					existingId: vocabularyId
				})
			});

			if (res.ok) {
				const responseData = await res.json();
				// Update the result in the list
				results = results.map(r => r.id === vocabularyId ? responseData.data : r);
			} else {
				console.error('Failed to look up meaning');
				llmError = 'Failed to fetch meaning from AI.';
			}
		} catch (error) {
			console.error('LLM lookup failed:', error);
			llmError = 'An error occurred while connecting to the AI.';
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
				addedWords = [...addedWords, vocabularyId];
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
	<title>Dictionary & Grammar - LingoLearn</title>
</svelte:head>

<div class="dictionary-container">
	<div class="header" in:fly={{ y: 20, duration: 400 }}>
		<h1 class="title">Dictionary & Grammar</h1>
		<p class="subtitle">Search for words or browse grammar rules for {currentLanguage}.</p>
	</div>

	<div class="tabs-container">
		<button 
			class="tab-btn {activeTab === 'vocabulary' ? 'active' : ''}" 
			on:click={() => activeTab = 'vocabulary'}
		>
			Vocabulary
		</button>
		<button 
			class="tab-btn {activeTab === 'grammar' ? 'active' : ''}" 
			on:click={() => activeTab = 'grammar'}
		>
			Grammar Library
		</button>
	</div>

	{#if activeTab === 'vocabulary'}
		<div class="search-section" in:fly={{ y: 20, duration: 400, delay: 100 }}>
			<div class="search-wrapper">
				<div class="search-icon-wrapper">
					<svg
						class="search-icon"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						></path>
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
				{#if showEssetPrompt}
					<div class="esset-prompt" transition:fade={{ duration: 150 }}>
						<span class="esset-text">Convert 'ss' to 'ß'?</span>
						<div class="esset-actions">
							<button class="esset-btn esset-yes" on:click={convertToEsset}>Yes</button>
							<button class="esset-btn esset-no" on:click={dismissEssetPrompt}>No</button>
						</div>
					</div>
				{/if}
			</div>
			
			<div class="keyboard-wrapper">
				<SpecialCharKeyboard 
					language={currentLanguage} 
					on:char={(event) => {
						query += event.detail;
						searchInputEl?.focus();
						handleInput();
					}} 
				/>
			</div>
		</div>

		<div class="results-section">
			{#if results.length > 0}
				<ul class="results-list">
					{#each results as result (result.id)}
						<li class="result-item">
							<div class="result-content">
								<div class="result-details">
									<!-- svelte-ignore a11y-no-static-element-interactions -->
									<div
										class="result-clickable"
										on:click={() => openModal(result)}
										on:keydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												openModal(result);
											}
										}}
										tabindex="0"
										role="button"
									>
										<h3 class="result-word">
											{result.lemma}
											{#if result.gender}
												<span class="result-gender">
													{result.gender.toLowerCase()}
												</span>
											{/if}
										</h3>
										<p class="result-meaning">
											{#if result.meanings?.[0]?.value}
												{result.meanings[0].value}
											{:else}
												<span class="no-meaning-text">No meaning provided.</span>
											{/if}
										</p>
										{#if result.partOfSpeech}
											<p class="result-pos">
												{result.partOfSpeech}
											</p>
										{/if}
									</div>
								</div>

								<div class="result-action">
									{#if !result.meanings?.[0]?.value}
										<button
											class="btn-ask-ai-inline"
											on:click|stopPropagation={() => handleAskAIForExisting(result.id, result.lemma)}
											disabled={llmLoading}
										>
											Look up with AI
										</button>
									{/if}
									{#if addedWords.includes(result.id)}
										<button disabled class="btn-added"> Added </button>
									{:else}
										<button on:click={() => handleAddWord(result.id)} class="btn-add"> Add </button>
									{/if}
								</div>
							</div>
						</li>
					{/each}
				</ul>

				{#if query.trim().length > 1 && activeLanguageId}
					<div class="ask-ai-results-section">
						<p class="ask-ai-results-text">Not finding the exact word you searched for?</p>
						{#if llmError}
							<div class="error-message">{llmError}</div>
						{/if}
						<button on:click={handleAskAI} class="btn-ask-ai-results" disabled={llmLoading}>
							{#if llmLoading}
								<span class="spinner-small"></span> Asking AI...
							{:else}
								Ask AI about "{query}"
							{/if}
						</button>
					</div>
				{/if}
			{:else if query.trim().length > 1 && !loading}
				<div class="no-results" transition:fade>
					<svg
						class="no-results-icon"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<h3 class="no-results-title">Word not found</h3>
					<p class="no-results-text">Would you like to ask the AI to define it?</p>
					
					<div class="ask-ai-section">
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
				</div>
			{:else if !loading}
				<div class="empty-state" in:fade>
					<div class="empty-icon">🔍</div>
					<p>Type a word to search the dictionary.</p>
					<p class="empty-hint">
						Tip: Press <kbd>/</kbd> or <kbd>Ctrl+K</kbd> to focus the search box.
					</p>
				</div>
			{/if}
		</div>
	{:else}
		<div class="grammar-library" in:fly={{ y: 20, duration: 400 }}>
			{#if sortedLevels.length === 0}
				<div class="empty-state">
					<p>No grammar rules found for this language.</p>
				</div>
			{:else}
				{#each sortedLevels as level}
					<div class="grammar-level-section">
						<h2 class="level-heading">Level {level}</h2>
						<div class="grammar-rules-list">
							{#each groupedGrammar[level] as rule}
								<div class="grammar-rule-card dark:bg-slate-800 dark:border-slate-700">
									<!-- svelte-ignore a11y-click-events-have-key-events -->
									<!-- svelte-ignore a11y-no-static-element-interactions -->
									<div class="grammar-rule-header" on:click={() => toggleGrammar(rule.id)}>
										<div class="grammar-rule-title-wrapper">
											<h3 class="grammar-rule-title dark:text-white">{rule.title}</h3>
											{#if rule.description}
												<p class="grammar-rule-desc dark:text-slate-400">{rule.description}</p>
											{/if}
										</div>
										<button class="grammar-toggle-btn dark:text-slate-400">
											{#if expandedGrammarId === rule.id}
												<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
											{:else}
												<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
											{/if}
										</button>
									</div>
									
									{#if expandedGrammarId === rule.id && rule.guide}
										<div class="grammar-rule-content" transition:slide={{ duration: 200 }}>
											<div class="grammar-guide markdown-body dark:bg-slate-900 dark:border-slate-700">
												{@html marked(rule.guide)}
											</div>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/each}
			{/if}
		</div>
	{/if}
</div>

{#if selectedResult}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="modal-backdrop" on:click={closeModal} transition:fade={{ duration: 200 }}>
		<div class="modal-content" on:click|stopPropagation transition:fly={{ y: 20, duration: 200 }}>
			<button class="modal-close" on:click={closeModal}>&times;</button>
			<div class="modal-header">
				<h2 class="modal-title">
					{selectedResult.lemma}
					{#if selectedResult.gender}
						<span class="result-gender">
							{selectedResult.gender.toLowerCase()}
						</span>
					{/if}
				</h2>
				<p class="modal-pos">{selectedResult.partOfSpeech || 'Word'}</p>
			</div>

			<div class="modal-body">
				<div class="modal-section">
					<h3 class="modal-section-title">Meaning</h3>
					<p class="modal-meaning">{selectedResult.meanings?.[0]?.value || 'No meaning provided'}</p>
				</div>

				{#if selectedResult.plural}
					<div class="modal-section">
						<h3 class="modal-section-title">Plural</h3>
						<p class="modal-plural">{selectedResult.plural}</p>
					</div>
				{/if}

				{#if selectedResult.metadata}
					{#if selectedResult.metadata.conjugations}
						<div class="modal-section">
							<h3 class="modal-section-title">Conjugations</h3>
							<div class="modal-conjugations">
								{#each Object.entries(selectedResult.metadata.conjugations) as [tense, forms]}
									<div class="conjugation-tense">
										<h4 class="tense-title">{tense}</h4>
										<ul class="conjugation-list">
											{#each Object.entries(forms as Record<string, string>) as [person, conjugation]}
												<li><span class="person">{person}:</span> {conjugation}</li>
											{/each}
										</ul>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					{#if selectedResult.metadata.declensions}
						<div class="modal-section">
							<h3 class="modal-section-title">Declensions</h3>
							<div class="modal-declensions">
								{#each Object.entries(selectedResult.metadata.declensions) as [caseName, forms]}
									<div class="declension-case">
										<h4 class="case-title">{caseName}</h4>
										<ul class="declension-list">
											{#each Object.entries(forms as Record<string, string>) as [gender, declension]}
												<li><span class="gender">{gender}:</span> {declension}</li>
											{/each}
										</ul>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					{#if selectedResult.metadata.example}
						<div class="modal-section">
							<h3 class="modal-section-title">Example</h3>
							<p class="modal-example">"{selectedResult.metadata.example}"</p>
							{#if selectedResult.metadata.exampleTranslation}
								<p class="modal-example-translation">
									{selectedResult.metadata.exampleTranslation}
								</p>
							{/if}
						</div>
					{/if}

					{#if selectedResult.metadata.synonyms && selectedResult.metadata.synonyms.length > 0}
						<div class="modal-section">
							<h3 class="modal-section-title">Synonyms</h3>
							<div class="modal-tags">
								{#each selectedResult.metadata.synonyms as synonym}
									<span class="tag">{synonym}</span>
								{/each}
							</div>
						</div>
					{/if}

					{#if selectedResult.metadata.antonyms && selectedResult.metadata.antonyms.length > 0}
						<div class="modal-section">
							<h3 class="modal-section-title">Antonyms</h3>
							<div class="modal-tags">
								{#each selectedResult.metadata.antonyms as antonym}
									<span class="tag">{antonym}</span>
								{/each}
							</div>
						</div>
					{/if}

					{#if selectedResult.metadata.level}
						<div class="modal-section">
							<h3 class="modal-section-title">CEFR Level</h3>
							<p class="modal-level">
								<span class="level-badge level-{selectedResult.metadata.level.toLowerCase()}">
									{selectedResult.metadata.level}
								</span>
							</p>
						</div>
					{/if}

					{#if !selectedResult.metadata.conjugations && !selectedResult.metadata.declensions && !selectedResult.metadata.example && !selectedResult.metadata.synonyms && !selectedResult.metadata.antonyms && !selectedResult.metadata.level && Object.keys(selectedResult.metadata).length > 0}
						<div class="modal-section">
							<h3 class="modal-section-title">Details</h3>
							<pre class="modal-metadata">{JSON.stringify(selectedResult.metadata, null, 2)}</pre>
						</div>
					{/if}
				{/if}
			</div>

			<div class="modal-footer">
				{#if addedWords.includes(selectedResult.id)}
					<button disabled class="btn-added"> Added to List </button>
				{:else}
					<button
						on:click={() => {
							handleAddWord(selectedResult.id);
							closeModal();
						}}
						class="btn-add"
					>
						Add to My List
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

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

	/* Tabs */
	.tabs-container {
		display: flex;
		gap: 1rem;
		margin-bottom: 2rem;
		border-bottom: 1px solid #e5e7eb;
		padding-bottom: 0.5rem;
	}

	:global(.dark) .tabs-container {
		border-bottom-color: #374151;
	}

	.tab-btn {
		background: none;
		border: none;
		padding: 0.5rem 1rem;
		font-size: 1rem;
		font-weight: 600;
		color: #6b7280;
		cursor: pointer;
		position: relative;
		transition: color 0.2s;
	}

	.tab-btn:hover {
		color: #3b82f6;
	}

	.tab-btn.active {
		color: #3b82f6;
	}

	.tab-btn.active::after {
		content: '';
		position: absolute;
		bottom: -0.625rem;
		left: 0;
		right: 0;
		height: 2px;
		background-color: #3b82f6;
	}

	:global(.dark) .tab-btn {
		color: #9ca3af;
	}

	:global(.dark) .tab-btn:hover,
	:global(.dark) .tab-btn.active {
		color: #60a5fa;
	}

	:global(.dark) .tab-btn.active::after {
		background-color: #60a5fa;
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
		font-size: 1rem;
		line-height: 1.25rem;
		color: #111827;
	}

	:global(.dark) .search-input {
		border-color: #4b5563;
		background-color: #374151;
		color: #ffffff;
	}

	.keyboard-wrapper {
		margin-top: 1rem;
	}

	.esset-prompt {
		position: absolute;
		right: 1rem;
		top: calc(100% + 0.5rem);
		background-color: #ffffff;
		border: 1px solid #d1d5db;
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		z-index: 10;
	}

	:global(.dark) .esset-prompt {
		background-color: #1f2937;
		border-color: #4b5563;
	}

	.esset-actions {
		display: flex;
		gap: 0.375rem;
	}

	.esset-btn {
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		border: none;
		cursor: pointer;
		font-weight: 500;
		transition: background-color 0.2s;
	}

	.esset-yes {
		background-color: #3b82f6;
		color: #ffffff;
	}

	.esset-no {
		background-color: #e5e7eb;
		color: #374151;
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

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.results-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 1rem;
	}

	.result-item {
		background-color: #ffffff;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		overflow: hidden;
		transition: transform 0.2s, box-shadow 0.2s;
	}

	:global(.dark) .result-item {
		background-color: #1f2937;
		border-color: #374151;
	}

	.result-item:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
	}

	.result-content {
		display: flex;
		padding: 1.25rem;
		gap: 1rem;
		align-items: flex-start;
	}

	.result-details {
		flex: 1;
	}

	.result-word {
		font-size: 1.25rem;
		font-weight: 700;
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.result-gender {
		font-size: 0.75rem;
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		background-color: #f3f4f6;
		text-transform: uppercase;
		font-weight: 800;
	}

	.result-meaning {
		margin-top: 0.5rem;
		color: #4b5563;
	}

	:global(.dark) .result-meaning {
		color: #d1d5db;
	}

	.result-pos {
		margin-top: 0.5rem;
		font-size: 0.75rem;
		color: #9ca3af;
		text-transform: uppercase;
		font-weight: 600;
	}

	.btn-add {
		background-color: #3b82f6;
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 0.375rem;
		font-weight: 600;
		cursor: pointer;
	}

	.btn-added {
		background-color: #dcfce7;
		color: #166534;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 0.375rem;
		font-weight: 600;
	}

	/* Grammar Library */
	.level-heading {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 2rem 0 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 2px solid #3b82f6;
		display: inline-block;
	}

	.grammar-rules-list {
		display: grid;
		gap: 1rem;
	}

	.grammar-rule-card {
		border: 1px solid #e5e7eb;
		border-radius: 0.75rem;
		background-color: #ffffff;
		overflow: hidden;
	}

	.grammar-rule-header {
		padding: 1.25rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.grammar-rule-header:hover {
		background-color: #f9fafb;
	}

	:global(.dark) .grammar-rule-header:hover {
		background-color: #2d3748;
	}

	.grammar-rule-title {
		font-size: 1.125rem;
		font-weight: 700;
		margin: 0;
	}

	.grammar-rule-desc {
		margin: 0.25rem 0 0;
		font-size: 0.875rem;
		color: #6b7280;
	}

	.grammar-toggle-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 9999px;
		transition: background-color 0.2s;
	}

	.grammar-toggle-btn:hover {
		background-color: #e2e8f0;
	}

	.grammar-rule-content {
		padding: 0 1.25rem 1.25rem;
		border-top: 1px solid #f3f4f6;
	}

	:global(.dark) .grammar-rule-content {
		border-top-color: #374151;
	}

	/* Beautiful Markdown Renderer */
	.grammar-guide {
		padding: 1.5rem;
		border-radius: 0.5rem;
		line-height: 1.6;
	}

	.grammar-guide :global(h1),
	.grammar-guide :global(h2),
	.grammar-guide :global(h3),
	.grammar-guide :global(h4) {
		margin-top: 1.5rem;
		margin-bottom: 1rem;
		font-weight: 800;
		line-height: 1.25;
		color: #1a202c;
	}

	:global(.dark) .grammar-guide :global(h1),
	:global(.dark) .grammar-guide :global(h2),
	:global(.dark) .grammar-guide :global(h3),
	:global(.dark) .grammar-guide :global(h4) {
		color: #f7fafc;
	}

	.grammar-guide :global(p) {
		margin-bottom: 1rem;
	}

	.grammar-guide :global(ul),
	.grammar-guide :global(ol) {
		margin-bottom: 1rem;
		padding-left: 1.5rem;
	}

	.grammar-guide :global(li) {
		margin-bottom: 0.5rem;
	}

	.grammar-guide :global(strong) {
		color: #2b6cb0;
	}

	:global(.dark) .grammar-guide :global(strong) {
		color: #63b3ed;
	}

	.grammar-guide :global(table) {
		width: 100%;
		border-collapse: collapse;
		margin-bottom: 1.5rem;
		font-size: 0.9rem;
	}

	.grammar-guide :global(th),
	.grammar-guide :global(td) {
		border: 1px solid #e2e8f0;
		padding: 0.75rem;
		text-align: left;
	}

	:global(.dark) .grammar-guide :global(th),
	:global(.dark) .grammar-guide :global(td) {
		border-color: #4a5568;
	}

	.grammar-guide :global(th) {
		background-color: #f7fafc;
		font-weight: 700;
	}

	:global(.dark) .grammar-guide :global(th) {
		background-color: #2d3748;
	}

	.grammar-guide :global(blockquote) {
		border-left: 4px solid #3b82f6;
		padding-left: 1rem;
		font-style: italic;
		color: #4a5568;
		margin: 1.5rem 0;
	}

	:global(.dark) .grammar-guide :global(blockquote) {
		color: #a0aec0;
	}

	/* Modal Styles (kept from original) */
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 50;
		padding: 1rem;
	}

	.modal-content {
		background-color: #ffffff;
		border-radius: 0.5rem;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
		max-width: 32rem;
		width: 100%;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		position: relative;
		overflow: hidden;
	}

	:global(.dark) .modal-content {
		background-color: #1f2937;
		border: 1px solid #374151;
	}

	.modal-close {
		position: absolute;
		top: 1rem;
		right: 1rem;
		background: transparent;
		border: none;
		font-size: 1.5rem;
		color: #9ca3af;
		cursor: pointer;
	}

	.modal-body {
		padding: 1.5rem;
		overflow-y: auto;
	}

	.modal-header {
		padding: 1.5rem 1.5rem 0;
	}

	.modal-title {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.modal-pos {
		color: #6b7280;
		font-size: 0.875rem;
		margin-top: 0.25rem;
		margin-bottom: 0;
	}

	.modal-section {
		margin-bottom: 1.5rem;
	}

	.modal-section:last-child {
		margin-bottom: 0;
	}

	.modal-section-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: #4b5563;
		text-transform: uppercase;
		margin-bottom: 0.5rem;
	}

	:global(.dark) .modal-section-title {
		color: #9ca3af;
	}

	.modal-meaning, .modal-plural, .modal-example, .modal-example-translation {
		margin: 0;
		color: #111827;
	}

	:global(.dark) .modal-meaning,
	:global(.dark) .modal-plural,
	:global(.dark) .modal-example,
	:global(.dark) .modal-example-translation {
		color: #f9fafb;
	}

	.modal-footer {
		padding: 1.5rem;
		border-top: 1px solid #e5e7eb;
		display: flex;
		justify-content: flex-start;
	}

	:global(.dark) .modal-footer {
		border-top-color: #374151;
	}

	/* No Results & Empty State */
	.no-results {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		text-align: center;
		background-color: #f9fafb;
		border-radius: 1rem;
		border: 2px dashed #e5e7eb;
		margin-top: 2rem;
	}

	:global(.dark) .no-results {
		background-color: #111827;
		border-color: #374151;
	}

	.no-results-icon {
		width: 4rem;
		height: 4rem;
		color: #9ca3af;
		margin-bottom: 1.5rem;
	}

	.no-results-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: #111827;
		margin: 0 0 0.5rem 0;
	}

	:global(.dark) .no-results-title {
		color: #f9fafb;
	}

	.no-results-text {
		color: #6b7280;
		font-size: 1.125rem;
		margin: 0 0 2rem 0;
	}

	:global(.dark) .no-results-text {
		color: #9ca3af;
	}

	.ask-ai-section {
		width: 100%;
		max-width: 20rem;
		margin: 0 auto;
	}

	.btn-ask-ai {
		width: 100%;
		background-color: #3b82f6;
		color: white;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 0.5rem;
		font-weight: 700;
		font-size: 1rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		transition:
			background-color 0.2s,
			transform 0.1s;
	}

	.btn-ask-ai:hover:not(:disabled) {
		background-color: #2563eb;
		transform: translateY(-1px);
	}

	.btn-ask-ai:active:not(:disabled) {
		transform: translateY(0);
	}

	.btn-ask-ai:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.no-meaning-text {
		color: #9ca3af;
		font-style: italic;
	}

	:global(.dark) .no-meaning-text {
		color: #6b7280;
	}

	.ask-ai-results-section {
		margin-top: 1.5rem;
		padding: 1.25rem;
		border: 1px dashed #d1d5db;
		border-radius: 0.75rem;
		display: flex;
		align-items: center;
		gap: 1rem;
		background-color: #f9fafb;
		flex-wrap: wrap;
	}

	:global(.dark) .ask-ai-results-section {
		border-color: #374151;
		background-color: #111827;
	}

	.ask-ai-results-text {
		flex: 1;
		margin: 0;
		color: #6b7280;
		font-size: 0.9rem;
	}

	:global(.dark) .ask-ai-results-text {
		color: #9ca3af;
	}

	.btn-ask-ai-results {
		background-color: #3b82f6;
		color: white;
		border: none;
		padding: 0.5rem 1.25rem;
		border-radius: 0.5rem;
		font-weight: 600;
		font-size: 0.9rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		white-space: nowrap;
		transition: background-color 0.2s;
	}

	.btn-ask-ai-results:hover:not(:disabled) {
		background-color: #2563eb;
	}

	.btn-ask-ai-results:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 5rem 2rem;
		text-align: center;
		color: #6b7280;
	}

	:global(.dark) .empty-state {
		color: #9ca3af;
	}

	.empty-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
		opacity: 0.5;
	}

	.empty-hint {
		margin-top: 1rem;
		font-size: 0.875rem;
	}

	.empty-hint kbd {
		background-color: #f3f4f6;
		border: 1px solid #d1d5db;
		border-radius: 0.25rem;
		padding: 0.125rem 0.25rem;
		font-family: inherit;
		font-size: 0.75rem;
		color: #374151;
	}

	:global(.dark) .empty-hint kbd {
		background-color: #374151;
		border-color: #4b5563;
		color: #e5e7eb;
	}

	.error-message {
		background-color: #fef2f2;
		color: #dc2626;
		padding: 0.75rem;
		border-radius: 0.5rem;
		margin-bottom: 1rem;
		font-size: 0.875rem;
		border: 1px solid #fee2e2;
	}

	:global(.dark) .error-message {
		background-color: rgba(220, 38, 38, 0.1);
		border-color: rgba(220, 38, 38, 0.2);
	}

	.no-language-text {
		color: #ef4444;
		font-weight: 600;
	}

	.spinner-small {
		height: 1rem;
		width: 1rem;
		border-radius: 9999px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-bottom-color: white;
		animation: spin 1s linear infinite;
	}
</style>

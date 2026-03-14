<script lang="ts">
	import { fade, fly, slide } from 'svelte/transition';
	import { marked } from 'marked';
	import SpecialCharKeyboard from '$lib/components/SpecialCharKeyboard.svelte';
	import { toastError } from '$lib/utils/toast';

	export let data;

	let activeTab: 'vocabulary' | 'grammar' = 'vocabulary';
	let query = '';
	let results: any[] = [];
	let loading = false;
	let llmLoading = false;
	let debounceTimer: ReturnType<typeof setTimeout>;
	let searchController: AbortController | null = null;
	let searchInputEl: HTMLInputElement;

	// Keep track of which words have been added in this session
	let addedWords: string[] = [];

	// Track selected word for modal
	let selectedResult: any | null = null;
	
	// Track expanded grammar rules
	let expandedGrammarId: string | null = null;
	let grammarQuery = '';

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

	$: filteredGroupedGrammar = (() => {
		if (!grammarQuery.trim()) return groupedGrammar;
		const q = grammarQuery.toLowerCase();
		const filtered: any = {};
		for (const level of sortedLevels) {
			const matching = groupedGrammar[level].filter((rule: any) =>
				rule.title.toLowerCase().includes(q) ||
				(rule.description && rule.description.toLowerCase().includes(q))
			);
			if (matching.length > 0) filtered[level] = matching;
		}
		return filtered;
	})();
	$: filteredLevels = Object.keys(filteredGroupedGrammar).sort();

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
			return;
		}

		searchController?.abort();
		searchController = new AbortController();

		loading = true;
		try {
			const res = await fetch(`/api/vocabulary/search?q=${encodeURIComponent(q)}`, {
				signal: searchController.signal
			});
			if (res.ok) {
				const data = await res.json();
				results = data.results;
			}
		} catch (error: any) {
			if (error.name !== 'AbortError') {
				console.error('Search failed:', error);
			}
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
		if (!query.trim() || !activeLanguageId || llmLoading) return;

		llmLoading = true;

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
					toastError("This doesn't seem to be a valid word in the target language.");
				} else if (res.status === 429) {
					toastError("You've asked the AI too many times recently. Please try again later.");
				} else {
					toastError('An error occurred while asking the AI. Please try again.');
				}
			}
		} catch (error) {
			console.error('LLM lookup failed:', error);
			toastError('An error occurred while connecting to the AI.');
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
				searchInputEl?.focus();
			} else {
				console.error('Failed to add word');
			}
		} catch (error) {
			console.error('Error adding word:', error);
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

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
			onclick={() => activeTab = 'vocabulary'}
		>
			Vocabulary
		</button>
		<button 
			class="tab-btn {activeTab === 'grammar' ? 'active' : ''}" 
			onclick={() => activeTab = 'grammar'}
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
					oninput={handleInput}
					class="search-input"
					placeholder="Search for words in {currentLanguage} or English..."
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
							<button class="esset-btn esset-yes" onclick={convertToEsset}>Yes</button>
							<button class="esset-btn esset-no" onclick={dismissEssetPrompt}>No</button>
						</div>
					</div>
				{/if}
			</div>
			
			<div class="keyboard-wrapper">
				<SpecialCharKeyboard
					language={currentLanguage}
					bind:value={query}
					inputElement={searchInputEl}
				/>
			</div>
		</div>

		<div class="results-section">
			{#if loading && query.trim().length > 1}
				<ul class="results-list skeleton-list" aria-busy="true" aria-label="Loading results">
					{#each [1, 2, 3] as _}
						<li class="result-item">
							<div class="result-content">
								<div class="result-details">
									<div class="skeleton-word"></div>
									<div class="skeleton-meaning"></div>
									<div class="skeleton-pos"></div>
								</div>
								<div class="result-action">
									<div class="skeleton-btn"></div>
								</div>
							</div>
						</li>
					{/each}
				</ul>
			{:else if results.length > 0}
				<ul class="results-list">
					{#each results as result (result.id)}
						<li class="result-item">
							<div class="result-content">
								<div class="result-details">
									<!-- svelte-ignore a11y-no-static-element-interactions -->
									<div
										class="result-clickable"
										onclick={() => openModal(result)}
										onkeydown={(e) => {
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
										{#if result.userSrsState}
											<span class="srs-badge srs-{result.userSrsState.toLowerCase()}">{result.userSrsState.charAt(0) + result.userSrsState.slice(1).toLowerCase()}</span>
										{/if}
									</div>
								</div>

								<div class="result-action">
									{#if addedWords.includes(result.id)}
										<button disabled class="btn-added"> Added </button>
									{:else}
										<button onclick={() => handleAddWord(result.id)} class="btn-add"> Add </button>
									{/if}
								</div>
							</div>
						</li>
					{/each}
				</ul>

				{#if query.trim().length > 1 && activeLanguageId}
					<div class="ask-ai-results-section">
						<p class="ask-ai-results-text">Not finding the exact word you searched for?</p>
						<button onclick={handleAskAI} class="btn-ask-ai-results" disabled={llmLoading}>
							{#if llmLoading}
								<span class="spinner-small"></span> Asking AI...
							{:else}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:1.1rem;height:1.1rem;flex-shrink:0;margin-right:0.5rem;"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
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
						{#if activeLanguageId}
							<button onclick={handleAskAI} class="btn-ask-ai" disabled={llmLoading}>
								{#if llmLoading}
									<span class="spinner-small"></span> Asking AI...
								{:else}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:1.25rem;height:1.25rem;flex-shrink:0;margin-right:0.5rem;"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
									Ask AI about "{query}"
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
			<div class="grammar-search-wrapper">
				<div class="search-icon-wrapper">
					<svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
					</svg>
				</div>
				<input
					type="search"
					bind:value={grammarQuery}
					class="search-input"
					placeholder="Search grammar rules..."
				/>
			</div>

			{#if sortedLevels.length === 0}
				<div class="empty-state">
					<p>No grammar rules found for this language.</p>
				</div>
			{:else if filteredLevels.length === 0}
				<div class="empty-state">
					<p>No rules match "{grammarQuery}".</p>
				</div>
			{:else}
				{#each filteredLevels as level}
					<div class="grammar-level-section">
						<h2 class="level-heading">Level {level}</h2>
						<div class="grammar-rules-list">
							{#each filteredGroupedGrammar[level] as rule}
								<div class="grammar-rule-card">
									<button
										type="button"
										class="grammar-rule-header"
										onclick={() => toggleGrammar(rule.id)}
										aria-expanded={expandedGrammarId === rule.id}
										aria-controls="grammar-{rule.id}"
									>
										<div class="grammar-rule-title-wrapper">
											<h3 class="grammar-rule-title">{rule.title}</h3>
											{#if rule.description}
												<p class="grammar-rule-desc">{rule.description}</p>
											{/if}
										</div>
										<span class="grammar-toggle-btn" aria-hidden="true">
											{#if expandedGrammarId === rule.id}
												<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
											{:else}
												<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
											{/if}
										</span>
									</button>
									
									{#if expandedGrammarId === rule.id && rule.guide}
										<div class="grammar-rule-content" id="grammar-{rule.id}" transition:slide={{ duration: 200 }}>
											<div class="grammar-guide markdown-body">
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
	<div class="modal-backdrop" onclick={closeModal} transition:fade={{ duration: 200 }}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()} transition:fly={{ y: 20, duration: 200 }}>
			<!-- Header band -->
			<div class="modal-header" class:gender-feminine={selectedResult.gender?.toLowerCase() === 'feminine'} class:gender-masculine={selectedResult.gender?.toLowerCase() === 'masculine'} class:gender-neuter={selectedResult.gender?.toLowerCase() === 'neuter'}>
				<button class="modal-close" onclick={closeModal} aria-label="Close">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
				</button>
				<div class="modal-header-main">
					<h2 class="modal-title">{selectedResult.lemma}</h2>
					<div class="modal-header-meta">
						{#if selectedResult.partOfSpeech}
							<span class="modal-pos-badge">{selectedResult.partOfSpeech}</span>
						{/if}
						{#if selectedResult.gender}
							<span class="modal-gender-badge gender-badge-{selectedResult.gender.toLowerCase()}">
								{selectedResult.gender.toLowerCase()}
							</span>
						{/if}
						{#if selectedResult.metadata?.level}
							<span class="modal-level-badge level-{selectedResult.metadata.level.toLowerCase()}">{selectedResult.metadata.level}</span>
						{/if}
					</div>
				</div>
			</div>

			<div class="modal-body">
				<!-- Meaning -->
				<div class="dict-entry">
					<span class="dict-entry-icon">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
					</span>
					<div class="dict-entry-body">
						<span class="dict-label">meaning</span>
						<p class="dict-meaning">{selectedResult.meanings?.[0]?.value || 'No meaning provided'}</p>
					</div>
				</div>

				{#if selectedResult.plural}
					<div class="dict-entry">
						<span class="dict-entry-icon">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="8" height="14" rx="1"/><rect x="14" y="3" width="8" height="18" rx="1"/></svg>
						</span>
						<div class="dict-entry-body">
							<span class="dict-label">plural</span>
							<p class="dict-value">{selectedResult.plural}</p>
						</div>
					</div>
				{/if}

				{#if selectedResult.metadata}
					{#if selectedResult.metadata.declensions}
						<div class="dict-entry dict-entry-block">
							<span class="dict-entry-icon">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
							</span>
							<div class="dict-entry-body">
								<span class="dict-label">declensions</span>
								<table class="declension-table">
									<thead>
										<tr>
											<th>case</th>
											{#if typeof Object.values(selectedResult.metadata.declensions)[0] === 'object'}
												{#each Object.keys(Object.values(selectedResult.metadata.declensions)[0] as Record<string,string>) as col}
													<th>{col}</th>
												{/each}
											{:else}
												<th>form</th>
											{/if}
										</tr>
									</thead>
									<tbody>
										{#each Object.entries(selectedResult.metadata.declensions) as [caseName, forms]}
											<tr>
												<td class="case-name">{caseName}</td>
												{#if typeof forms === 'string'}
													<td>{forms}</td>
												{:else}
													{#each Object.values(forms as Record<string, string>) as val}
														<td>{val}</td>
													{/each}
												{/if}
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{/if}

					{#if selectedResult.metadata.conjugations}
						<div class="dict-entry dict-entry-block">
							<span class="dict-entry-icon">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
							</span>
							<div class="dict-entry-body">
								<span class="dict-label">conjugations</span>
								{#each Object.entries(selectedResult.metadata.conjugations) as [tense, forms]}
									<p class="conj-tense-label">{tense}</p>
									<table class="declension-table">
										<tbody>
											{#each Object.entries(forms as Record<string, string>) as [person, conjugation]}
												<tr>
													<td class="case-name">{person}</td>
													<td>{conjugation}</td>
												</tr>
											{/each}
										</tbody>
									</table>
								{/each}
							</div>
						</div>
					{/if}

					{#if selectedResult.metadata.example}
						<div class="dict-entry dict-entry-example">
							<span class="dict-entry-icon">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
							</span>
							<div class="dict-entry-body">
								<span class="dict-label">example</span>
								<p class="example-sentence">&#8220;{selectedResult.metadata.example}&#8221;</p>
								{#if selectedResult.metadata.exampleTranslation}
									<p class="example-translation">{selectedResult.metadata.exampleTranslation}</p>
								{/if}
							</div>
						</div>
					{/if}

					{#if selectedResult.metadata.synonyms?.length > 0 || selectedResult.metadata.antonyms?.length > 0}
						<div class="dict-entry">
							<span class="dict-entry-icon">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16V4m0 0L3 8m4-4 4 4"/><path d="M17 8v12m0 0 4-4m-4 4-4-4"/></svg>
							</span>
							<div class="dict-entry-body">
								{#if selectedResult.metadata.synonyms?.length > 0}
									<span class="dict-label">synonyms</span>
									<div class="word-tags">
										{#each selectedResult.metadata.synonyms as word}
											<span class="word-tag word-tag-syn">{word}</span>
										{/each}
									</div>
								{/if}
								{#if selectedResult.metadata.antonyms?.length > 0}
									<span class="dict-label" style="margin-top:0.5rem">antonyms</span>
									<div class="word-tags">
										{#each selectedResult.metadata.antonyms as word}
											<span class="word-tag word-tag-ant">{word}</span>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					{/if}

					{#if !selectedResult.metadata.conjugations && !selectedResult.metadata.declensions && !selectedResult.metadata.example && !selectedResult.metadata.synonyms && !selectedResult.metadata.antonyms && !selectedResult.metadata.level && Object.keys(selectedResult.metadata).length > 0}
						<div class="dict-entry">
							<span class="dict-entry-icon">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
							</span>
							<div class="dict-entry-body">
								<span class="dict-label">details</span>
								<pre class="modal-metadata">{JSON.stringify(selectedResult.metadata, null, 2)}</pre>
							</div>
						</div>
					{/if}
				{/if}
			</div>

			<div class="modal-footer">
				{#if addedWords.includes(selectedResult.id)}
					<button disabled class="btn-added">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:1rem;height:1rem"><polyline points="20 6 9 17 4 12"/></svg>
						Added to List
					</button>
				{:else}
					<button
						onclick={() => {
							handleAddWord(selectedResult.id);
							closeModal();
						}}
						class="btn-add"
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:1rem;height:1rem"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
						Add to My List
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.dictionary-container {
		padding: 2rem;
		max-width: 1200px;
		margin: 0 auto;
		width: 100%;
		box-sizing: border-box;
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

	.subtitle {
		color: var(--text-color, #4b5563);
		opacity: 0.7;
	}

	/* Tabs */
	.tabs-container {
		display: flex;
		gap: 1rem;
		margin-bottom: 2rem;
		border-bottom: 1px solid var(--card-border, #e5e7eb);
		padding-bottom: 0.5rem;
	}

	.tab-btn {
		background: none;
		border: none;
		padding: 0.5rem 1rem;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-color, #6b7280);
		opacity: 0.6;
		cursor: pointer;
		position: relative;
		transition: color 0.2s, opacity 0.2s;
	}

	.tab-btn:hover {
		opacity: 1;
		color: #3b82f6;
	}

	.tab-btn.active {
		color: #3b82f6;
		opacity: 1;
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
		border: 1px solid var(--card-border, #d1d5db);
		background-color: var(--input-bg, #f9fafb);
		padding: 1rem;
		padding-left: 2.5rem;
		font-size: 1rem;
		line-height: 1.25rem;
		color: var(--input-text, #111827);
		box-sizing: border-box;
	}

	.keyboard-wrapper {
		margin-top: 1rem;
	}

	.esset-prompt {
		position: absolute;
		right: 1rem;
		top: calc(100% + 0.5rem);
		background-color: var(--card-bg, #ffffff);
		border: 1px solid var(--card-border, #d1d5db);
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		z-index: 10;
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
		background-color: var(--card-border, #e5e7eb);
		color: var(--text-color, #374151);
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
		border: 2px solid var(--card-border, rgba(17, 24, 39, 0.1));
		border-bottom-color: var(--text-color, #111827);
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

	/* Skeleton loading */
	@keyframes skeleton-pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}

	.skeleton-list .result-item {
		pointer-events: none;
	}

	.skeleton-word,
	.skeleton-meaning,
	.skeleton-pos,
	.skeleton-btn {
		background: var(--card-border, #e5e7eb);
		border-radius: 0.375rem;
		animation: skeleton-pulse 1.5s ease-in-out infinite;
	}

	.skeleton-word {
		height: 1.25rem;
		width: 35%;
		margin-bottom: 0.5rem;
	}

	.skeleton-meaning {
		height: 1rem;
		width: 70%;
		margin-bottom: 0.375rem;
	}

	.skeleton-pos {
		height: 0.75rem;
		width: 20%;
	}

	.skeleton-btn {
		height: 2rem;
		width: 3.5rem;
		border-radius: 0.375rem;
	}

	.result-item {
		background-color: var(--card-bg, #ffffff);
		border: 1px solid var(--card-border, #e5e7eb);
		border-radius: 0.5rem;
		overflow: hidden;
		transition: transform 0.2s, box-shadow 0.2s;
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
		color: var(--text-color, #111827);
	}

	.result-gender {
		font-size: 0.75rem;
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		background-color: var(--card-border, #f3f4f6);
		text-transform: uppercase;
		font-weight: 800;
		color: var(--text-color, #374151);
	}

	.result-meaning {
		margin-top: 0.5rem;
		color: var(--text-color, #4b5563);
		opacity: 0.8;
	}

	.result-pos {
		margin-top: 0.5rem;
		font-size: 0.75rem;
		color: #9ca3af;
		text-transform: uppercase;
		font-weight: 600;
	}

	.srs-badge {
		display: inline-block;
		margin-top: 0.4rem;
		font-size: 0.7rem;
		font-weight: 700;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.srs-unseen  { background: #e2e8f0; color: #475569; }
	.srs-learning { background: #fef9c3; color: #854d0e; }
	.srs-known   { background: #d1fae5; color: #065f46; }
	.srs-mastered { background: #a7f3d0; color: #064e3b; }

	:global(html[data-theme='dark']) .srs-unseen   { background: #334155; color: #94a3b8; }
	:global(html[data-theme='dark']) .srs-learning { background: #422006; color: #fde68a; }
	:global(html[data-theme='dark']) .srs-known    { background: #064e3b; color: #6ee7b7; }
	:global(html[data-theme='dark']) .srs-mastered { background: #022c22; color: #34d399; }

	.btn-add {
		background-color: #3b82f6;
		color: white;
		border: none;
		padding: 0.5rem 1.125rem;
		border-radius: 0.5rem;
		font-weight: 600;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		transition: background-color 0.15s, transform 0.1s;
	}

	.btn-add:hover { background-color: #2563eb; transform: translateY(-1px); }
	.btn-add:active { transform: translateY(0); }

	.btn-added {
		background-color: #dcfce7;
		color: #166534;
		border: none;
		padding: 0.5rem 1.125rem;
		border-radius: 0.5rem;
		font-weight: 600;
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
	}

	/* Grammar Library */
	.grammar-search-wrapper {
		position: relative;
		margin-bottom: 1.5rem;
	}

	.level-heading {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 2rem 0 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 2px solid #3b82f6;
		display: inline-block;
		color: var(--text-color, #111827);
	}

	.grammar-rules-list {
		display: grid;
		gap: 1rem;
	}

	.grammar-rule-card {
		border: 1px solid var(--card-border, #e5e7eb);
		border-radius: 0.75rem;
		background-color: var(--card-bg, #ffffff);
		overflow: hidden;
	}

	.grammar-rule-header {
		width: 100%;
		padding: 1.25rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		cursor: pointer;
		transition: background-color 0.2s;
		background: none;
		border: none;
		text-align: left;
		font-family: inherit;
		color: var(--text-color, #111827);
	}

	.grammar-rule-header:hover {
		background-color: var(--link-hover-bg, #f9fafb);
	}

	.grammar-rule-title {
		font-size: 1.125rem;
		font-weight: 700;
		margin: 0;
		color: var(--text-color, #111827);
	}

	.grammar-rule-desc {
		margin: 0.25rem 0 0;
		font-size: 0.875rem;
		color: var(--text-color, #6b7280);
		opacity: 0.7;
	}

	.grammar-toggle-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 9999px;
		transition: background-color 0.2s;
		flex-shrink: 0;
		color: var(--text-color, #374151);
	}

	.grammar-toggle-btn:hover {
		background-color: var(--card-border, #e2e8f0);
	}

	.grammar-rule-content {
		padding: 0 1.25rem 1.25rem;
		border-top: 1px solid var(--card-border, #f3f4f6);
	}

	/* Beautiful Markdown Renderer */
	.grammar-guide {
		padding: 1.5rem;
		border-radius: 0.5rem;
		line-height: 1.6;
		color: var(--text-color, #374151);
	}

	.grammar-guide :global(h1),
	.grammar-guide :global(h2),
	.grammar-guide :global(h3),
	.grammar-guide :global(h4) {
		margin-top: 1.5rem;
		margin-bottom: 1rem;
		font-weight: 800;
		line-height: 1.25;
		color: var(--text-color, #1a202c);
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
		color: #3b82f6;
	}

	.grammar-guide :global(table) {
		width: 100%;
		border-collapse: collapse;
		margin-bottom: 1.5rem;
		font-size: 0.9rem;
	}

	.grammar-guide :global(th),
	.grammar-guide :global(td) {
		border: 1px solid var(--card-border, #e2e8f0);
		padding: 0.75rem;
		text-align: left;
		color: var(--text-color, #374151);
	}

	.grammar-guide :global(th) {
		background-color: var(--link-hover-bg, #f7fafc);
		font-weight: 700;
	}

	.grammar-guide :global(blockquote) {
		border-left: 4px solid #3b82f6;
		padding-left: 1rem;
		font-style: italic;
		color: var(--text-color, #4a5568);
		opacity: 0.8;
		margin: 1.5rem 0;
	}

	/* Modal Styles */
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.55);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 50;
		padding: 1rem;
		backdrop-filter: blur(2px);
	}

	.modal-content {
		background-color: var(--card-bg, #ffffff);
		border: 1px solid var(--card-border, #e5e7eb);
		border-radius: 0.875rem;
		box-shadow: 0 24px 48px -8px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0,0,0,0.04);
		max-width: 34rem;
		width: 100%;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		position: relative;
		overflow: hidden;
	}

	/* Header band */
	.modal-header {
		padding: 1.25rem 1.5rem 1.125rem;
		flex-shrink: 0;
		border-bottom: 1px solid var(--card-border, #e5e7eb);
		position: relative;
	}

	.modal-header::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 4px;
		background: #9ca3af;
		border-radius: 0.875rem 0 0 0;
	}

	.modal-header.gender-feminine::before { background: #ec4899; }
	.modal-header.gender-masculine::before { background: #3b82f6; }
	.modal-header.gender-neuter::before { background: #10b981; }

	.modal-close {
		position: absolute;
		top: 1rem;
		right: 1rem;
		background: transparent;
		border: none;
		width: 1.75rem;
		height: 1.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 0.375rem;
		color: var(--text-color, #9ca3af);
		opacity: 0.6;
		cursor: pointer;
		transition: opacity 0.15s, background 0.15s;
		padding: 0;
	}

	.modal-close svg { width: 1rem; height: 1rem; }
	.modal-close:hover { opacity: 1; background: var(--link-hover-bg, #f3f4f6); }

	.modal-header-main {
		padding-left: 0.5rem;
	}

	.modal-title {
		font-size: 1.875rem;
		font-weight: 800;
		margin: 0 2rem 0.375rem 0;
		line-height: 1.1;
		color: var(--text-color, #111827);
		letter-spacing: -0.02em;
	}

	.modal-header-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.375rem;
	}

	.modal-pos-badge {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-color, #6b7280);
		background: var(--link-hover-bg, #f3f4f6);
		border: 1px solid var(--card-border, #e5e7eb);
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
	}

	.modal-gender-badge {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
	}

	.gender-badge-feminine  { background: #fce7f3; color: #be185d; }
	.gender-badge-masculine { background: #dbeafe; color: #1d4ed8; }
	.gender-badge-neuter    { background: #d1fae5; color: #065f46; }

	.modal-level-badge {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
		background: #fef3c7;
		color: #92400e;
	}

	/* Body */
	.modal-body {
		padding: 0.75rem 0;
		overflow-y: auto;
		flex: 1;
		min-height: 0;
	}

	/* Dictionary entry rows */
	.dict-entry {
		display: flex;
		gap: 0.875rem;
		padding: 0.875rem 1.5rem;
		border-bottom: 1px solid var(--card-border, #f3f4f6);
		align-items: flex-start;
	}

	.dict-entry:last-child { border-bottom: none; }

	.dict-entry-icon {
		flex-shrink: 0;
		width: 1.5rem;
		height: 1.5rem;
		margin-top: 0.125rem;
		color: var(--text-color, #9ca3af);
		opacity: 0.5;
	}

	.dict-entry-icon svg { width: 100%; height: 100%; }

	.dict-entry-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.dict-label {
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-color, #9ca3af);
		opacity: 0.8;
	}

	.dict-meaning {
		font-size: 1.0625rem;
		font-weight: 500;
		color: var(--text-color, #111827);
		margin: 0;
		line-height: 1.4;
	}

	.dict-value {
		font-size: 0.9375rem;
		color: var(--text-color, #374151);
		margin: 0;
	}

	/* Declension / conjugation table */
	.dict-entry-block { align-items: flex-start; }

	.declension-table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 0.5rem;
		font-size: 0.8125rem;
	}

	.declension-table th {
		text-align: left;
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-color, #9ca3af);
		padding: 0.25rem 0.625rem 0.375rem 0;
		border-bottom: 1px solid var(--card-border, #e5e7eb);
	}

	.declension-table td {
		padding: 0.3rem 0.625rem 0.3rem 0;
		color: var(--text-color, #374151);
		border-bottom: 1px solid var(--card-border, #f3f4f6);
	}

	.declension-table tr:last-child td { border-bottom: none; }

	.case-name {
		font-weight: 600;
		color: var(--text-color, #6b7280) !important;
		font-size: 0.75rem;
		text-transform: lowercase;
		width: 6rem;
	}

	.conj-tense-label {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-color, #6b7280);
		margin: 0.75rem 0 0.125rem;
	}

	/* Example block */
	.dict-entry-example { background: var(--link-hover-bg, #f9fafb); }

	.example-sentence {
		font-size: 0.9375rem;
		font-style: italic;
		color: var(--text-color, #111827);
		margin: 0;
		line-height: 1.5;
	}

	.example-translation {
		font-size: 0.8125rem;
		color: var(--text-color, #6b7280);
		margin: 0.25rem 0 0;
	}

	/* Word tags */
	.word-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin-top: 0.125rem;
	}

	.word-tag {
		font-size: 0.8rem;
		padding: 0.2rem 0.625rem;
		border-radius: 999px;
		font-weight: 500;
	}

	.word-tag-syn { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
	.word-tag-ant { background: #fff1f2; color: #be123c; border: 1px solid #fecdd3; }

	.modal-metadata {
		font-size: 0.75rem;
		background: var(--link-hover-bg, #f9fafb);
		border-radius: 0.375rem;
		padding: 0.75rem;
		overflow-x: auto;
		color: var(--text-color, #374151);
		margin: 0;
	}

	.modal-footer {
		padding: 1rem 1.5rem;
		border-top: 1px solid var(--card-border, #e5e7eb);
		display: flex;
		justify-content: flex-start;
		background-color: var(--card-bg, #ffffff);
		flex-shrink: 0;
	}

	/* No Results & Empty State */
	.no-results {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		text-align: center;
		background-color: var(--card-bg, #f9fafb);
		border-radius: 1rem;
		border: 2px dashed var(--card-border, #e5e7eb);
		margin-top: 2rem;
	}

	.no-results-icon {
		width: 4rem;
		height: 4rem;
		color: var(--text-color, #9ca3af);
		opacity: 0.4;
		margin-bottom: 1.5rem;
	}

	.no-results-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-color, #111827);
		margin: 0 0 0.5rem 0;
	}

	.no-results-text {
		color: var(--text-color, #6b7280);
		opacity: 0.7;
		font-size: 1.125rem;
		margin: 0 0 2rem 0;
	}

	.ask-ai-section {
		width: 100%;
		max-width: 20rem;
		margin: 0 auto;
	}

	.btn-ask-ai {
		width: 100%;
		background-color: #7c3aed;
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
		gap: 0.625rem;
		transition:
			background-color 0.2s,
			transform 0.1s;
	}

	.btn-ask-ai:hover:not(:disabled) {
		background-color: #6d28d9;
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
		color: var(--text-color, #9ca3af);
		opacity: 0.5;
		font-style: italic;
	}

	.ask-ai-results-section {
		margin-top: 1.5rem;
		padding: 1.25rem;
		border: 1px dashed var(--card-border, #d1d5db);
		border-radius: 0.75rem;
		display: flex;
		align-items: center;
		gap: 1rem;
		background-color: var(--card-bg, #f9fafb);
		flex-wrap: wrap;
	}

	.ask-ai-results-text {
		flex: 1;
		margin: 0;
		color: var(--text-color, #6b7280);
		opacity: 0.7;
		font-size: 0.9rem;
	}

	.btn-ask-ai-results {
		background-color: #7c3aed;
		color: white;
		border: none;
		padding: 0.5rem 1.25rem;
		border-radius: 0.5rem;
		font-weight: 600;
		font-size: 0.9rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.625rem;
		white-space: nowrap;
		transition: background-color 0.2s;
	}

	.btn-ask-ai-results:hover:not(:disabled) {
		background-color: #6d28d9;
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
		color: var(--text-color, #6b7280);
		opacity: 0.7;
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
		background-color: var(--card-bg, #f3f4f6);
		border: 1px solid var(--card-border, #d1d5db);
		border-radius: 0.25rem;
		padding: 0.125rem 0.25rem;
		font-family: inherit;
		font-size: 0.75rem;
		color: var(--text-color, #374151);
	}

	.error-message {
		background-color: rgba(220, 38, 38, 0.08);
		color: #dc2626;
		padding: 0.75rem;
		border-radius: 0.5rem;
		margin-bottom: 1rem;
		font-size: 0.875rem;
		border: 1px solid rgba(220, 38, 38, 0.2);
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

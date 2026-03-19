<script lang="ts">
  import { page } from '$app/stores';
  import { vocabModal } from '$lib/stores/vocabModal.svelte';

  interface Props {
    vocabularies: any[];
    srsColors: Record<string, string>;
  }

  let { vocabularies, srsColors }: Props = $props();

  // Filter state
  let srsFilter = $state<string>('All');
  let searchQuery = $state('');

  const SRS_FILTER_OPTIONS = ['All', 'Unseen', 'Learning', 'Known', 'Mastered'];

  let filteredVocabularies = $derived(
    vocabularies.filter((vocab) => {
      const matchesState = srsFilter === 'All' || vocab.srsState === srsFilter.toUpperCase();
      const matchesSearch =
        searchQuery.trim() === '' ||
        vocab.vocabulary?.lemma?.toLowerCase().includes(searchQuery.trim().toLowerCase());
      return matchesState && matchesSearch;
    })
  );

  function openVocabModal(vocab: any) {
    const langId = $page.data.user?.activeLanguage?.id || '';
    vocabModal.open(vocab.vocabularyId || vocab.vocabulary?.id, langId, {
      id: vocab.vocabularyId || vocab.vocabulary?.id,
      lemma: vocab.vocabulary?.lemma,
      gender: vocab.vocabulary?.gender,
      plural: vocab.vocabulary?.plural,
      partOfSpeech: vocab.vocabulary?.partOfSpeech,
      meanings: vocab.vocabulary?.meanings
    });
  }
</script>

<section class="vocabulary-section">
  <h2>Vocabulary Heatmap</h2>

  <div class="heatmap-legend">
    <div class="legend-item">
      <span class="color-box" style="background-color: {srsColors.UNSEEN}"></span> Unseen
    </div>
    <div class="legend-item">
      <span class="color-box" style="background-color: {srsColors.LEARNING}"></span> Learning
    </div>
    <div class="legend-item">
      <span class="color-box" style="background-color: {srsColors.KNOWN}"></span> Known
    </div>
    <div class="legend-item">
      <span class="color-box" style="background-color: {srsColors.MASTERED}"></span> Mastered
    </div>
  </div>

  {#if vocabularies.length === 0}
    <div class="empty-state-vocab">
      <p class="empty-state-vocab-title">No vocabulary added yet</p>
      <p class="empty-state-vocab-desc">
        Start a lesson to build your word bank and track your progress here.
      </p>
      <a href="/play" class="empty-state-vocab-btn">Start Learning</a>
    </div>
  {:else}
    <!-- Filter bar -->
    <div class="heatmap-filter-bar">
      <div class="srs-filter-group" role="group" aria-label="Filter by SRS state">
        {#each SRS_FILTER_OPTIONS as option}
          <button
            class="srs-filter-btn"
            class:active={srsFilter === option}
            onclick={() => (srsFilter = option)}
            type="button"
          >
            {option}
          </button>
        {/each}
      </div>
      <div class="heatmap-search-wrap">
        <input
          class="heatmap-search"
          type="search"
          placeholder="Search words…"
          bind:value={searchQuery}
          aria-label="Search vocabulary words"
        />
      </div>
      <span class="heatmap-count"
        >{filteredVocabularies.length} word{filteredVocabularies.length !== 1 ? 's' : ''}</span
      >
    </div>

    {#if filteredVocabularies.length === 0}
      <div class="heatmap-no-match">No words match the current filter.</div>
    {:else}
      <div class="heatmap-grid">
        {#each filteredVocabularies as vocab}
          {@const isUnseen = vocab.srsState === 'UNSEEN'}
          {@const elo = vocab.eloRating !== undefined ? Math.round(vocab.eloRating) : 1000}
          {@const level = vocab.srsState}
          {@const levelText = isUnseen ? 'Unseen' : level.charAt(0) + level.slice(1).toLowerCase()}
          {@const cellColor = srsColors[level]}
          {@const progressPct = Math.max(
            0,
            Math.min(
              100,
              level === 'LEARNING'
                ? ((elo - 1000) / 50) * 100
                : level === 'KNOWN'
                  ? ((elo - 1050) / 100) * 100
                  : 100
            )
          )}
          <button
            class="heatmap-cell tooltip-trigger"
            style="background-color: {cellColor}"
            onclick={() => openVocabModal(vocab)}
            onkeydown={(e) => e.key === 'Enter' && openVocabModal(vocab)}
            aria-label="View details for {vocab.vocabulary.lemma}"
          >
            <span class="sr-only">{vocab.vocabulary.lemma}</span>
            <div class="tooltip-content">
              <div class="tooltip-header">
                {#if vocab.vocabulary.partOfSpeech?.toLowerCase() === 'noun'}
                  {vocab.vocabulary.lemma.charAt(0).toUpperCase() + vocab.vocabulary.lemma.slice(1)}
                {:else}
                  {vocab.vocabulary.lemma}
                {/if}
              </div>
              <div class="tooltip-body">
                {#if vocab.eloRating !== undefined && !isUnseen}
                  <div class="word-tooltip-elo">
                    <div class="elo-header">
                      <span>Mastery: {levelText}</span><span class="elo-score">ELO {elo}</span>
                    </div>
                    <div class="elo-progress-track">
                      <div
                        class="elo-progress-fill {levelText.toLowerCase()}"
                        style="width: {progressPct}%"
                      ></div>
                    </div>
                  </div>
                {:else if isUnseen}
                  <div class="word-tooltip-elo">
                    <div class="elo-header"><span>Status: {levelText}</span></div>
                  </div>
                {/if}
                {#if vocab.vocabulary.partOfSpeech}
                  <div><strong>POS:</strong> {vocab.vocabulary.partOfSpeech}</div>
                {/if}
                {#if vocab.vocabulary.partOfSpeech?.toLowerCase() === 'noun' && vocab.vocabulary.gender}
                  <div><strong>Gender:</strong> {vocab.vocabulary.gender}</div>
                {/if}
                {#if vocab.vocabulary.plural}
                  <div><strong>Plural:</strong> {vocab.vocabulary.plural}</div>
                {/if}
                {#if (vocab.vocabulary as any).meaning}
                  <div><strong>Meaning:</strong> {(vocab.vocabulary as any).meaning}</div>
                {/if}
              </div>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  {/if}
</section>

<style>
  /* Vocabulary Heatmap */
  .heatmap-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
    margin-bottom: 1rem;
    font-size: 0.9rem;
    background: #f8fafc;
    padding: 1rem;
    border-radius: 0.5rem;
    justify-content: center;
  }

  :global(html[data-theme='dark']) .heatmap-legend {
    background: #1e293b;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
    color: #475569;
  }

  .color-box {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 4px;
    display: inline-block;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  /* Filter bar */
  .heatmap-filter-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.625rem;
    margin-bottom: 1rem;
  }

  .srs-filter-group {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  .srs-filter-btn {
    font-family: inherit;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.3rem 0.65rem;
    border-radius: 999px;
    border: 1.5px solid var(--card-border, #e2e8f0);
    background: var(--card-bg, #ffffff);
    color: var(--text-muted, #64748b);
    cursor: pointer;
    transition:
      background 0.13s,
      color 0.13s,
      border-color 0.13s;
  }

  .srs-filter-btn:hover:not(.active) {
    background: var(--card-border, #f1f5f9);
    color: var(--text-color, #0f172a);
  }

  .srs-filter-btn.active {
    background: var(--color-primary, #3b82f6);
    border-color: var(--color-primary, #3b82f6);
    color: #ffffff;
  }

  :global(html[data-theme='dark']) .srs-filter-btn {
    background: #1e293b;
    border-color: #334155;
    color: #94a3b8;
  }

  :global(html[data-theme='dark']) .srs-filter-btn:hover:not(.active) {
    background: #334155;
    color: #f1f5f9;
  }

  :global(html[data-theme='dark']) .srs-filter-btn.active {
    background: var(--color-primary, #3b82f6);
    border-color: var(--color-primary, #3b82f6);
    color: #ffffff;
  }

  .heatmap-search-wrap {
    flex: 1 1 140px;
    min-width: 0;
    max-width: 220px;
  }

  .heatmap-search {
    width: 100%;
    font-family: inherit;
    font-size: 0.8rem;
    padding: 0.3rem 0.65rem;
    border-radius: 999px;
    border: 1.5px solid var(--card-border, #e2e8f0);
    background: var(--card-bg, #ffffff);
    color: var(--text-color, #0f172a);
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.13s;
  }

  .heatmap-search:focus {
    border-color: var(--color-primary, #3b82f6);
  }

  :global(html[data-theme='dark']) .heatmap-search {
    background: #1e293b;
    border-color: #334155;
    color: #f1f5f9;
  }

  .heatmap-count {
    font-size: 0.78rem;
    color: var(--text-muted, #64748b);
    white-space: nowrap;
    font-weight: 600;
  }

  .heatmap-no-match {
    text-align: center;
    padding: 2rem;
    color: var(--text-muted, #64748b);
    font-size: 0.95rem;
    background: var(--card-bg, #f8fafc);
    border-radius: 0.75rem;
    border: 1.5px dashed var(--card-border, #cbd5e1);
  }

  :global(html[data-theme='dark']) .heatmap-no-match {
    background: #1e293b;
    border-color: #475569;
  }

  .heatmap-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    background: var(--card-bg, #ffffff);
    padding: 2rem;
    border-radius: 1rem;
    box-shadow:
      0 10px 15px -3px rgba(0, 0, 0, 0.05),
      0 4px 6px -4px rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.05);
    max-width: 100%;
    box-sizing: border-box;
    max-height: 500px;
    overflow-y: auto;
    overflow-x: hidden;
    align-content: flex-start;
  }

  .heatmap-cell {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .heatmap-cell:hover {
    transform: scale(1.1) translateY(-2px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
    z-index: 10;
  }

  .tooltip-trigger {
    position: relative;
  }

  .tooltip-content {
    visibility: hidden;
    opacity: 0;
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 0;
    background-color: #0f172a;
    color: #f8fafc;
    text-align: left;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    width: max-content;
    min-width: 140px;
    max-width: 200px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
    z-index: 100;
    pointer-events: none;
    border: 1px solid rgba(255, 255, 255, 0.1);
    line-height: 1.3;
  }

  .tooltip-content::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -6px;
    border-width: 6px;
    border-style: solid;
    border-color: #0f172a transparent transparent transparent;
  }

  @media (max-width: 768px) {
    .tooltip-content {
      display: none;
    }
  }

  .tooltip-trigger:hover .tooltip-content {
    visibility: visible;
    opacity: 1;
  }

  @media (max-width: 768px) {
    .tooltip-trigger:hover .tooltip-content {
      transform: translateX(0);
    }
  }

  .tooltip-header {
    font-weight: 700;
    font-size: 0.95rem;
    margin-bottom: 0.25rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 0.25rem;
    color: #ffffff;
  }

  .tooltip-body {
    font-size: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    color: #cbd5e1;
  }

  .word-tooltip-elo {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 0.25rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .elo-header {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 0.7rem;
    color: #94a3b8;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .elo-score {
    color: #3b82f6;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  .elo-progress-track {
    display: block;
    width: 100%;
    height: 4px;
    background: #1e293b;
    border-radius: 9999px;
    overflow: hidden;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .elo-progress-fill {
    display: block;
    height: 100%;
    border-radius: 9999px;
    transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .elo-progress-fill.learning {
    background: linear-gradient(90deg, #facc15, #fef08a);
  }
  .elo-progress-fill.known {
    background: linear-gradient(90deg, #34d399, #6ee7b7);
  }
  .elo-progress-fill.mastered {
    background: linear-gradient(90deg, #10b981, #059669);
  }

  .empty-state-vocab {
    text-align: center;
    padding: 3rem 2rem;
    background: #f8fafc;
    border-radius: 1rem;
    border: 2px dashed #cbd5e1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  :global(html[data-theme='dark']) .empty-state-vocab {
    background: #1e293b;
    border-color: #475569;
  }

  .empty-state-vocab-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-color, #0f172a);
    margin: 0;
  }

  .empty-state-vocab-desc {
    color: #64748b;
    font-size: 0.95rem;
    margin: 0;
  }

  .empty-state-vocab-btn {
    margin-top: 0.75rem;
    display: inline-block;
    background: #1cb0f6;
    color: #fff;
    font-weight: 700;
    padding: 0.6rem 1.5rem;
    border-radius: 0.75rem;
    text-decoration: none;
    font-size: 0.95rem;
    transition: background 0.15s;
  }

  .empty-state-vocab-btn:hover {
    background: #0ea5e9;
  }

  @media (max-width: 768px) {
    .heatmap-legend {
      gap: 0.5rem;
      padding: 0.5rem;
      margin-bottom: 0.75rem;
      justify-content: flex-start;
    }

    .legend-item {
      font-size: 0.7rem;
      gap: 0.25rem;
    }

    .color-box {
      width: 0.75rem;
      height: 0.75rem;
    }

    .heatmap-filter-bar {
      gap: 0.5rem;
    }

    .heatmap-search-wrap {
      max-width: 100%;
    }

    .heatmap-grid {
      padding: 0.75rem;
      gap: 6px;
      justify-content: center;
      max-height: 350px;
    }

    .heatmap-cell {
      width: 16px;
      height: 16px;
      border-radius: 4px;
    }
  }
</style>

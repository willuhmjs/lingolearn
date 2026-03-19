<script lang="ts">
  import { toastError } from '$lib/utils/toast';
  import BaseModal from './BaseModal.svelte';

  let {
    vocab,
    enriching = false,
    onclose
  }: {
    vocab: any | null;
    enriching?: boolean;
    onclose: () => void;
  } = $props();

  let copiedId: string | null = $state(null);

  async function copyWord(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      copiedId = id;
      setTimeout(() => {
        copiedId = null;
      }, 1500);
    } catch {
      toastError('Failed to copy to clipboard. Please copy manually.');
    }
  }
</script>

<BaseModal open={!!vocab} {onclose} showCloseButton={false} noPadding={true} maxWidth="34rem">
  {#if vocab}
    <!-- Header band -->
    <div
      class="modal-header"
      class:gender-feminine={vocab.gender?.toLowerCase() === 'feminine'}
      class:gender-masculine={vocab.gender?.toLowerCase() === 'masculine'}
      class:gender-neuter={vocab.gender?.toLowerCase() === 'neuter'}
    >
      <button class="modal-close" onclick={onclose} aria-label="Close modal">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          ><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg
        >
      </button>
      <div class="modal-header-main">
        <div class="modal-title-row">
          <h2 id="vocab-modal-title" class="vocab-title">{vocab.lemma}</h2>
          <button
            class="copy-btn copy-btn-modal"
            onclick={() =>
              copyWord(
                'modal-' + vocab.id,
                vocab.lemma + (vocab.meanings?.[0]?.value ? ' — ' + vocab.meanings[0].value : '')
              )}
            title="Copy word"
            aria-label="Copy {vocab.lemma} to clipboard"
            >{#if copiedId === 'modal-' + vocab.id}✓{:else}<svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
                style="width:1rem;height:1rem"
                ><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path
                  d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                ></path></svg
              >{/if}</button
          >
        </div>
        <div class="modal-header-meta">
          {#if vocab.partOfSpeech}
            <span class="modal-pos-badge">{vocab.partOfSpeech}</span>
          {/if}
          {#if vocab.gender}
            <span class="modal-gender-badge gender-badge-{vocab.gender.toLowerCase()}">
              {vocab.gender.toLowerCase()}
            </span>
          {/if}
          {#if vocab.metadata?.level}
            <span class="modal-level-badge level-{vocab.metadata.level.toLowerCase()}"
              >{vocab.metadata.level}</span
            >
          {/if}
          {#if vocab.frequency != null}
            {@const rank = vocab.frequency}
            <span
              class="modal-freq-badge"
              title="Corpus frequency rank #{rank} — lower = more common"
            >
              #{rank.toLocaleString()}
            </span>
          {/if}
          {#if enriching}
            <span class="modal-enriching-badge">
              <span class="spinner-tiny"></span> Enriching
            </span>
          {/if}
        </div>
      </div>
    </div>

    <div class="modal-body">
      <!-- Meaning -->
      <div class="dict-entry">
        <span class="dict-entry-icon">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path
              d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
            /></svg
          >
        </span>
        <div class="dict-entry-body">
          <span class="dict-label">meaning</span>
          <p class="dict-meaning">
            {vocab.meanings?.[0]?.value || 'No meaning provided'}
          </p>
        </div>
      </div>

      {#if vocab.plural}
        <div class="dict-entry">
          <span class="dict-entry-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><rect x="2" y="7" width="8" height="14" rx="1" /><rect
                x="14"
                y="3"
                width="8"
                height="18"
                rx="1"
              /></svg
            >
          </span>
          <div class="dict-entry-body">
            <span class="dict-label">plural</span>
            <p class="dict-value">{vocab.plural}</p>
          </div>
        </div>
      {/if}

      {#if vocab.metadata}
        {#if vocab.metadata.declensions}
          <div class="dict-entry dict-entry-block">
            <span class="dict-entry-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><rect x="3" y="3" width="18" height="18" rx="2" /><path
                  d="M3 9h18M3 15h18M9 3v18"
                /></svg
              >
            </span>
            <div class="dict-entry-body">
              <span class="dict-label">declensions</span>
              <table class="declension-table">
                <thead>
                  <tr>
                    <th>case</th>
                    {#if typeof Object.values(vocab.metadata.declensions)[0] === 'object'}
                      {#each Object.keys(Object.values(vocab.metadata.declensions)[0] as Record<string, string>) as col}
                        <th>{col}</th>
                      {/each}
                    {:else}
                      <th>form</th>
                    {/if}
                  </tr>
                </thead>
                <tbody>
                  {#each Object.entries(vocab.metadata.declensions) as [caseName, forms]}
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

        {#if vocab.metadata.example}
          <div class="dict-entry dict-entry-example">
            <span class="dict-entry-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg
              >
            </span>
            <div class="dict-entry-body">
              <span class="dict-label">example</span>
              <p class="example-sentence">&#8220;{vocab.metadata.example}&#8221;</p>
              {#if vocab.metadata.exampleTranslation}
                <p class="example-translation">{vocab.metadata.exampleTranslation}</p>
              {/if}
            </div>
          </div>
        {/if}

        {#if vocab.metadata.synonyms?.length > 0 || vocab.metadata.antonyms?.length > 0}
          <div class="dict-entry">
            <span class="dict-entry-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><path d="M7 16V4m0 0L3 8m4-4 4 4" /><path d="M17 8v12m0 0 4-4m-4 4-4-4" /></svg
              >
            </span>
            <div class="dict-entry-body">
              {#if vocab.metadata.synonyms?.length > 0}
                <span class="dict-label">synonyms</span>
                <div class="word-tags">
                  {#each vocab.metadata.synonyms as word}
                    <span class="word-tag word-tag-syn">{word}</span>
                  {/each}
                </div>
              {/if}
              {#if vocab.metadata.antonyms?.length > 0}
                <span class="dict-label" style="margin-top:0.5rem">antonyms</span>
                <div class="word-tags">
                  {#each vocab.metadata.antonyms as word}
                    <span class="word-tag word-tag-ant">{word}</span>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        {/if}

        {#if vocab.metadata.conjugations}
          <div class="dict-entry dict-entry-block">
            <span class="dict-entry-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><path d="M12 20h9" /><path
                  d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
                /></svg
              >
            </span>
            <div class="dict-entry-body">
              <span class="dict-label">conjugations</span>
              {#each Object.entries(vocab.metadata.conjugations) as [tense, forms]}
                <p class="conj-tense-label">{tense}</p>
                {#if forms !== null && typeof forms === 'object' && !Array.isArray(forms)}
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
                {:else}
                  <p class="conj-form">{forms}</p>
                {/if}
              {/each}
            </div>
          </div>
        {/if}

        {#if !vocab.metadata.conjugations && !vocab.metadata.declensions && !vocab.metadata.example && !vocab.metadata.synonyms && !vocab.metadata.antonyms && !vocab.metadata.level && Object.keys(vocab.metadata).length > 0}
          <div class="dict-entry">
            <span class="dict-entry-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line
                  x1="12"
                  y1="16"
                  x2="12.01"
                  y2="16"
                /></svg
              >
            </span>
            <div class="dict-entry-body">
              <span class="dict-label">details</span>
              <pre class="modal-metadata">{JSON.stringify(vocab.metadata, null, 2)}</pre>
            </div>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</BaseModal>

<style>
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

  .modal-header.gender-feminine::before {
    background: #ec4899;
  }
  .modal-header.gender-masculine::before {
    background: #3b82f6;
  }
  .modal-header.gender-neuter::before {
    background: #10b981;
  }

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
    transition:
      opacity 0.15s,
      background 0.15s;
    padding: 0;
  }

  .modal-close svg {
    width: 1rem;
    height: 1rem;
  }
  .modal-close:hover {
    opacity: 1;
    background: var(--link-hover-bg, #f3f4f6);
  }

  .modal-header-main {
    padding-left: 0.5rem;
  }

  .vocab-title {
    font-size: 1.875rem;
    font-weight: 800;
    margin: 0 2rem 0.375rem 0;
    line-height: 1.1;
    color: var(--text-color, #111827);
    letter-spacing: -0.02em;
  }

  .modal-title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
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

  .modal-freq-badge {
    font-size: 0.7rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: #6366f1;
    background: #eef2ff;
    border: 1px solid #c7d2fe;
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
  }

  :global(html[data-theme='dark']) .modal-freq-badge {
    color: #a5b4fc;
    background: #1e1b4b;
    border-color: #3730a3;
  }

  .modal-gender-badge {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
  }

  .gender-badge-feminine {
    background: #fce7f3;
    color: #be185d;
  }
  .gender-badge-masculine {
    background: #dbeafe;
    color: #1d4ed8;
  }
  .gender-badge-neuter {
    background: #d1fae5;
    color: #065f46;
  }

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

  .modal-enriching-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    background: #7c3aed;
    color: white;
    box-shadow: 0 1px 2px rgba(124, 58, 237, 0.3);
  }

  .spinner-tiny {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 9999px;
    border: 1.5px solid rgba(255, 255, 255, 0.4);
    border-bottom-color: white;
    animation: spin 1s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
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

  .dict-entry:last-child {
    border-bottom: none;
  }

  .dict-entry-icon {
    flex-shrink: 0;
    width: 1.5rem;
    height: 1.5rem;
    margin-top: 0.125rem;
    color: var(--text-color, #9ca3af);
    opacity: 0.5;
  }

  .dict-entry-icon svg {
    width: 100%;
    height: 100%;
  }

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
  .dict-entry-block {
    align-items: flex-start;
  }

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

  .declension-table tr:last-child td {
    border-bottom: none;
  }

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

  .conj-form {
    font-size: 0.8125rem;
    color: var(--text-color, #374151);
    margin: 0.125rem 0 0.5rem;
  }

  /* Example block */
  .dict-entry-example {
    background: var(--link-hover-bg, #f9fafb);
  }

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

  .word-tag-syn {
    background: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
  }
  .word-tag-ant {
    background: #fff1f2;
    color: #be123c;
    border: 1px solid #fecdd3;
  }

  .modal-metadata {
    font-size: 0.75rem;
    background: var(--link-hover-bg, #f9fafb);
    border-radius: 0.375rem;
    padding: 0.75rem;
    overflow-x: auto;
    color: var(--text-color, #374151);
    margin: 0;
  }

  .copy-btn,
  .copy-btn-modal {
    background: none;
    border: none;
    cursor: pointer;
    color: #94a3b8;
    padding: 0.15rem;
    border-radius: 0.3rem;
    line-height: 1;
    font-size: 0.9rem;
    font-weight: 700;
    transition: color 0.15s;
    flex-shrink: 0;
  }

  .copy-btn:hover,
  .copy-btn-modal:hover {
    color: #3b82f6;
  }
</style>

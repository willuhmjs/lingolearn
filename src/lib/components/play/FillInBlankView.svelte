<script lang="ts">
  import { onMount } from 'svelte';
  import SpecialCharKeyboard from '$lib/components/SpecialCharKeyboard.svelte';
  import VoiceDictation from '$lib/components/VoiceDictation.svelte';
  import { charSets } from '$lib/utils/keyboard';

  let {
    challenge,
    submitting,
    feedback,
    loading,
    fillBlankAnswers = $bindable([]),
    lessonLanguage
  }: {
    challenge: any;
    submitting: boolean;
    feedback: any;
    loading: boolean;
    fillBlankAnswers?: string[];
    lessonLanguage?: { name: string } | null;
  } = $props();

  let focusedIndex = $state(0);
  let inputEls: (HTMLInputElement | null)[] = $state([]);

  const langKey = $derived(lessonLanguage?.name?.toLowerCase() || '');
  const showSpecialKeyboard = $derived(langKey in charSets);
  const speechLang = $derived(getLangCode(lessonLanguage?.name));
  const activeInputEl = $derived(inputEls[focusedIndex] ?? null);

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
        <label for="blank-{i}" class="label">
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
        class="blank-input"
        onfocus={() => (focusedIndex = i)}
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

  :global(html[data-theme='dark']) .input-label-row label {
    color: #cbd5e1;
  }

  .blank-input {
    width: 100%;
    padding: 0.875rem;
    border: 2px solid var(--input-border, #cbd5e1);
    border-radius: 8px;
    font-family: inherit;
    font-size: 1rem;
    color: var(--input-text, #0f172a);
    background: var(--input-bg, #ffffff);
    box-sizing: border-box;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }

  .blank-input::placeholder {
    color: #94a3b8;
  }

  :global(html[data-theme='dark']) .blank-input {
    border-color: var(--input-border, #3a4150);
    color: var(--input-text, #e2e8f0);
    background: var(--input-bg, #2a303c);
  }

  :global(html[data-theme='dark']) .blank-input::placeholder {
    color: #4a5260;
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

  :global(html[data-theme='dark']) .blank-input:disabled {
    background-color: #2a303c;
    color: #64748b;
  }

  /* Mobile: prevent iOS zoom (font-size must be >= 16px) */
  @media (max-width: 640px) {
    .blank-input {
      font-size: 1rem;
      padding: 0.875rem;
    }
  }
</style>

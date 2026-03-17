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
    userInput = $bindable(''),
    lessonLanguage,
    onsubmit
  }: {
    challenge: any;
    submitting: boolean;
    feedback: any;
    loading: boolean;
    userInput?: string;
    lessonLanguage?: { name: string } | null;
    onsubmit?: () => void;
  } = $props();

  let inputEl = $state<HTMLTextAreaElement | null>(null);

  const isTargetToNative = $derived(challenge?.gameMode === 'target-to-native');
  const langKey = $derived(lessonLanguage?.name?.toLowerCase() || '');
  const showSpecialKeyboard = $derived(!isTargetToNative && langKey in charSets);
  const speechLang = $derived(isTargetToNative ? 'en-US' : getLangCode(lessonLanguage?.name));

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

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !submitting && !feedback && !loading) {
      e.preventDefault();
      onsubmit?.();
    }
  }

  onMount(() => {
    inputEl?.focus();
  });
</script>

<div class="form-group">
  <div class="input-label-row">
    <label for="answer">Your Translation</label>
    <VoiceDictation
      lang={speechLang}
      bind:value={userInput}
      inputElement={inputEl}
      disabled={!!(submitting || feedback || loading)}
    />
  </div>

  {#if showSpecialKeyboard}
    <SpecialCharKeyboard bind:value={userInput} inputElement={inputEl} language={langKey} />
  {/if}

  <textarea
    id="answer"
    bind:this={inputEl}
    bind:value={userInput}
    disabled={submitting || !!feedback || loading}
    rows="3"
    placeholder={loading
      ? 'Generating challenge...'
      : challenge?.gameMode === 'target-to-native'
        ? 'Type your English translation here... (Enter to submit)'
        : `Type your ${lessonLanguage?.name || 'Target'} translation here... (Enter to submit)`}
    onkeydown={handleKeydown}
  ></textarea>
</div>

<style>
  .form-group {
    margin-bottom: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
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

  .form-group textarea {
    width: 100%;
    padding: 0.875rem;
    border: 2px solid var(--input-border, #cbd5e1);
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
    /* Larger minimum on mobile for comfortable typing */
    min-height: 5rem;
  }

  .form-group textarea::placeholder {
    color: #94a3b8;
  }

  :global(html[data-theme='dark']) .form-group textarea::placeholder {
    color: #4a5260;
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

  :global(html[data-theme='dark']) .form-group textarea:disabled {
    background-color: #2a303c;
    color: #64748b;
  }

  :global(html[data-theme='dark']) .input-label-row label {
    color: #cbd5e1;
  }

  /* Mobile optimizations */
  @media (max-width: 640px) {
    .form-group textarea {
      font-size: 1rem; /* Prevent iOS zoom on focus (must be >= 16px) */
      padding: 0.875rem;
      min-height: 6rem;
    }
  }
</style>

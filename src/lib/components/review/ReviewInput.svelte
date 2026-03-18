<script lang="ts">
  import SpecialCharKeyboard from '$lib/components/SpecialCharKeyboard.svelte';
  import VoiceDictation from '$lib/components/VoiceDictation.svelte';
  import { requiresSpecialKeyboard, languageToLocale } from '$lib/utils/keyboard';

  let {
    typedAnswer = $bindable(),
    lemma,
    activeLangName,
    isGrading,
    isSubmitting,
    onshowanswer,
    onskip
  }: {
    typedAnswer: string;
    lemma: string;
    activeLangName: string;
    isGrading: boolean;
    isSubmitting: boolean;
    onshowanswer: () => void;
    onskip: () => void;
  } = $props();

  let reviewInputRef: HTMLInputElement | undefined = $state(undefined);

  $effect(() => {
    if (reviewInputRef) {
      setTimeout(() => reviewInputRef?.focus(), 0);
    }
  });
</script>

<div class="typing-section">
  <div class="typing-label-row">
    <label class="typing-label" for="review-input"> Type your answer (optional) </label>
    <VoiceDictation
      lang={languageToLocale(activeLangName)}
      bind:value={typedAnswer}
      inputElement={reviewInputRef}
    />
  </div>
  {#if requiresSpecialKeyboard(lemma, activeLangName)}
    <SpecialCharKeyboard
      bind:value={typedAnswer}
      inputElement={reviewInputRef}
      language={activeLangName}
    />
  {/if}
  <input
    id="review-input"
    bind:this={reviewInputRef}
    bind:value={typedAnswer}
    type="text"
    class="review-input"
    placeholder="Type translation here..."
    onkeydown={(e) => {
      if (e.key === 'Enter') {
        e.stopPropagation();
        onshowanswer();
      }
    }}
  />
</div>
<button class="btn-duo btn-primary show-answer-btn" onclick={onshowanswer} disabled={isGrading}>
  {#if isGrading}
    <span class="grading-spinner"></span>
    Grading...
  {:else}
    Show Answer
    <span class="kbd-hint">Enter</span>
  {/if}
</button>
<button class="btn-skip" onclick={onskip} disabled={isSubmitting}> Skip this word </button>

<style>
  .typing-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .typing-label-row .typing-label {
    margin-bottom: 0;
  }

  .typing-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .typing-label {
    font-size: 0.875rem;
    font-weight: 700;
    color: #64748b;
  }

  :global(html[data-theme='dark']) .typing-label {
    color: #94a3b8;
  }

  .review-input {
    width: 100%;
    padding: 1rem;
    font-size: 1.125rem;
    font-weight: 600;
    border: 2px solid #e2e8f0;
    border-radius: 1rem;
    background-color: white;
    color: #0f172a;
    transition: all 0.2s;
    box-sizing: border-box;
  }

  .review-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
  }

  :global(html[data-theme='dark']) .review-input {
    background-color: #2a303c;
    border-color: #3a4150;
    color: #e2e8f0;
  }

  :global(html[data-theme='dark']) .review-input:focus {
    border-color: #3b82f6;
  }

  .show-answer-btn {
    width: 100%;
    padding-top: 1rem;
    padding-bottom: 1rem;
    font-size: 1.125rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .show-answer-btn:hover:not(:disabled) {
    transform: translateY(-2px) scale(1.02);
  }

  .show-answer-btn:active:not(:disabled) {
    transform: translateY(0) scale(0.98);
  }

  .grading-spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    display: inline-block;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .kbd-hint {
    font-size: 0.65rem;
    font-weight: 700;
    background: rgba(255, 255, 255, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.35);
    border-radius: 0.3rem;
    padding: 0.1rem 0.4rem;
    margin-left: 0.5rem;
    letter-spacing: 0.04em;
    opacity: 0.85;
  }

  .btn-skip {
    display: block;
    margin: 0.75rem auto 0;
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0.375rem 0.75rem;
    text-decoration: underline;
    text-underline-offset: 2px;
    transition: color 0.15s;
  }

  .btn-skip:hover {
    color: #64748b;
  }

  .btn-skip:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(html[data-theme='dark']) .btn-skip {
    color: #94a3b8;
  }

  :global(html[data-theme='dark']) .btn-skip:hover {
    color: #cbd5e1;
  }
</style>

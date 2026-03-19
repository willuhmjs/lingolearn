<script lang="ts">
  import { slide } from 'svelte/transition';

  import { charSets } from '$lib/utils/keyboard';

  let {
    value = $bindable(''),
    inputElement = null,
    language = 'en'
  }: {
    value?: string;
    inputElement?: HTMLInputElement | HTMLTextAreaElement | null;
    language?: string;
  } = $props();

  let isExpanded = $state(false);
  let isShift = $state(false);
  let activeIndex = $state(0); // 0 is Shift, 1+ are chars

  const normalizedLang = $derived(language?.toLowerCase() || 'en');
  const activeChars = $derived(
    charSets[normalizedLang]
      ? charSets[normalizedLang]
      : Array.from(new Set([...charSets.fr, ...charSets.es, ...charSets.de]))
  );
  const displayChars = $derived(isShift ? activeChars.map((c) => c.toUpperCase()) : activeChars);

  function insertChar(char: string, index: number) {
    activeIndex = index + 1;
    const c: string = char;
    const input: any = inputElement;
    if (!input) {
      value += c;
      return;
    }

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;

    value = value.substring(0, start) + c + value.substring(end);

    // Restore cursor position after Svelte updates the DOM
    requestAnimationFrame(() => {
      if (input) {
        input.focus();
        input.setSelectionRange(start + c.length, start + c.length);
      }
    });
  }

  function toggleShift() {
    isShift = !isShift;
    activeIndex = 0;
  }

  function toggleKeyboard() {
    isExpanded = !isExpanded;
    if (isExpanded) {
      activeIndex = 0;
    }
  }

  function handleToolbarKeydown(e: KeyboardEvent) {
    const totalButtons = displayChars.length + 1; // +1 for shift button

    if (e.key === 'ArrowRight') {
      activeIndex = (activeIndex + 1) % totalButtons;
      focusActiveButton();
    } else if (e.key === 'ArrowLeft') {
      activeIndex = (activeIndex - 1 + totalButtons) % totalButtons;
      focusActiveButton();
    } else if (e.key === 'Home') {
      activeIndex = 0;
      focusActiveButton();
    } else if (e.key === 'End') {
      activeIndex = totalButtons - 1;
      focusActiveButton();
    }
  }

  function focusActiveButton() {
    setTimeout(() => {
      const buttons = document.querySelectorAll('.keyboard-panel button');
      (buttons[activeIndex] as HTMLElement)?.focus();
    }, 0);
  }
</script>

<div class="special-char-container">
  <button
    type="button"
    class="toggle-button"
    onclick={toggleKeyboard}
    aria-expanded={isExpanded}
    aria-label="{isExpanded ? 'Hide' : 'Show'} special character keyboard"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="chevron {isExpanded ? 'expanded' : ''}"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
    <span>Special Characters</span>
  </button>

  {#if isExpanded}
    <div transition:slide class="keyboard-panel-wrapper">
      <div
        class="keyboard-panel"
        role="toolbar"
        aria-label="Special characters"
        onkeydown={handleToolbarKeydown}
      >
        <button
          type="button"
          class="shift-button {isShift ? 'active' : ''}"
          onclick={toggleShift}
          aria-pressed={isShift}
          aria-label="Toggle uppercase"
          tabindex={activeIndex === 0 ? 0 : -1}
        >
          Shift
        </button>
        <div class="char-keys">
          {#each displayChars as char, i}
            <button
              type="button"
              class="char-key"
              onclick={() => insertChar(char, i)}
              aria-label="Insert {char}"
              tabindex={activeIndex === i + 1 ? 0 : -1}
            >
              {char}
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .special-char-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0.5rem 0;
  }

  .toggle-button {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    align-self: flex-start;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-gray-500, #6b7280);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem 0;
    min-height: 2.75rem; /* touch target */
    touch-action: manipulation;
    transition: color 0.2s;
  }

  .toggle-button:hover,
  .toggle-button:focus-visible {
    color: var(--color-gray-700, #374151);
    outline: none;
  }

  .chevron {
    height: 1rem;
    width: 1rem;
    transition: transform 0.2s;
  }

  .chevron.expanded {
    transform: rotate(180deg);
  }

  .keyboard-panel-wrapper {
    overflow: hidden; /* For smooth slide transition */
  }

  .keyboard-panel {
    display: flex;
    flex-wrap: nowrap;
    gap: 0.5rem;
    background-color: var(--card-bg, #f9fafb);
    padding: 0.5rem;
    border-radius: var(--radius-md, 0.5rem);
    border: 1px solid var(--card-border, #e5e7eb);
    overflow-x: auto;
    align-items: center;
    /* Custom scrollbar for better look */
    scrollbar-width: thin;
    scrollbar-color: var(--text-muted, #d1d5db) transparent;
    -webkit-overflow-scrolling: touch;
  }

  :global(html[data-theme='dark']) .keyboard-panel {
    background-color: #2a303c;
    border-color: #3a4150;
  }

  .keyboard-panel::-webkit-scrollbar {
    height: 6px;
  }

  .keyboard-panel::-webkit-scrollbar-track {
    background: transparent;
  }

  .keyboard-panel::-webkit-scrollbar-thumb {
    background-color: var(--color-gray-300, #d1d5db);
    border-radius: 10px;
  }

  .shift-button {
    flex-shrink: 0;
    padding: 0.25rem 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    background-color: var(--card-border, #e5e7eb);
    color: var(--text-color, #1f2937);
    border: 1px solid var(--input-border, #d1d5db);
    border-radius: var(--radius-sm, 0.25rem);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .shift-button:hover {
    background-color: var(--color-gray-300, #d1d5db);
  }

  .shift-button:active {
    transform: scale(0.95);
  }

  .shift-button.active {
    background-color: var(--color-gray-500, #6b7280);
    color: white;
    border-color: var(--color-gray-600, #4b5563);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .char-keys {
    display: flex;
    gap: 0.25rem;
    flex-wrap: nowrap;
  }

  .char-key {
    flex-shrink: 0;
    width: 2.25rem;
    height: 2.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    background-color: var(--input-bg, #ffffff);
    color: var(--input-text, #1f2937);
    border: 1px solid var(--input-border, #d1d5db);
    border-radius: 0.25rem;
    cursor: pointer;
    touch-action: manipulation;
    transition: all 0.15s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  @media (max-width: 640px) {
    .char-key {
      width: 3rem;
      height: 3rem;
      font-size: 1.1rem;
      border-radius: 0.5rem;
      box-shadow: 0 2px 0 rgba(0, 0, 0, 0.12);
    }

    .shift-button {
      height: 3rem;
      padding: 0 1rem;
      font-size: 0.9rem;
      border-radius: 0.5rem;
    }

    .toggle-button {
      font-size: 0.875rem;
      min-height: 3rem;
      gap: 0.4rem;
    }
  }

  .char-key:hover {
    background-color: var(--color-gray-100, #f3f4f6);
    border-color: var(--color-gray-400, #9ca3af);
  }

  .char-key:active {
    background-color: var(--color-gray-200, #e5e7eb);
    transform: scale(0.95);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .char-key:focus-visible,
  .shift-button:focus-visible {
    outline: 2px solid var(--color-blue-500, #3b82f6);
    outline-offset: 1px;
  }

  :global(html[data-theme='dark']) .char-key {
    background-color: #3a4150;
    color: #e2e8f0;
    border-color: #4a5260;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  :global(html[data-theme='dark']) .char-key:hover {
    background-color: #4a5260;
    border-color: #64748b;
  }

  :global(html[data-theme='dark']) .shift-button {
    background-color: #3a4150;
    color: #e2e8f0;
    border-color: #4a5260;
  }

  :global(html[data-theme='dark']) .shift-button.active {
    background-color: #64748b;
    color: white;
    border-color: #94a3b8;
  }

  :global(html[data-theme='dark']) .toggle-button {
    color: #94a3b8;
  }

  :global(html[data-theme='dark']) .toggle-button:hover {
    color: #cbd5e1;
  }
</style>

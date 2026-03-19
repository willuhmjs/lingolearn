<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import type { Snippet } from 'svelte';
  import { onDestroy } from 'svelte';

  interface Props {
    open: boolean;
    onclose: () => void;
    title?: string;
    children: Snippet;
    maxWidth?: string;
    showCloseButton?: boolean;
    role?: 'dialog' | 'alertdialog';
    noPadding?: boolean;
  }

  let {
    open,
    onclose,
    title,
    children,
    maxWidth = '34rem',
    showCloseButton = true,
    role = 'dialog',
    noPadding = false
  }: Props = $props();

  let previouslyFocusedElement: HTMLElement | null = null;
  let modalRef: HTMLElement | null = $state(null);

  $effect(() => {
    if (open) {
      previouslyFocusedElement = document.activeElement as HTMLElement;
      // Small delay to let the transition start and elements render
      setTimeout(() => {
        const firstFocusable = modalRef?.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) as HTMLElement;
        firstFocusable?.focus();
      }, 50);

      // Disable body scroll
      document.body.style.overflow = 'hidden';
    } else {
      // Re-enable body scroll
      document.body.style.overflow = '';
      if (previouslyFocusedElement) {
        previouslyFocusedElement.focus();
        previouslyFocusedElement = null;
      }
    }
  });

  onDestroy(() => {
    // Only cleanup if we are on the client
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  });

  function handleTrapFocus(e: KeyboardEvent) {
    if (e.key !== 'Tab' || !open || !modalRef) return;

    const focusableElements = Array.from(
      modalRef.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ) as HTMLElement[];

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus();
        e.preventDefault();
      }
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      onclose();
    }
    handleTrapFocus(e);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" transition:fade={{ duration: 200 }} onclick={onclose}>
    <div
      bind:this={modalRef}
      class="modal-container"
      class:no-padding={noPadding}
      {role}
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      style="max-width: {maxWidth}"
      onclick={(e) => e.stopPropagation()}
      transition:fly={{ y: 20, duration: 200 }}
    >
      {#if showCloseButton}
        <button type="button" class="modal-close-btn" aria-label="Close" onclick={onclose}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            aria-hidden="true"
            width="14"
            height="14"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      {/if}

      <div class="modal-inner">
        {#if title}
          <h2 id="modal-title" class="modal-title">{title}</h2>
        {/if}
        {@render children()}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background-color: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(8px);
  }

  .modal-container {
    background-color: var(--card-bg, #ffffff);
    border: 2px solid var(--card-border, #e5e7eb);
    border-radius: var(--radius-3xl, 1.5rem);
    box-shadow:
      0 10px 25px -5px rgba(0, 0, 0, 0.2),
      0 8px 10px -6px rgba(0, 0, 0, 0.1),
      var(--shadow-duo);
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    position: relative;
    padding: 2rem 1.5rem;
  }

  .modal-container.no-padding {
    padding: 0;
    overflow: hidden;
  }

  .modal-close-btn {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--card-bg, #ffffff);
    border: 2px solid var(--card-border, #e5e7eb);
    border-radius: 50%;
    color: var(--text-color, #111827);
    cursor: pointer;
    z-index: 10;
    transition: all 0.15s;
    padding: 0;
  }

  .modal-close-btn:hover {
    background-color: var(--card-border, #f1f5f9);
    transform: scale(1.05);
  }

  :global(html[data-theme='dark']) .modal-close-btn {
    background-color: var(--card-bg, #1e293b);
    border-color: #3a4150;
    color: #cbd5e1;
  }

  :global(html[data-theme='dark']) .modal-close-btn:hover {
    background-color: #2a303c;
  }

  .modal-inner {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .modal-title {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--text-color, #111827);
    margin: 0 0 1.5rem;
    text-align: center;
    line-height: 1.2;
    padding-right: 2rem; /* Avoid overlap with close button if close button is present */
  }

  .modal-container.no-padding .modal-title {
    padding: 2rem 1.5rem 0;
  }
</style>

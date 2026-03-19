<script lang="ts">
  import { modal } from '$lib/modal.svelte';
  import { fade, scale } from 'svelte/transition';

  let modalState = $derived(modal.current);
  let previouslyFocusedElement: HTMLElement | null = null;

  // Handle escape key to close modal
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && modalState?.type !== 'alert') {
      modal.close(false);
    }
  }

  // Handle backdrop click - only allow for non-critical modals
  function handleBackdropClick() {
    if (modalState?.type !== 'alert' && modalState?.type !== 'confirm') {
      modal.close(false);
    }
  }

  // Save and restore focus for accessibility
  $effect(() => {
    if (modalState) {
      // Save currently focused element
      previouslyFocusedElement = document.activeElement as HTMLElement;

      // Focus the first button in the modal
      setTimeout(() => {
        const modalContainer = document.querySelector('.modal-container') as HTMLElement;
        const focusableElements = modalContainer?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements && focusableElements.length > 0) {
          (focusableElements[0] as HTMLElement).focus();
        }
      }, 50);
    } else if (previouslyFocusedElement) {
      // Restore focus when modal closes
      previouslyFocusedElement.focus();
      previouslyFocusedElement = null;
    }
  });

  function handleTrapFocus(e: KeyboardEvent) {
    if (e.key !== 'Tab' || !modalState) return;

    const modalContainer = document.querySelector('.modal-container') as HTMLElement;
    if (!modalContainer) return;

    const focusableElements = Array.from(
      modalContainer.querySelectorAll(
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
</script>

<svelte:window
  onkeydown={(e) => {
    handleKeydown(e);
    handleTrapFocus(e);
  }}
/>

{#if modalState}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" transition:fade={{ duration: 200 }} onclick={handleBackdropClick}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="modal-container"
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalState.title ? 'modal-title' : undefined}
      aria-describedby="modal-message"
      transition:scale={{ duration: 200, start: 0.95 }}
      onclick={(e) => e.stopPropagation()}
    >
      {#if modalState.type !== 'alert'}
        <button
          type="button"
          class="modal-close-btn"
          aria-label="Close"
          onclick={() => modal.close(false)}
        >
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
      <div class="modal-content">
        {#if modalState.title}
          <h3 id="modal-title" class="modal-title">
            {modalState.title}
          </h3>
        {/if}
        <p id="modal-message" class="modal-message">
          {modalState.message}
        </p>
      </div>

      <div class="modal-actions">
        {#if modalState.type === 'confirm'}
          <button
            type="button"
            class="modal-btn-cancel"
            aria-label={modalState.cancelText || 'Cancel'}
            onclick={() => modal.close(false)}
          >
            {modalState.cancelText || 'Cancel'}
          </button>
        {/if}

        <button
          type="button"
          class="modal-btn-confirm"
          aria-label={modalState.confirmText || 'OK'}
          onclick={() => modal.close(true)}
        >
          {modalState.confirmText || 'OK'}
        </button>
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
    max-width: 28rem;
    width: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    text-align: center;
    margin: 0 auto;
    position: relative;
  }

  .modal-close-btn {
    position: absolute;
    top: 0.625rem;
    right: 0.625rem;
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
    z-index: 1;
    transition:
      background-color 0.15s,
      color 0.15s;
  }

  .modal-close-btn:hover {
    background-color: var(--card-border, #f1f5f9);
  }

  :global(html[data-theme='dark']) .modal-close-btn {
    background-color: var(--card-bg, #1e293b);
    border-color: #3a4150;
    color: #cbd5e1;
  }

  :global(html[data-theme='dark']) .modal-close-btn:hover {
    background-color: #2a303c;
  }

  .modal-content {
    padding: 2rem 1.5rem 1.5rem;
  }

  /* Prevent title text overlapping the absolute-positioned X button */
  .modal-container:has(.modal-close-btn) .modal-content {
    padding-right: 3rem;
  }

  .modal-title {
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--text-color, #111827);
    margin-top: 0;
    margin-bottom: 0.75rem;
  }

  .modal-message {
    color: #64748b;
    margin: 0;
    font-size: 1rem;
    line-height: 1.5;
  }

  :global(html[data-theme='dark']) .modal-message {
    color: #94a3b8;
  }

  .modal-actions {
    background-color: var(--card-bg, #f8fafc);
    border-top: 2px solid var(--card-border, #e5e7eb);
    padding: 1rem 1.5rem;
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    width: 100%;
    box-sizing: border-box;
  }

  :global(html[data-theme='dark']) .modal-actions {
    background-color: var(--card-bg, #111827);
  }

  .modal-btn-cancel {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.625rem 1.25rem;
    font-family: inherit;
    font-size: 0.875rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
    background-color: transparent;
    border: 2px solid var(--card-border, #e5e7eb);
    border-radius: 0.75rem;
    cursor: pointer;
    transition:
      background-color 0.15s,
      color 0.15s;
  }

  .modal-btn-cancel:hover {
    background-color: var(--card-border, #f1f5f9);
    color: #475569;
  }

  :global(html[data-theme='dark']) .modal-btn-cancel {
    color: #94a3b8;
    border-color: #3a4150;
  }

  :global(html[data-theme='dark']) .modal-btn-cancel:hover {
    background-color: #2a303c;
    color: #cbd5e1;
  }

  .modal-btn-confirm {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.625rem 1.25rem;
    font-family: inherit;
    font-size: 0.875rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #ffffff;
    background-color: var(--color-success, #22c55e);
    border: 2px solid transparent;
    border-radius: var(--radius-lg, 0.75rem);
    cursor: pointer;
    box-shadow: 0 3px 0 var(--color-success-hover, #16a34a);
    transition:
      background-color 0.15s,
      transform 0.1s,
      box-shadow 0.1s;
  }

  .modal-btn-confirm:hover {
    background-color: var(--color-success, #4ade80);
    transform: scale(1.02);
  }

  .modal-btn-confirm:active {
    transform: scale(0.98) translateY(2px);
    box-shadow: 0 1px 0 var(--color-success-hover, #16a34a);
  }
</style>

<script lang="ts">
  import { modal } from '$lib/modal.svelte';
  import BaseModal from './BaseModal.svelte';
  import Button from './Button.svelte';

  let modalState = $derived(modal.current);

  // Handle backdrop click - only allow for non-critical modals
  function handleClose() {
    if (modalState?.type !== 'alert' && modalState?.type !== 'confirm') {
      modal.close(false);
    }
  }
</script>

<BaseModal
  open={!!modalState}
  onclose={handleClose}
  title={modalState?.title}
  showCloseButton={modalState?.type !== 'alert'}
>
  {#if modalState}
    <div class="modal-body-content">
      <p id="modal-message" class="modal-message">
        {modalState.message}
      </p>
    </div>

    <div class="modal-actions">
      {#if modalState.type === 'confirm'}
        <Button
          variant="secondary"
          onclick={() => modal.close(false)}
          aria-label={modalState.cancelText || 'Cancel'}
        >
          {modalState.cancelText || 'Cancel'}
        </Button>
      {/if}

      <Button
        variant="primary"
        onclick={() => modal.close(true)}
        aria-label={modalState.confirmText || 'OK'}
      >
        {modalState.confirmText || 'OK'}
      </Button>
    </div>
  {/if}
</BaseModal>

<style>
  .modal-body-content {
    margin-bottom: 2rem;
    text-align: center;
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
    display: flex;
    justify-content: center;
    gap: 0.75rem;
    width: 100%;
    margin-top: auto;
  }

  @media (max-width: 640px) {
    .modal-actions {
      flex-direction: column;
    }
    :global(.modal-actions button) {
      width: 100%;
    }
  }
</style>

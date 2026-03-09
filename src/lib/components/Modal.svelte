<script lang="ts">
	import { modal } from '$lib/modal.svelte';
	import { fade, scale } from 'svelte/transition';

	let modalState = $derived(modal.current);
</script>

{#if modalState}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="modal-backdrop"
		transition:fade={{ duration: 200 }}
		onclick={() => modalState?.type === 'alert' || modalState?.type === 'confirm' ? null : modal.close(false)}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="modal-container"
			transition:scale={{ duration: 200, start: 0.95 }}
			onclick={(e) => e.stopPropagation()}
		>
			<div class="modal-content">
				{#if modalState.title}
					<h3 class="modal-title">
						{modalState.title}
					</h3>
				{/if}
				<p class="modal-message">
					{modalState.message}
				</p>
			</div>

			<div class="modal-actions">
				{#if modalState.type === 'confirm'}
					<button
						type="button"
						class="modal-btn-cancel"
						onclick={() => modal.close(false)}
					>
						{modalState.cancelText || 'Cancel'}
					</button>
				{/if}

				<button
					type="button"
					class="modal-btn-confirm"
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
		background-color: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(4px);
	}

	.modal-container {
		background-color: #ffffff;
		border-radius: 0.5rem;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
		max-width: 28rem;
		width: 100%;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		text-align: center;
		margin: 0 auto;
	}

	.modal-content {
		padding: 1.5rem;
	}

	.modal-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: #111827;
		margin-top: 0;
		margin-bottom: 0.5rem;
	}

	.modal-message {
		color: #4b5563;
		margin: 0;
	}

	.modal-actions {
		background-color: #f9fafb;
		padding: 1rem 1.5rem;
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		width: 100%;
		box-sizing: border-box;
	}

	.modal-btn-cancel {
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
		background-color: transparent;
		border: 1px solid transparent;
		border-radius: 0.375rem;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.modal-btn-cancel:hover {
		background-color: #f3f4f6;
	}

	.modal-btn-confirm {
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: #ffffff;
		background-color: #2563eb;
		border: 1px solid transparent;
		border-radius: 0.375rem;
		cursor: pointer;
		transition: background-color 0.2s;
		box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
	}

	.modal-btn-confirm:hover {
		background-color: #1d4ed8;
	}
</style>

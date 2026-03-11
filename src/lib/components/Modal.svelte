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
		background-color: var(--card-bg, #ffffff);
		border: 2px solid var(--card-border, #e5e7eb);
		border-radius: 1.5rem;
		box-shadow: 0 4px 0 var(--card-border, #e5e7eb);
		max-width: 28rem;
		width: 100%;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		text-align: center;
		margin: 0 auto;
	}

	.modal-content {
		padding: 2rem 1.5rem 1.5rem;
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
		border-color: #374151;
	}

	:global(html[data-theme='dark']) .modal-btn-cancel:hover {
		background-color: #1f2937;
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
		background-color: #22c55e;
		border: 2px solid transparent;
		border-radius: 0.75rem;
		cursor: pointer;
		box-shadow: 0 3px 0 #16a34a;
		transition:
			background-color 0.15s,
			transform 0.1s,
			box-shadow 0.1s;
	}

	.modal-btn-confirm:hover {
		background-color: #4ade80;
		transform: scale(1.02);
	}

	.modal-btn-confirm:active {
		transform: scale(0.98) translateY(2px);
		box-shadow: 0 1px 0 #16a34a;
	}
</style>

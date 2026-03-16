<script lang="ts">
	let { show = $bindable(), onclose }: { show: boolean; onclose: () => void } = $props();
</script>

{#if show}
	<div
		class="kbd-modal-overlay"
		role="button"
		tabindex="0"
		onclick={onclose}
		onkeydown={(e) => e.key === 'Escape' && onclose()}
	>
		<div
			class="kbd-modal"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="kbd-modal-header">
				<h3>Keyboard Shortcuts</h3>
				<button class="kbd-modal-close" onclick={onclose}>×</button>
			</div>
			<div class="kbd-modal-body">
				<div class="kbd-shortcut">
					<span class="kbd-key">Enter</span>
					<span class="kbd-desc">Show answer / Continue</span>
				</div>
				<div class="kbd-shortcut">
					<span class="kbd-key">Space</span>
					<span class="kbd-desc">Continue after grading</span>
				</div>
				<div class="kbd-shortcut">
					<span class="kbd-key">Shift</span> + <span class="kbd-key">R</span>
					<span class="kbd-desc">Report an error</span>
				</div>
				<div class="kbd-shortcut">
					<span class="kbd-key">Ctrl</span> + <span class="kbd-key">Z</span>
					<span class="kbd-desc">Undo last card</span>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.kbd-modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.kbd-modal {
		background: var(--card-bg, #ffffff);
		border-radius: 1rem;
		padding: 1.5rem;
		max-width: 400px;
		width: 100%;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
	}

	.kbd-modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.kbd-modal-header h3 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 800;
		color: var(--text-color, #0f172a);
	}

	.kbd-modal-close {
		background: none;
		border: none;
		font-size: 2rem;
		color: #94a3b8;
		cursor: pointer;
		padding: 0;
		line-height: 1;
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 0.5rem;
		transition: all 0.15s;
	}

	.kbd-modal-close:hover {
		background: #f1f5f9;
		color: #64748b;
	}

	:global(html[data-theme='dark']) .kbd-modal-close:hover {
		background: #2a303c;
		color: #cbd5e1;
	}

	.kbd-modal-body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.kbd-shortcut {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.kbd-key {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 3rem;
		padding: 0.375rem 0.75rem;
		font-size: 0.75rem;
		font-weight: 700;
		background: #f8fafc;
		border: 2px solid #e2e8f0;
		border-radius: 0.375rem;
		color: #475569;
		box-shadow: 0 2px 0 #e2e8f0;
	}

	:global(html[data-theme='dark']) .kbd-key {
		background: #1e293b;
		border-color: #334155;
		color: #cbd5e1;
		box-shadow: 0 2px 0 #334155;
	}

	.kbd-desc {
		flex: 1;
		font-size: 0.875rem;
		color: #64748b;
	}

	:global(html[data-theme='dark']) .kbd-desc {
		color: #94a3b8;
	}
</style>

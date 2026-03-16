<script lang="ts">
	import { fly } from 'svelte/transition';

	let { reviewCount, onstart }: { reviewCount: number; onstart: () => void } = $props();
</script>

<div class="card-duo session-start-card" in:fly={{ y: 20, duration: 400, delay: 100 }}>
	<div class="session-icon">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
			<polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
			<polyline points="2 17 12 22 22 17"></polyline>
			<polyline points="2 12 12 17 22 12"></polyline>
		</svg>
	</div>
	<h2>Ready to review?</h2>
	<p>
		You have <strong>{reviewCount}</strong>
		{reviewCount === 1 ? 'card' : 'cards'} due for review.
	</p>
	<button class="btn-duo btn-primary start-session-btn" onclick={onstart}> Start Reviewing </button>
	<a href="/dashboard" class="btn-skip">Not now</a>
</div>

<style>
	.session-start-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		text-align: center;
		background-color: var(--card-bg, #ffffff);
		border-color: var(--card-border, #e2e8f0);
		box-shadow: 0 4px 0 var(--card-border, #e2e8f0);
	}

	:global(html[data-theme='dark']) .session-start-card {
		box-shadow: 0 4px 0 var(--card-border, #374151);
	}

	.session-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 7rem;
		height: 7rem;
		background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
		color: #1d4ed8;
		border-radius: 50%;
		margin-bottom: 2rem;
		box-shadow: 0 4px 0 rgba(29, 78, 216, 0.2);
	}

	.session-icon svg {
		width: 3rem;
		height: 3rem;
	}

	:global(html[data-theme='dark']) .session-icon {
		background: linear-gradient(135deg, rgba(30, 58, 138, 0.4) 0%, rgba(30, 64, 175, 0.4) 100%);
		color: #93c5fd;
		box-shadow: 0 4px 0 rgba(0, 0, 0, 0.2);
	}

	.session-start-card h2 {
		font-size: 2rem;
		margin: 0 0 0.75rem 0;
		color: var(--text-color, #0f172a);
	}

	.session-start-card p {
		font-size: 1.125rem;
		color: #64748b;
		margin: 0 0 2rem 0;
		line-height: 1.5;
	}

	:global(html[data-theme='dark']) .session-start-card p {
		color: #94a3b8;
	}

	.session-start-card p strong {
		color: #1d4ed8;
		font-size: 1.5rem;
	}

	:global(html[data-theme='dark']) .session-start-card p strong {
		color: #93c5fd;
	}

	.start-session-btn {
		width: 100%;
		max-width: 220px;
		padding-top: 1rem;
		padding-bottom: 1rem;
		font-size: 1.125rem;
		margin-bottom: 0.5rem;
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

	:global(html[data-theme='dark']) .btn-skip {
		color: #94a3b8;
	}

	:global(html[data-theme='dark']) .btn-skip:hover {
		color: #cbd5e1;
	}
</style>

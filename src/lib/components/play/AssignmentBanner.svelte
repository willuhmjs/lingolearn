<script lang="ts">
	import { fly } from 'svelte/transition';
	import type { AssignmentProgress } from '$lib/utils/playTypes';

	let {
		assignment,
		assignmentProgress,
		lessonLanguage,
		showBackButton = true
	}: {
		assignment: any;
		assignmentProgress: AssignmentProgress;
		lessonLanguage: any;
		showBackButton?: boolean;
	} = $props();
</script>

<div
	class="card card-duo assignment-banner {assignmentProgress.passed ? 'passed' : 'active'}"
	in:fly={{ y: 20, duration: 400, delay: 100 }}
>
	<div class="assignment-info">
		<div class="assignment-icon">
			{assignmentProgress.passed ? '🏆' : '📋'}
		</div>
		<div class="assignment-details">
			<h2 class="assignment-title">{assignment.title}</h2>
			<div class="assignment-meta">
				<span class="meta-badge">{assignment.class?.name ?? 'Class'}</span>
				<span class="meta-badge gamemode">{assignment.gamemode.replace(/-/g, ' ')}</span>
				<span class="meta-badge language">
					{assignment.language === 'international'
						? '🌍 International'
						: `${lessonLanguage?.flag || '🏁'} ${lessonLanguage?.name || 'Target'}`}
				</span>
			</div>
		</div>
	</div>
	<div class="assignment-actions">
		<div class="progress-box">
			<p class="progress-label">Progress</p>
			<p class="progress-value {assignmentProgress.passed ? 'passed' : 'active'}">
				{assignmentProgress.score}<span class="progress-target"
					>/{assignmentProgress.targetScore}</span
				>
			</p>
		</div>
		{#if showBackButton}
			<a href="/classes/{assignment.classId}" class="btn-duo btn-secondary back-btn">
				Back to Class
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg
				>
			</a>
		{/if}
	</div>
</div>

<style>
	.assignment-banner {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.25rem;
	}

	@media (min-width: 640px) {
		.assignment-banner {
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
		}
	}

	.assignment-banner.passed {
		background-color: #f0fdf4;
		border-color: #bbf7d0;
	}

	.assignment-banner.active {
		background-color: #eff6ff;
		border-color: #bfdbfe;
	}

	.assignment-info {
		display: flex;
		align-items: center;
		gap: 1rem;
		min-width: 0;
	}

	.assignment-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	.assignment-banner.passed .assignment-icon {
		background-color: #dcfce7;
	}

	.assignment-banner.active .assignment-icon {
		background-color: #dbeafe;
	}

	.assignment-details {
		min-width: 0;
	}

	.assignment-title {
		font-weight: 700;
		font-size: 1.125rem;
		margin: 0;
		color: #1e293b;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.assignment-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.meta-badge {
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.125rem 0.5rem;
		border-radius: 0.25rem;
		background-color: rgba(255, 255, 255, 0.6);
		color: #475569;
	}

	:global(html[data-theme='dark']) .meta-badge {
		background-color: rgba(255, 255, 255, 0.08);
		color: #94a3b8;
	}

	.meta-badge.gamemode {
		text-transform: capitalize;
	}

	.assignment-actions {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
	}

	@media (min-width: 640px) {
		.assignment-actions {
			flex-direction: row;
			align-items: center;
			width: auto;
		}
	}

	.progress-box {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background-color: rgba(255, 255, 255, 0.5);
		border-radius: 0.75rem;
		padding: 0.5rem 1rem;
	}

	@media (min-width: 640px) {
		.progress-box {
			flex-direction: column;
			align-items: flex-end;
			background-color: transparent;
			padding: 0;
		}
	}

	.progress-label {
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #64748b;
		margin: 0 0 0.125rem 0;
	}

	.progress-value {
		font-size: 1.5rem;
		font-weight: 800;
		line-height: 1;
		margin: 0;
	}

	.progress-value.passed {
		color: #16a34a;
	}
	.progress-value.active {
		color: #2563eb;
	}

	.progress-target {
		font-size: 0.875rem;
		font-weight: 600;
		color: #94a3b8;
		margin-left: 0.125rem;
	}

	.back-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		padding: 0.625rem 1rem;
		font-size: 0.875rem;
	}

	:global(html[data-theme='dark']) .assignment-banner.passed {
		background-color: rgba(6, 78, 59, 0.2);
		border-color: rgba(6, 95, 70, 0.5);
	}

	:global(html[data-theme='dark']) .assignment-banner.active {
		background-color: rgba(30, 58, 138, 0.2);
		border-color: rgba(30, 64, 175, 0.5);
	}

	:global(html[data-theme='dark']) .assignment-banner.passed .assignment-icon {
		background-color: rgba(6, 78, 59, 0.5);
	}

	:global(html[data-theme='dark']) .assignment-banner.active .assignment-icon {
		background-color: rgba(30, 58, 138, 0.5);
	}

	:global(html[data-theme='dark']) .assignment-title {
		color: #f1f5f9;
	}

	:global(html[data-theme='dark']) .progress-box {
		background-color: rgba(30, 41, 59, 0.5);
	}

	@media (min-width: 640px) {
		:global(html[data-theme='dark']) .progress-box {
			background-color: transparent;
		}
	}

	:global(html[data-theme='dark']) .progress-value.passed {
		color: #34d399;
	}
	:global(html[data-theme='dark']) .progress-value.active {
		color: #60a5fa;
	}

	@media (max-width: 768px) {
		.assignment-banner {
			padding: 1rem;
		}
	}
</style>

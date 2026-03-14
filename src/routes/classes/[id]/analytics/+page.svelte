<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { addToast } from '$lib/toast';

	export let data: PageData;

	let creating = false;
	let dropdownOpen = false;

	async function createRemediationAssignment(limit: number) {
		creating = true;

		try {
			// Get the top N words
			const targetWords = data.strugglingWords.slice(0, limit);
			const vocabularyIds = targetWords.map((w) => w.vocabularyId);
			const lemmas = targetWords.map((w) => w.lemma);

			const response = await fetch(`/api/classes/${$page.params.id}/assignments`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					title: `Remediation Assignment: ${lemmas.slice(0, 3).join(', ')}${lemmas.length > 3 ? '...' : ''}`,
					description: 'Auto-generated assignment to help with words the class is struggling with.',
					gamemode: 'flashcards',
					language: data.classData.primaryLanguage,
					targetScore: vocabularyIds.length * 10,
					dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
					topic: null,
					targetGrammar: [],
					vocabularyIds: vocabularyIds
				})
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to create assignment');
			}

			addToast('Remediation assignment created successfully!', 'success');
		} catch (error) {
			console.error('Error creating assignment:', error);
			addToast(error instanceof Error ? error.message : 'An error occurred', 'error');
		} finally {
			creating = false;
		}
	}
</script>

<div class="analytics-page">
	<div class="analytics-header">
		<nav class="breadcrumb">
			<a href="/classes">Classes</a>
			<span class="sep">/</span>
			<a href="/classes/{$page.params.id}">{data.classData.name}</a>
			<span class="sep">/</span>
			<span class="current">Analytics</span>
		</nav>
		<h1>{data.classData.name} – Analytics</h1>
		<p class="subtitle">Struggling Concepts Dashboard</p>
	</div>

	<div class="analytics-card">
		<div class="card-header">
			<div>
				<h2>Struggling Words</h2>
				<p class="card-desc">Words with the highest average difficulty and highest struggle rate across all students.</p>
			</div>
			<div class="remediation-dropdown" class:open={dropdownOpen}>
				<button
					class="btn-remediation"
					class:loading={creating}
					disabled={creating}
					onclick={() => dropdownOpen = !dropdownOpen}
					onblur={() => setTimeout(() => dropdownOpen = false, 150)}
				>
					{creating ? 'Creating...' : 'Create Remediation'}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
					</svg>
				</button>
				{#if dropdownOpen}
					<ul class="dropdown-menu">
						<li><button onclick={() => { dropdownOpen = false; createRemediationAssignment(10); }}>Top 10 Words</button></li>
						<li><button onclick={() => { dropdownOpen = false; createRemediationAssignment(20); }}>Top 20 Words</button></li>
						<li><button onclick={() => { dropdownOpen = false; createRemediationAssignment(50); }}>Top 50 Words</button></li>
					</ul>
				{/if}
			</div>
		</div>

		{#if data.strugglingWords.length === 0}
			<div class="analytics-empty">
				<div class="analytics-empty-icon" aria-hidden="true">📊</div>
				<p class="analytics-empty-title">No data yet</p>
				<p class="analytics-empty-desc">Students need to start learning vocabulary before struggles can be tracked.</p>
			</div>
		{:else}
			<div class="table-wrap">
				<table class="analytics-table">
					<thead>
						<tr>
							<th>Word</th>
							<th>Meaning</th>
							<th class="center">Students Seen</th>
							<th class="center">Avg Difficulty</th>
							<th class="center">Struggle Rate</th>
						</tr>
					</thead>
					<tbody>
						{#each data.strugglingWords as word}
							<tr>
								<td class="word-cell">{word.lemma}</td>
								<td class="meaning-cell">{word.meaning || '–'}</td>
								<td class="center">{word.totalStudentsLearned}</td>
								<td class="center">
									<div class="ease-cell">
										<span class="mono">{word.averageDifficulty.toFixed(2)}</span>
										<span
											class="difficulty-dot"
											style="background:{word.averageDifficulty > 7 ? '#ef4444' : word.averageDifficulty > 5 ? '#f97316' : '#22c55e'}"
											title={word.averageDifficulty > 7 ? 'Very Difficult' : word.averageDifficulty > 5 ? 'Difficult' : 'Okay'}
										></span>
									</div>
								</td>
								<td class="center">
									<div class="struggle-cell">
										<span class="mono">{word.strugglePercentage.toFixed(0)}%</span>
										<div class="struggle-bar-track">
											<div
												class="struggle-bar-fill"
												style="width:{word.strugglePercentage}%;background:{word.strugglePercentage > 50 ? '#ef4444' : '#f97316'}"
											></div>
										</div>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

<style>
	.analytics-page {
		max-width: 960px;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	.analytics-header { margin-bottom: 2rem; }

	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.8rem;
		margin-bottom: 0.5rem;
		flex-wrap: wrap;
	}

	.breadcrumb a {
		color: #60a5fa;
		text-decoration: none;
		font-weight: 600;
	}

	.breadcrumb a:hover { text-decoration: underline; }
	.sep { color: #64748b; }
	.current { color: #94a3b8; }

	.analytics-header h1 {
		font-size: 1.875rem;
		font-weight: 800;
		color: var(--text-color, #0f172a);
		margin: 0 0 0.25rem;
	}

	.subtitle { color: #64748b; margin: 0; font-size: 0.95rem; }

	.analytics-card {
		background: var(--card-bg, #ffffff);
		border: 2px solid var(--card-border, #e2e8f0);
		border-radius: 1.25rem;
		box-shadow: 0 4px 0 var(--card-border, #e2e8f0);
		overflow: hidden;
	}

	:global(html[data-theme='dark']) .analytics-card {
		box-shadow: 0 4px 0 var(--card-border, #374151);
	}

	.card-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.5rem;
		border-bottom: 2px solid var(--card-border, #e2e8f0);
		flex-wrap: wrap;
	}

	.card-header h2 {
		font-size: 1.1rem;
		font-weight: 800;
		color: var(--text-color, #1e293b);
		margin: 0 0 0.25rem;
	}

	.card-desc { font-size: 0.85rem; color: #64748b; margin: 0; max-width: 420px; }

	.remediation-dropdown { position: relative; flex-shrink: 0; }

	.btn-remediation {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: #3b82f6;
		color: white;
		border: none;
		border-radius: 0.75rem;
		padding: 0.6rem 1rem;
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
		box-shadow: 0 3px 0 #2563eb;
		font-family: inherit;
		white-space: nowrap;
		transition: background 0.15s;
	}

	.btn-remediation:hover:not(:disabled) { background: #2563eb; }
	.btn-remediation:disabled { opacity: 0.6; cursor: not-allowed; }

	.dropdown-menu {
		position: absolute;
		top: calc(100% + 0.5rem);
		right: 0;
		background: var(--card-bg, #ffffff);
		border: 2px solid var(--card-border, #e2e8f0);
		border-radius: 0.75rem;
		box-shadow: 0 8px 24px rgba(0,0,0,0.15);
		list-style: none;
		margin: 0;
		padding: 0.35rem;
		z-index: 50;
		min-width: 160px;
	}

	.dropdown-menu li button {
		width: 100%;
		background: none;
		border: none;
		text-align: left;
		padding: 0.55rem 0.85rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-color, #1e293b);
		cursor: pointer;
		font-family: inherit;
		transition: background 0.12s;
	}

	.dropdown-menu li button:hover { background: var(--card-border, #f1f5f9); }

	.analytics-empty {
		text-align: center;
		padding: 4rem 2rem;
	}

	.analytics-empty-icon { font-size: 3rem; margin-bottom: 1rem; }

	.analytics-empty-title {
		font-size: 1.25rem;
		font-weight: 800;
		color: var(--text-color, #1e293b);
		margin: 0 0 0.5rem;
	}

	.analytics-empty-desc { color: #64748b; font-size: 0.9rem; margin: 0; }

	.table-wrap { overflow-x: auto; }

	.analytics-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }

	.analytics-table thead tr { background: var(--card-border, #f8fafc); }

	:global(html[data-theme='dark']) .analytics-table thead tr {
		background: rgba(255,255,255,0.04);
	}

	.analytics-table th {
		padding: 0.85rem 1.25rem;
		font-size: 0.7rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: #64748b;
		text-align: left;
		border-bottom: 2px solid var(--card-border, #e2e8f0);
		white-space: nowrap;
	}

	.analytics-table th.center { text-align: center; }

	.analytics-table td {
		padding: 0.85rem 1.25rem;
		color: var(--text-color, #475569);
		border-bottom: 1px solid var(--card-border, #f1f5f9);
	}

	.analytics-table tr:last-child td { border-bottom: none; }

	.analytics-table tbody tr:hover { background: var(--card-border, #f8fafc); }

	:global(html[data-theme='dark']) .analytics-table tbody tr:hover {
		background: rgba(255,255,255,0.03);
	}

	.word-cell { font-weight: 800; color: var(--text-color, #1e293b) !important; }
	.meaning-cell { color: #64748b !important; }
	.center { text-align: center; }

	.ease-cell, .struggle-cell {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	.mono { font-family: ui-monospace, monospace; font-size: 0.875rem; }

	.difficulty-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.struggle-bar-track {
		width: 4rem;
		height: 0.5rem;
		background: var(--card-border, #e2e8f0);
		border-radius: 9999px;
		overflow: hidden;
		flex-shrink: 0;
	}

	.struggle-bar-fill {
		height: 100%;
		border-radius: 9999px;
	}
</style>

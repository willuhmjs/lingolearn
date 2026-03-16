<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	import { addToast } from '$lib/toast';

	let { data }: { data: PageData } = $props();

	let creating = $state(false);
	let dropdownOpen = $state(false);

	const errorLabels: Record<string, string> = {
		wrong_case: 'Wrong Case',
		wrong_tense: 'Wrong Tense',
		wrong_gender: 'Wrong Gender',
		spelling: 'Spelling',
		word_order: 'Word Order',
		vocabulary_gap: 'Vocabulary Gap'
	};

	let sortedStudents = $derived(
		[...((data as any).studentSummaries ?? [])].sort(
			(a: any, b: any) => (b.totalXp ?? 0) - (a.totalXp ?? 0)
		)
	);
	let errorEntries = $derived(
		Object.entries((data as any).errorTypeCounts ?? {}).sort(
			(a, b) => (b[1] as number) - (a[1] as number)
		)
	);
	let totalErrors = $derived(errorEntries.reduce((s, [, v]) => s + (v as number), 0));

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

	<!-- CEFR Distribution + Error Breakdown row -->
	<div class="analytics-top-row">
		{#if (data as any).cefrDistributionOrdered?.some((d: any) => d.count > 0)}
			{@const cefrDist = (data as any).cefrDistributionOrdered ?? []}
			{@const maxCefr = Math.max(...cefrDist.map((d: any) => d.count), 1)}
			<div class="analytics-card half-card">
				<div class="card-header">
					<div>
						<h2>CEFR Distribution</h2>
						<p class="card-desc">Current level spread across all students.</p>
					</div>
				</div>
				<div class="cefr-chart">
					{#each cefrDist as d}
						<div class="cefr-bar-group">
							<div class="cefr-bar-wrap">
								<div
									class="cefr-bar-col"
									style="height:{Math.round((d.count / maxCefr) * 100)}%;background:{d.count > 0
										? '#3b82f6'
										: 'var(--card-border,#e2e8f0)'}"
								>
									{#if d.count > 0}<span class="cefr-bar-count">{d.count}</span>{/if}
								</div>
							</div>
							<span class="cefr-bar-label">{d.level}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if errorEntries.length > 0}
			<div class="analytics-card half-card">
				<div class="card-header">
					<div>
						<h2>Error Breakdown</h2>
						<p class="card-desc">Most common error types across all student answers.</p>
					</div>
				</div>
				<div class="error-section">
					{#each errorEntries as [type, count]}
						<div class="error-bar-row">
							<span class="error-label">{errorLabels[type] ?? type}</span>
							<div class="error-track">
								<div
									class="error-fill"
									style="width:{Math.round(((count as number) / totalErrors) * 100)}%"
								></div>
							</div>
							<span class="error-count">{count as number}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<!-- Student Summary Table -->
	{#if sortedStudents.length > 0}
		<div class="analytics-card" style="margin-bottom:1.5rem;">
			<div class="card-header">
				<div>
					<h2>Student Overview</h2>
					<p class="card-desc">Per-student level, retention, and activity summary.</p>
				</div>
			</div>
			<div class="table-wrap">
				<table class="analytics-table">
					<thead>
						<tr>
							<th>Student</th>
							<th class="center">Level</th>
							<th class="center">XP</th>
							<th class="center">Streak</th>
							<th class="center">Words Reviewed</th>
							<th class="center">Avg Retention</th>
							<th class="center">Total Lapses</th>
						</tr>
					</thead>
					<tbody>
						{#each sortedStudents as s}
							<tr>
								<td class="word-cell">{s.name}</td>
								<td class="center">
									<span class="cefr-badge">{s.cefrLevel}</span>
								</td>
								<td class="center mono">{s.totalXp.toLocaleString()}</td>
								<td class="center mono">{s.currentStreak}d</td>
								<td class="center mono">{s.wordsReviewed}</td>
								<td class="center">
									{#if s.avgRetentionPct !== null}
										<span
											class="mono"
											style="color:{s.avgRetentionPct >= 80
												? '#22c55e'
												: s.avgRetentionPct >= 60
													? '#f97316'
													: '#ef4444'}">{s.avgRetentionPct}%</span
										>
									{:else}
										<span class="meaning-cell">–</span>
									{/if}
								</td>
								<td class="center mono">{s.totalLapses}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<!-- Struggling Words -->
	<div class="analytics-card" style="margin-bottom:1.5rem;">
		<div class="card-header">
			<div>
				<h2>Struggling Vocabulary</h2>
				<p class="card-desc">
					Words with the highest average difficulty and struggle rate across all students.
				</p>
			</div>
			<div class="remediation-dropdown" class:open={dropdownOpen}>
				<button
					class="btn-remediation"
					class:loading={creating}
					disabled={creating}
					onclick={() => (dropdownOpen = !dropdownOpen)}
					onblur={() => setTimeout(() => (dropdownOpen = false), 150)}
				>
					{creating ? 'Creating...' : 'Create Remediation'}
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						width="14"
						height="14"
						aria-hidden="true"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
					</svg>
				</button>
				{#if dropdownOpen}
					<ul class="dropdown-menu">
						<li>
							<button
								onclick={() => {
									dropdownOpen = false;
									createRemediationAssignment(10);
								}}>Top 10 Words</button
							>
						</li>
						<li>
							<button
								onclick={() => {
									dropdownOpen = false;
									createRemediationAssignment(20);
								}}>Top 20 Words</button
							>
						</li>
						<li>
							<button
								onclick={() => {
									dropdownOpen = false;
									createRemediationAssignment(50);
								}}>Top 50 Words</button
							>
						</li>
					</ul>
				{/if}
			</div>
		</div>

		{#if data.strugglingWords.length === 0}
			<div class="analytics-empty">
				<div class="analytics-empty-icon" aria-hidden="true">📊</div>
				<p class="analytics-empty-title">No data yet</p>
				<p class="analytics-empty-desc">
					Students need to start learning vocabulary before struggles can be tracked.
				</p>
			</div>
		{:else}
			<div class="table-wrap">
				<table class="analytics-table">
					<thead>
						<tr>
							<th>Word</th>
							<th>Meaning</th>
							<th class="center">Students</th>
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
											style="background:{word.averageDifficulty > 7
												? '#ef4444'
												: word.averageDifficulty > 5
													? '#f97316'
													: '#22c55e'}"
											title={word.averageDifficulty > 7
												? 'Very Difficult'
												: word.averageDifficulty > 5
													? 'Difficult'
													: 'Okay'}
										></span>
									</div>
								</td>
								<td class="center">
									<div class="struggle-cell">
										<span class="mono">{word.strugglePercentage.toFixed(0)}%</span>
										<div class="struggle-bar-track">
											<div
												class="struggle-bar-fill"
												style="width:{word.strugglePercentage}%;background:{word.strugglePercentage >
												50
													? '#ef4444'
													: '#f97316'}"
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

	<!-- Struggling Grammar -->
	{#if (data as any).strugglingGrammar?.length > 0}
		<div class="analytics-card">
			<div class="card-header">
				<div>
					<h2>Struggling Grammar</h2>
					<p class="card-desc">
						Grammar rules with the highest average difficulty across students.
					</p>
				</div>
			</div>
			<div class="table-wrap">
				<table class="analytics-table">
					<thead>
						<tr>
							<th>Rule</th>
							<th class="center">Level</th>
							<th class="center">Students</th>
							<th class="center">Avg Difficulty</th>
							<th class="center">Struggle Rate</th>
						</tr>
					</thead>
					<tbody>
						{#each (data as any).strugglingGrammar as rule}
							<tr>
								<td class="word-cell">{rule.title}</td>
								<td class="center"><span class="cefr-badge">{rule.level}</span></td>
								<td class="center">{rule.totalStudents}</td>
								<td class="center">
									<div class="ease-cell">
										<span class="mono">{rule.averageDifficulty.toFixed(2)}</span>
										<span
											class="difficulty-dot"
											style="background:{rule.averageDifficulty > 7
												? '#ef4444'
												: rule.averageDifficulty > 5
													? '#f97316'
													: '#22c55e'}"
										></span>
									</div>
								</td>
								<td class="center">
									<div class="struggle-cell">
										<span class="mono">{rule.strugglePercentage.toFixed(0)}%</span>
										<div class="struggle-bar-track">
											<div
												class="struggle-bar-fill"
												style="width:{rule.strugglePercentage}%;background:{rule.strugglePercentage >
												50
													? '#ef4444'
													: '#f97316'}"
											></div>
										</div>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>

<style>
	.analytics-page {
		max-width: 960px;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	.analytics-header {
		margin-bottom: 2rem;
	}

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

	.breadcrumb a:hover {
		text-decoration: underline;
	}
	.sep {
		color: #64748b;
	}
	.current {
		color: #94a3b8;
	}

	.analytics-header h1 {
		font-size: 1.875rem;
		font-weight: 800;
		color: var(--text-color, #0f172a);
		margin: 0 0 0.25rem;
	}

	.subtitle {
		color: #64748b;
		margin: 0;
		font-size: 0.95rem;
	}

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

	.card-desc {
		font-size: 0.85rem;
		color: #64748b;
		margin: 0;
		max-width: 420px;
	}

	.remediation-dropdown {
		position: relative;
		flex-shrink: 0;
	}

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

	.btn-remediation:hover:not(:disabled) {
		background: #2563eb;
	}
	.btn-remediation:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.dropdown-menu {
		position: absolute;
		top: calc(100% + 0.5rem);
		right: 0;
		background: var(--card-bg, #ffffff);
		border: 2px solid var(--card-border, #e2e8f0);
		border-radius: 0.75rem;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
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

	.dropdown-menu li button:hover {
		background: var(--card-border, #f1f5f9);
	}

	.analytics-empty {
		text-align: center;
		padding: 4rem 2rem;
	}

	.analytics-empty-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.analytics-empty-title {
		font-size: 1.25rem;
		font-weight: 800;
		color: var(--text-color, #1e293b);
		margin: 0 0 0.5rem;
	}

	.analytics-empty-desc {
		color: #64748b;
		font-size: 0.9rem;
		margin: 0;
	}

	.table-wrap {
		overflow-x: auto;
	}

	.analytics-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	.analytics-table thead tr {
		background: var(--card-border, #f8fafc);
	}

	:global(html[data-theme='dark']) .analytics-table thead tr {
		background: rgba(255, 255, 255, 0.04);
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

	.analytics-table th.center {
		text-align: center;
	}

	.analytics-table td {
		padding: 0.85rem 1.25rem;
		color: var(--text-color, #475569);
		border-bottom: 1px solid var(--card-border, #f1f5f9);
	}

	.analytics-table tr:last-child td {
		border-bottom: none;
	}

	.analytics-table tbody tr:hover {
		background: var(--card-border, #f8fafc);
	}

	:global(html[data-theme='dark']) .analytics-table tbody tr:hover {
		background: rgba(255, 255, 255, 0.03);
	}

	.word-cell {
		font-weight: 800;
		color: var(--text-color, #1e293b) !important;
	}
	.meaning-cell {
		color: #64748b !important;
	}
	.center {
		text-align: center;
	}

	.ease-cell,
	.struggle-cell {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	.mono {
		font-family: ui-monospace, monospace;
		font-size: 0.875rem;
	}

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

	.analytics-top-row {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.half-card {
		margin-bottom: 0;
	}

	/* CEFR bar chart */
	.cefr-chart {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
		padding: 1.25rem 1.25rem 0.75rem;
		height: 140px;
	}
	.cefr-bar-group {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: 1;
		height: 100%;
	}
	.cefr-bar-wrap {
		flex: 1;
		width: 100%;
		display: flex;
		align-items: flex-end;
	}
	.cefr-bar-col {
		width: 100%;
		border-radius: 0.375rem 0.375rem 0 0;
		min-height: 4px;
		position: relative;
		transition: height 0.3s;
		display: flex;
		align-items: flex-start;
		justify-content: center;
	}
	.cefr-bar-count {
		font-size: 0.7rem;
		font-weight: 800;
		color: white;
		padding-top: 3px;
	}
	.cefr-bar-label {
		font-size: 0.7rem;
		font-weight: 700;
		color: #64748b;
		margin-top: 0.3rem;
	}

	/* Error bars */
	.error-section {
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.error-bar-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.82rem;
	}
	.error-label {
		width: 110px;
		flex-shrink: 0;
		color: var(--text-color, #475569);
	}
	.error-track {
		flex: 1;
		height: 0.5rem;
		background: var(--card-border, #e2e8f0);
		border-radius: 9999px;
		overflow: hidden;
	}
	.error-fill {
		height: 100%;
		background: #f97316;
		border-radius: 9999px;
	}
	.error-count {
		font-family: ui-monospace, monospace;
		font-size: 0.8rem;
		color: #64748b;
		width: 24px;
		text-align: right;
	}

	/* Student table extras */
	.cefr-badge {
		display: inline-block;
		padding: 0.1rem 0.45rem;
		border-radius: 0.4rem;
		background: var(--card-border, #e2e8f0);
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--text-color, #1e293b);
	}
</style>

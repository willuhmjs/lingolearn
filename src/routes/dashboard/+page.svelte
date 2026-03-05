<script lang="ts">
	import type { PageData } from './$types';
	import { fly } from 'svelte/transition';

	export let data: PageData;

	// SrsState enum values from Prisma schema
	const srsColors = {
		UNSEEN: 'var(--color-unseen, #e2e8f0)', // gray-200
		LEARNING: 'var(--color-learning, #fef08a)', // yellow-200
		KNOWN: 'var(--color-known, #6ee7b7)', // emerald-300
		MASTERED: 'var(--color-mastered, #10b981)' // emerald-500
	};

	// Summary Statistics Calculations
	const totalVocab = data.vocabularies.length;
	const avgVocabElo = totalVocab > 0 ? Math.ceil(data.vocabularies.reduce((acc, v) => acc + v.eloRating, 0) / totalVocab) : 0;
	const vocabSrsBreakdown = data.vocabularies.reduce((acc, v) => {
		acc[v.srsState] = (acc[v.srsState] || 0) + 1;
		return acc;
	}, {} as Record<string, number>);

	const totalGrammar = data.grammarRules.length;
	const avgGrammarElo = totalGrammar > 0 ? Math.ceil(data.grammarRules.reduce((acc, r) => acc + r.eloRating, 0) / totalGrammar) : 0;
	const grammarSrsBreakdown = data.grammarRules.reduce((acc, r) => {
		acc[r.srsState] = (acc[r.srsState] || 0) + 1;
		return acc;
	}, {} as Record<string, number>);
</script>

<div class="dashboard-container dark:text-slate-300">
	<header class="dashboard-header" in:fly={{ y: 20, duration: 400 }}>
		<h1 class="dark:text-white">Proficiency Dashboard</h1>
		<p class="dark:text-slate-400">Track your language learning progress.</p>
		<a href="/onboarding" class="btn-duo btn-secondary">Retake Placement Test</a>
	</header>

	<section class="summary-section">
		<h2 class="dark:text-white dark:border-slate-700">Summary Statistics</h2>
		<div class="summary-grid">
			<div class="summary-card dark:bg-slate-800 dark:border-slate-700">
				<h3 class="dark:text-white dark:border-slate-700">Vocabulary</h3>
				<div class="stat-row">
					<span class="stat-label dark:text-slate-400">Total Terms:</span>
					<span class="stat-value dark:text-white">{totalVocab}</span>
				</div>
				<div class="stat-row">
					<span class="stat-label dark:text-slate-400">Average ELO:</span>
					<span class="stat-value dark:text-white">{avgVocabElo}</span>
				</div>
				<div class="srs-breakdown">
					<h4 class="dark:text-slate-300">SRS State Breakdown</h4>
					{#each Object.entries(srsColors) as [state, color]}
						<div class="breakdown-row">
							<div class="breakdown-label">
								<span class="color-box" style="background-color: {color}"></span>
								{state}
							</div>
							<span class="dark:text-slate-300">{vocabSrsBreakdown[state] || 0}</span>
						</div>
					{/each}
				</div>
			</div>
			<div class="summary-card dark:bg-slate-800 dark:border-slate-700">
				<h3 class="dark:text-white dark:border-slate-700">Grammar</h3>
				<div class="stat-row">
					<span class="stat-label dark:text-slate-400">Total Rules:</span>
					<span class="stat-value dark:text-white">{totalGrammar}</span>
				</div>
				<div class="stat-row">
					<span class="stat-label dark:text-slate-400">Average ELO:</span>
					<span class="stat-value dark:text-white">{avgGrammarElo}</span>
				</div>
				<div class="srs-breakdown">
					<h4 class="dark:text-slate-300">SRS State Breakdown</h4>
					{#each Object.entries(srsColors) as [state, color]}
						<div class="breakdown-row">
							<div class="breakdown-label">
								<span class="color-box" style="background-color: {color}"></span>
								{state}
							</div>
							<span class="dark:text-slate-300">{grammarSrsBreakdown[state] || 0}</span>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</section>

	<div class="dashboard-content">
		<section class="vocabulary-section">
			<h2 class="dark:text-white dark:border-slate-700">Vocabulary Heatmap</h2>
			<div class="heatmap-legend dark:text-slate-300">
				<div class="legend-item">
					<span class="color-box" style="background-color: {srsColors.UNSEEN}"></span> Unseen
				</div>
				<div class="legend-item">
					<span class="color-box" style="background-color: {srsColors.LEARNING}"></span> Learning
				</div>
				<div class="legend-item">
					<span class="color-box" style="background-color: {srsColors.KNOWN}"></span> Known
				</div>
				<div class="legend-item">
					<span class="color-box" style="background-color: {srsColors.MASTERED}"></span> Mastered
				</div>
			</div>
			
			{#if data.vocabularies.length === 0}
				<p class="empty-state dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">No vocabulary data available yet. Start learning!</p>
			{:else}
				<div class="heatmap-grid dark:bg-slate-800 dark:border-slate-700">
					{#each data.vocabularies as vocab}
						<div 
							class="heatmap-cell tooltip-trigger" 
							style="background-color: {srsColors[vocab.srsState]}"
						>
							<span class="sr-only">{vocab.vocabulary.lemma}</span>
							<div class="tooltip-content dark:bg-slate-700 dark:text-white">
								<div class="tooltip-header dark:border-slate-600">
									{#if vocab.vocabulary.partOfSpeech?.toLowerCase() === 'noun'}
										{vocab.vocabulary.lemma.charAt(0).toUpperCase() + vocab.vocabulary.lemma.slice(1)}
									{:else}
										{vocab.vocabulary.lemma}
									{/if}
								</div>
								<div class="tooltip-body">
									{#if vocab.eloRating !== undefined}
										{@const elo = Math.round(vocab.eloRating)}
										{@const levelText = elo < 1200 ? 'Learning' : elo < 1500 ? 'Known' : 'Mastered'}
										{@const progressPct = Math.max(0, Math.min(100, elo < 1200 ? ((elo - 1000) / 200) * 100 : elo < 1500 ? ((elo - 1200) / 300) * 100 : 100))}
										<div class="word-tooltip-elo">
											<div class="elo-header"><span>Mastery: {levelText}</span><span class="elo-score">ELO {elo}</span></div>
											<div class="elo-progress-track"><div class="elo-progress-fill {levelText.toLowerCase()}" style="width: {progressPct}%"></div></div>
										</div>
									{/if}
									{#if vocab.vocabulary.partOfSpeech}
										<div><strong>POS:</strong> {vocab.vocabulary.partOfSpeech}</div>
									{/if}
									{#if vocab.vocabulary.partOfSpeech?.toLowerCase() === 'noun' && vocab.vocabulary.gender}
										<div><strong>Gender:</strong> {vocab.vocabulary.gender}</div>
									{/if}
									{#if vocab.vocabulary.plural}
										<div><strong>Plural:</strong> {vocab.vocabulary.plural}</div>
									{/if}
									{#if vocab.vocabulary.meaning}
										<div><strong>Meaning:</strong> {vocab.vocabulary.meaning}</div>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<section class="grammar-section">
			<h2 class="dark:text-white dark:border-slate-700">Grammar Skill Tree</h2>
			{#if data.grammarRules.length === 0}
				<p class="empty-state dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">No grammar data available yet. Start learning!</p>
			{:else}
				<div class="skill-tree">
					{#each data.grammarRules as rule}
						<div class="skill-node dark:bg-slate-800 dark:border-slate-700">
							<div class="skill-info">
								<h3 class="dark:text-white">{rule.grammarRule.title}</h3>
								<p class="skill-desc dark:text-slate-400">{rule.grammarRule.description || ''}</p>
								
								<div class="debug-details dark:bg-slate-900 dark:text-slate-400">
									<div class="debug-grid">
										<div class="debug-item"><strong class="dark:text-slate-300">SRS State:</strong> {rule.srsState}</div>
										<div class="debug-item"><strong class="dark:text-slate-300">Raw ELO:</strong> {Math.ceil(rule.eloRating)}</div>
									</div>
								</div>
							</div>
							<div class="skill-progress">
								<div class="progress-labels dark:text-slate-400">
									<span>ELO {Math.ceil(rule.eloRating)}</span>
									<span>{rule.srsState}</span>
								</div>
								<div class="progress-bar-container dark:bg-slate-700">
									<!-- Baseline is roughly 1200, max mastery could be around 2000 -->
									<div 
										class="progress-bar-fill"
										style="width: {Math.max(0, Math.min(100, ((rule.eloRating - 1000) / 1000) * 100))}%"
									></div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</div>
</div>

<style>
	.dashboard-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
		font-family: system-ui, -apple-system, sans-serif;
		color: #334155;
	}

	.dashboard-header {
		margin-bottom: 2rem;
		text-align: center;
	}

	.dashboard-header h1 {
		font-size: 2.5rem;
		color: #0f172a;
		margin-bottom: 0.5rem;
	}

	.dashboard-header p {
		color: #64748b;
		font-size: 1.1rem;
		margin-bottom: 1rem;
	}

	.re-onboard-link {
		display: inline-block;
		padding: 0.5rem 1rem;
		background-color: #e2e8f0;
		color: #334155;
		text-decoration: none;
		border-radius: 4px;
		font-size: 0.9rem;
		transition: background-color 0.2s;
	}

	.re-onboard-link:hover {
		background-color: #cbd5e1;
	}

	/* Summary Section */
	.summary-section {
		margin-bottom: 3rem;
	}

	.summary-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 2rem;
	}

	@media (min-width: 768px) {
		.summary-grid {
			grid-template-columns: 1fr 1fr;
		}
	}

	.summary-card {
		background: var(--card-bg, #ffffff);
		border: 2px solid var(--card-border, #e5e7eb);
		border-radius: 1.5rem;
		padding: 1.5rem;
		box-shadow: 0 4px 0 var(--card-border, #e5e7eb);
		transition: transform 0.2s;
	}

	.summary-card:hover {
		transform: translateY(-4px);
	}

	.summary-card h3 {
		margin-top: 0;
		margin-bottom: 1rem;
		color: var(--text-color, #0f172a);
		font-size: 1.25rem;
		border-bottom: 1px solid var(--card-border, #cbd5e1);
		padding-bottom: 0.5rem;
	}

	.stat-row {
		display: flex;
		justify-content: space-between;
		margin-bottom: 0.5rem;
		font-size: 1.05rem;
	}

	.stat-label {
		color: #475569;
		font-weight: 500;
	}

	.stat-value {
		color: #0f172a;
		font-weight: 600;
	}

	.srs-breakdown {
		margin-top: 1.5rem;
	}

	.srs-breakdown h4 {
		font-size: 1rem;
		color: #334155;
		margin-bottom: 0.75rem;
	}

	.breakdown-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.25rem;
		font-size: 0.9rem;
	}

	.breakdown-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.dashboard-content {
		display: grid;
		grid-template-columns: 1fr;
		gap: 3rem;
	}

	@media (min-width: 1024px) {
		.dashboard-content {
			grid-template-columns: 1fr 1fr;
		}
	}

	h2 {
		font-size: 1.5rem;
		color: var(--text-color, #1e293b);
		margin-bottom: 1.5rem;
		border-bottom: 2px solid var(--card-border, #e2e8f0);
		padding-bottom: 0.5rem;
	}

	/* Vocabulary Heatmap */
	.heatmap-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin-bottom: 1.5rem;
		font-size: 0.9rem;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.color-box {
		width: 1rem;
		height: 1rem;
		border-radius: 2px;
		display: inline-block;
		border: 1px solid rgba(0,0,0,0.1);
	}

	.heatmap-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		background: var(--card-bg, #ffffff);
		padding: 1.5rem;
		border-radius: 1.5rem;
		border: 2px solid var(--card-border, #e5e7eb);
		box-shadow: 0 4px 0 var(--card-border, #e5e7eb);
	}

	.heatmap-cell {
		width: 18px;
		height: 18px;
		border-radius: 5px;
		cursor: help;
		transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
		border: 1px solid rgba(0,0,0,0.05);
	}

	.tooltip-trigger {
		position: relative;
	}

	.tooltip-trigger:hover {
		transform: scale(1.3) translateY(-2px);
		z-index: 10;
		box-shadow: 0 4px 8px rgba(0,0,0,0.15);
	}

	.tooltip-content {
		visibility: hidden;
		opacity: 0;
		position: absolute;
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		margin-bottom: 10px;
		background-color: #1e293b;
		color: #f8fafc;
		text-align: left;
		padding: 0.75rem;
		border-radius: 6px;
		width: max-content;
		min-width: 150px;
		box-shadow: 0 4px 6px rgba(0,0,0,0.3);
		transition: opacity 0.2s, visibility 0.2s;
		z-index: 100;
		pointer-events: none;
	}

	.tooltip-content::after {
		content: "";
		position: absolute;
		top: 100%;
		left: 50%;
		margin-left: -5px;
		border-width: 5px;
		border-style: solid;
		border-color: #1e293b transparent transparent transparent;
	}

	.tooltip-trigger:hover .tooltip-content {
		visibility: visible;
		opacity: 1;
	}

	.tooltip-header {
		font-weight: bold;
		font-size: 1.1rem;
		margin-bottom: 0.5rem;
		border-bottom: 1px solid #475569;
		padding-bottom: 0.25rem;
	}

	.tooltip-body {
		font-size: 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.word-tooltip-elo {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-bottom: 0.25rem;
		padding-bottom: 0.25rem;
		border-bottom: 1px solid #334155;
	}

	.elo-header {
		display: flex;
		justify-content: space-between;
		font-size: 0.75rem;
		color: #94a3b8;
		font-weight: 600;
	}

	.elo-score {
		color: #cbd5e1;
	}

	.elo-progress-track {
		display: block;
		width: 100%;
		height: 4px;
		background: #334155;
		border-radius: 2px;
		overflow: hidden;
	}

	.elo-progress-fill {
		display: block;
		height: 100%;
		border-radius: 2px;
		transition: width 0.3s ease;
	}
	
	.elo-progress-fill.learning { background: #3b82f6; }
	.elo-progress-fill.known { background: #eab308; }
	.elo-progress-fill.mastered { background: #22c55e; }

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	/* Grammar Skill Tree */
	.skill-tree {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.skill-node {
		background: var(--card-bg, #ffffff);
		border: 2px solid var(--card-border, #e5e7eb);
		border-radius: 1.5rem;
		padding: 1.25rem;
		box-shadow: 0 4px 0 var(--card-border, #e5e7eb);
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.skill-node:hover {
		transform: translateY(-4px);
		box-shadow: 0 8px 0 var(--card-border, #e5e7eb);
	}

	.skill-info h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.25rem;
		color: var(--text-color, #0f172a);
	}

	.skill-desc {
		margin: 0;
		color: #64748b;
		font-size: 0.95rem;
		margin-bottom: 1rem;
	}

	.debug-details {
		margin-bottom: 1rem;
		padding: 0.75rem;
		background-color: var(--input-bg, #e2e8f0);
		border-radius: 6px;
		font-size: 0.8rem;
		color: #475569;
	}

	.debug-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 0.5rem;
	}

	.debug-item strong {
		color: #334155;
	}

	.progress-labels {
		display: flex;
		justify-content: space-between;
		font-size: 0.875rem;
		color: #475569;
		margin-bottom: 0.5rem;
		font-weight: 500;
	}

	.progress-bar-container {
		height: 1rem;
		background-color: #e2e8f0;
		border-radius: 9999px;
		overflow: hidden;
		border: 2px solid #cbd5e1;
		box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
	}

	.progress-bar-fill {
		height: 100%;
		background-color: #3b82f6; /* blue-500 */
		background-image: linear-gradient(
			45deg,
			rgba(255, 255, 255, 0.15) 25%,
			transparent 25%,
			transparent 50%,
			rgba(255, 255, 255, 0.15) 50%,
			rgba(255, 255, 255, 0.15) 75%,
			transparent 75%,
			transparent
		);
		background-size: 1rem 1rem;
		border-radius: 9999px;
		transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
		animation: progress-stripes 1s linear infinite;
	}

	@keyframes progress-stripes {
		from { background-position: 1rem 0; }
		to { background-position: 0 0; }
	}

	.empty-state {
		text-align: center;
		padding: 3rem;
		background: var(--card-bg, #f8fafc);
		border-radius: 8px;
		border: 1px dashed var(--card-border, #cbd5e1);
		color: #64748b;
	}
</style>

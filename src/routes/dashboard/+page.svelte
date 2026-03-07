<script lang="ts">
	import type { PageData } from './$types';
	import { fly } from 'svelte/transition';
	import { marked } from 'marked';

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

	let selectedModalItem: { type: 'vocab' | 'grammar', data: any, color: string, eloPercent: number } | null = null;
	
	function openVocabModal(vocab: any, color: string, eloPercent: number) {
		selectedModalItem = { type: 'vocab', data: vocab, color, eloPercent };
	}

	function openGrammarModal(rule: any, color: string, eloPercent: number) {
		selectedModalItem = { type: 'grammar', data: rule, color, eloPercent };
	}

	function closeModal() {
		selectedModalItem = null;
	}
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
						{@const isUnseen = vocab.srsState === 'UNSEEN'}
						{@const elo = vocab.eloRating !== undefined ? Math.round(vocab.eloRating) : 1000}
						{@const level = vocab.srsState}
						{@const levelText = isUnseen ? 'Unseen' : level.charAt(0) + level.slice(1).toLowerCase()}
						{@const cellColor = srsColors[level]}
						{@const progressPct = Math.max(0, Math.min(100, level === 'LEARNING' ? ((elo - 1000) / 50) * 100 : level === 'KNOWN' ? ((elo - 1050) / 100) * 100 : 100))}
						<div 
							class="heatmap-cell tooltip-trigger" 
							style="background-color: {cellColor}"
							role="button"
							tabindex="0"
							on:click={() => openVocabModal(vocab, cellColor, progressPct)}
							on:keydown={(e) => e.key === 'Enter' && openVocabModal(vocab, cellColor, progressPct)}
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
									{#if vocab.eloRating !== undefined && !isUnseen}
										<div class="word-tooltip-elo">
											<div class="elo-header"><span>Mastery: {levelText}</span><span class="elo-score">ELO {elo}</span></div>
											<div class="elo-progress-track"><div class="elo-progress-fill {levelText.toLowerCase()}" style="width: {progressPct}%"></div></div>
										</div>
									{:else if isUnseen}
										<div class="word-tooltip-elo">
											<div class="elo-header"><span>Status: {levelText}</span></div>
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
			<h2 class="dark:text-white dark:border-slate-700">Grammar Web</h2>
			{#if data.grammarRules.length === 0}
				<p class="empty-state dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">No grammar data available yet. Start learning!</p>
			{:else}
				<div class="grammar-web-container dark:bg-slate-800 dark:border-slate-700">
					<!-- Visual web lines drawing actual connections -->
					<svg class="web-svg-lines" width="100%" height="100%">
						{#each data.grammarRules as rule, i}
							{#if i < data.grammarRules.length - 1}
								<line 
									x1="50%" 
									y1="{100 / data.grammarRules.length * i + (100 / data.grammarRules.length / 2)}%" 
									x2="50%" 
									y2="{100 / data.grammarRules.length * (i + 1) + (100 / data.grammarRules.length / 2)}%" 
									class="web-connection-line"
								/>
							{/if}
						{/each}
					</svg>
					
					<div class="web-tree-layout">
						{#each data.grammarRules as rule}
							{@const srsColor = srsColors[rule.srsState] || srsColors.UNSEEN}
							{@const eloPercent = Math.max(0, Math.min(100, ((rule.eloRating - 1000) / 1000) * 100))}
							
							<div 
								class="web-node-pill" 
								style="--node-color: {srsColor}"
								role="button"
								tabindex="0"
								on:click={() => openGrammarModal(rule, srsColor, eloPercent)}
								on:keydown={(e) => e.key === 'Enter' && openGrammarModal(rule, srsColor, eloPercent)}
							>
								<div class="node-pill-content tooltip-trigger">
									<div class="node-icon" style="background-color: {srsColor}">
										<span class="sr-only">{rule.srsState}</span>
									</div>
									<span class="node-title">{rule.grammarRule.title}</span>
									
									<div class="tooltip-content dark:bg-slate-700 dark:text-white">
										<div class="tooltip-header dark:border-slate-600">
											{rule.grammarRule.title}
										</div>
										<div class="tooltip-body">
											<div class="word-tooltip-elo">
												<div class="elo-header">
													<span>Status: {rule.srsState}</span>
													<span class="elo-score">ELO {Math.ceil(rule.eloRating)}</span>
												</div>
												<div class="elo-progress-track">
													<div class="elo-progress-fill {rule.srsState.toLowerCase()}" style="width: {eloPercent}%; background-color: {srsColor}"></div>
												</div>
											</div>
											<p class="node-desc">{rule.grammarRule.description || 'No description available.'}</p>
										</div>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</section>
	</div>
</div>

{#if selectedModalItem}
	<div class="modal-backdrop" on:click={closeModal} on:keydown={(e) => e.key === 'Escape' && closeModal()} role="button" tabindex="0">
		<div class="modal-content dark:bg-slate-800 dark:border-slate-700" on:click|stopPropagation role="document">
			<button class="modal-close dark:text-slate-400 dark:hover:text-white" on:click={closeModal}>&times;</button>
			
			{#if selectedModalItem.type === 'vocab'}
				{@const vocab = selectedModalItem.data}
				{@const isUnseen = vocab.srsState === 'UNSEEN'}
				{@const elo = vocab.eloRating !== undefined ? Math.round(vocab.eloRating) : 1000}
				{@const levelText = isUnseen ? 'Unseen' : vocab.srsState.charAt(0) + vocab.srsState.slice(1).toLowerCase()}
				
				<h3 class="modal-title dark:text-white">
					{#if vocab.vocabulary.partOfSpeech?.toLowerCase() === 'noun'}
						{vocab.vocabulary.lemma.charAt(0).toUpperCase() + vocab.vocabulary.lemma.slice(1)}
					{:else}
						{vocab.vocabulary.lemma}
					{/if}
				</h3>
				
				<div class="modal-body dark:text-slate-300">
					{#if !isUnseen}
						<div class="modal-elo-section">
							<div class="modal-elo-header">
								<span class="dark:text-slate-400">Mastery: {levelText}</span>
								<span class="modal-elo-score" style="color: {selectedModalItem.color}">ELO {elo}</span>
							</div>
							<div class="elo-progress-track">
								<div class="elo-progress-fill" style="width: {selectedModalItem.eloPercent}%; background-color: {selectedModalItem.color}"></div>
							</div>
						</div>
					{:else}
						<div class="modal-elo-section">
							<div class="modal-elo-header"><span class="dark:text-slate-400">Status: {levelText}</span></div>
						</div>
					{/if}
					
					<div class="modal-details">
						{#if vocab.vocabulary.partOfSpeech}
							<div class="modal-detail-row">
								<span class="detail-label dark:text-slate-400">POS:</span>
								<span>{vocab.vocabulary.partOfSpeech}</span>
							</div>
						{/if}
						{#if vocab.vocabulary.partOfSpeech?.toLowerCase() === 'noun' && vocab.vocabulary.gender}
							<div class="modal-detail-row">
								<span class="detail-label dark:text-slate-400">Gender:</span>
								<span>{vocab.vocabulary.gender}</span>
							</div>
						{/if}
						{#if vocab.vocabulary.plural}
							<div class="modal-detail-row">
								<span class="detail-label dark:text-slate-400">Plural:</span>
								<span>{vocab.vocabulary.plural}</span>
							</div>
						{/if}
						{#if vocab.vocabulary.meaning}
							<div class="modal-detail-row">
								<span class="detail-label dark:text-slate-400">Meaning:</span>
								<span>{vocab.vocabulary.meaning}</span>
							</div>
						{/if}
					</div>
				</div>
				
			{:else if selectedModalItem.type === 'grammar'}
				{@const rule = selectedModalItem.data}
				
				<h3 class="modal-title dark:text-white">{rule.grammarRule.title}</h3>
				
				<div class="modal-body dark:text-slate-300">
					<div class="modal-elo-section">
						<div class="modal-elo-header">
							<span class="dark:text-slate-400">Status: {rule.srsState}</span>
							<span class="modal-elo-score" style="color: {selectedModalItem.color}">ELO {Math.ceil(rule.eloRating)}</span>
						</div>
						<div class="elo-progress-track">
							<div class="elo-progress-fill" style="width: {selectedModalItem.eloPercent}%; background-color: {selectedModalItem.color}"></div>
						</div>
					</div>
					
					<div class="modal-details">
						<p class="modal-desc">{rule.grammarRule.description || 'No description available.'}</p>
						{#if rule.grammarRule.guide}
							<div class="grammar-guide markdown-body dark:bg-slate-900 dark:border-slate-700">
								{@html marked(rule.grammarRule.guide)}
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

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
		padding: 3rem 1rem;
		background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
		border-radius: 1rem;
		color: white;
		box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
	}

	.dashboard-header h1 {
		font-size: 2.5rem;
		color: #ffffff;
		margin-bottom: 0.5rem;
		font-weight: 800;
		letter-spacing: -0.025em;
	}

	.dashboard-header p {
		color: #94a3b8;
		font-size: 1.1rem;
		margin-bottom: 1.5rem;
		max-width: 600px;
		margin-left: auto;
		margin-right: auto;
	}

	.re-onboard-link {
		display: inline-block;
		padding: 0.75rem 1.5rem;
		background-color: #3b82f6;
		color: #ffffff;
		text-decoration: none;
		border-radius: 9999px;
		font-size: 0.95rem;
		font-weight: 600;
		transition: all 0.2s;
		box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.5);
	}

	.re-onboard-link:hover {
		background-color: #2563eb;
		transform: translateY(-2px);
		box-shadow: 0 6px 8px -1px rgba(59, 130, 246, 0.6);
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
		border-radius: 1rem;
		padding: 2rem;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -4px rgba(0, 0, 0, 0.05);
		transition: transform 0.3s ease, box-shadow 0.3s ease;
		position: relative;
		overflow: hidden;
		border: 1px solid rgba(0,0,0,0.05);
	}

	.summary-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 4px;
		background: linear-gradient(90deg, #3b82f6, #8b5cf6);
	}

	.summary-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
	}

	.summary-card h3 {
		margin-top: 0;
		margin-bottom: 1.5rem;
		color: var(--text-color, #0f172a);
		font-size: 1.5rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.stat-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		font-size: 1.1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid rgba(0,0,0,0.05);
	}

	.stat-row:last-of-type {
		border-bottom: none;
	}

	.stat-label {
		color: #64748b;
		font-weight: 500;
	}

	.stat-value {
		color: #0f172a;
		font-weight: 700;
		font-size: 1.25rem;
		background: #f1f5f9;
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
	}

	.srs-breakdown {
		margin-top: 2rem;
		background: #f8fafc;
		padding: 1.5rem;
		border-radius: 0.75rem;
	}

	.srs-breakdown h4 {
		font-size: 1rem;
		color: #475569;
		margin-bottom: 1rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 600;
	}

	.breakdown-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
		font-size: 0.95rem;
	}

	.breakdown-row:last-child {
		margin-bottom: 0;
	}

	.breakdown-label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: #334155;
		font-weight: 500;
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
		font-size: 1.75rem;
		color: var(--text-color, #0f172a);
		margin-bottom: 1.5rem;
		font-weight: 800;
		letter-spacing: -0.025em;
		position: relative;
		display: inline-block;
	}

	/* Vocabulary Heatmap */
	.heatmap-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
		margin-bottom: 2rem;
		font-size: 0.9rem;
		background: #f8fafc;
		padding: 1rem;
		border-radius: 0.5rem;
		justify-content: center;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 500;
		color: #475569;
	}

	.color-box {
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 4px;
		display: inline-block;
		box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
	}

	.heatmap-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		background: var(--card-bg, #ffffff);
		padding: 2rem;
		border-radius: 1rem;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -4px rgba(0, 0, 0, 0.05);
		border: 1px solid rgba(0,0,0,0.05);
	}

	.heatmap-cell {
		width: 24px;
		height: 24px;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
		box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
	}

	.heatmap-cell:hover {
		transform: scale(1.1) translateY(-2px);
		box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2);
		z-index: 10;
	}

	.tooltip-trigger {
		position: relative;
	}

	.tooltip-content {
		visibility: hidden;
		opacity: 0;
		position: absolute;
		bottom: calc(100% + 6px);
		left: 50%;
		transform: translateX(-50%) translateY(5px);
		margin-bottom: 0;
		background-color: #0f172a;
		color: #f8fafc;
		text-align: left;
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		width: max-content;
		min-width: 140px;
		max-width: 200px;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
		transition: all 0.2s ease;
		z-index: 100;
		pointer-events: none;
		border: 1px solid rgba(255,255,255,0.1);
		line-height: 1.3;
	}

	.tooltip-content::after {
		content: "";
		position: absolute;
		top: 100%;
		left: 50%;
		margin-left: -6px;
		border-width: 6px;
		border-style: solid;
		border-color: #0f172a transparent transparent transparent;
	}
	
	/* Ensure tooltip stays within viewport on mobile */
	@media (max-width: 768px) {
		.tooltip-content {
			left: auto;
			right: -40px;
			transform: translateX(0) translateY(5px);
		}
		
		.tooltip-content::after {
			left: auto;
			right: 46px;
		}
	}

	.tooltip-trigger:hover .tooltip-content {
		visibility: visible;
		opacity: 1;
		transform: translateX(-50%) translateY(0);
	}
	
	@media (max-width: 768px) {
		.tooltip-trigger:hover .tooltip-content {
			transform: translateX(0) translateY(0);
		}
	}

	.tooltip-header {
		font-weight: 700;
		font-size: 0.95rem;
		margin-bottom: 0.25rem;
		border-bottom: 1px solid rgba(255,255,255,0.1);
		padding-bottom: 0.25rem;
		color: #ffffff;
	}

	.tooltip-body {
		font-size: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		color: #cbd5e1;
	}

	.word-tooltip-elo {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-bottom: 0.25rem;
		padding-bottom: 0.25rem;
		border-bottom: 1px solid rgba(255,255,255,0.1);
	}

	.elo-header {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		font-size: 0.7rem;
		color: #94a3b8;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.elo-score {
		color: #3b82f6;
	}

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

	.elo-progress-track {
		display: block;
		width: 100%;
		height: 4px;
		background: #1e293b;
		border-radius: 9999px;
		overflow: hidden;
		box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);
	}

	.elo-progress-fill {
		display: block;
		height: 100%;
		border-radius: 9999px;
		transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
	}
	
	.elo-progress-fill.learning { background: linear-gradient(90deg, #facc15, #fef08a); }
	.elo-progress-fill.known { background: linear-gradient(90deg, #34d399, #6ee7b7); }
	.elo-progress-fill.mastered { background: linear-gradient(90deg, #10b981, #059669); }

	/* Grammar Web Redesign */
	.grammar-web-container {
		position: relative;
		background: var(--card-bg, #ffffff);
		border-radius: 1rem;
		padding: 2rem;
		min-height: 400px;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -4px rgba(0, 0, 0, 0.05);
		border: 1px solid rgba(0,0,0,0.05);
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.web-svg-lines {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 0;
		pointer-events: none;
	}

	.web-connection-line {
		stroke: #cbd5e1;
		stroke-width: 2px;
		stroke-dasharray: 4 4;
	}

	.dark .web-connection-line {
		stroke: #475569;
	}

	.web-tree-layout {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: 3rem;
		align-items: center;
		width: 100%;
		padding: 2rem 0;
	}

	.web-node-pill {
		position: relative;
		display: flex;
		align-items: center;
		background: #ffffff;
		border: 2px solid var(--node-color);
		border-radius: 9999px;
		padding: 0.5rem 1.25rem 0.5rem 0.5rem;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 0 10px var(--node-color)40;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		cursor: pointer;
	}

	.dark .web-node-pill {
		background: #1e293b;
	}

	.web-node-pill:hover {
		transform: translateY(-2px) scale(1.05);
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 0 15px var(--node-color)60;
		z-index: 10;
	}

	.node-pill-content {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.node-icon {
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
	}

	.node-title {
		font-weight: 600;
		font-size: 0.95rem;
		color: #334155;
	}

	.dark .node-title {
		color: #f8fafc;
	}

	.node-desc {
		margin-top: 0.5rem;
		color: #94a3b8;
	}

	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		background: #f8fafc;
		border-radius: 1rem;
		border: 2px dashed #cbd5e1;
		color: #64748b;
		font-size: 1.1rem;
		font-weight: 500;
	}

	@media (max-width: 768px) {
		.dashboard-container {
			padding: 1rem;
		}

		.dashboard-header {
			padding: 2rem 1rem;
		}

		.dashboard-header h1 {
			font-size: 2rem;
		}

		.dashboard-header .btn-duo {
			width: 100%;
			box-sizing: border-box;
		}

		.heatmap-grid {
			padding: 1rem;
			gap: 6px;
			justify-content: center;
		}

		.heatmap-cell {
			width: 18px;
			height: 18px;
		}
		
		.web-node-wrapper {
			flex: 1 1 100%;
		}
	}

	/* Modal CSS */
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		backdrop-filter: blur(2px);
	}

	.modal-content {
		position: relative;
		background: #ffffff;
		padding: 2.5rem 2rem 2rem;
		border-radius: 1rem;
		max-width: 90%;
		width: 500px;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
	}

	.modal-close {
		position: absolute;
		top: 0.75rem;
		right: 1rem;
		background: transparent;
		border: none;
		font-size: 1.5rem;
		line-height: 1;
		cursor: pointer;
		padding: 0.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 0.5rem;
		transition: all 0.2s;
	}

	.modal-close:hover {
		background: rgba(0,0,0,0.05);
	}

	.dark .modal-close:hover {
		background: rgba(255,255,255,0.1);
	}

	.modal-title {
		font-size: 1.5rem;
		font-weight: 800;
		margin-bottom: 1rem;
		margin-top: 0;
		padding-right: 1rem;
	}

	.modal-body {
		font-size: 1rem;
		color: #475569;
		overflow-y: auto;
		flex-grow: 1;
	}

	.modal-elo-section {
		margin-bottom: 1.5rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid rgba(0,0,0,0.05);
	}

	.dark .modal-elo-section {
		border-bottom-color: rgba(255,255,255,0.1);
	}

	.modal-elo-header {
		display: flex;
		justify-content: space-between;
		font-weight: 700;
		margin-bottom: 0.5rem;
		font-size: 0.9rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.modal-elo-score {
		font-weight: 800;
	}

	.modal-details {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.modal-detail-row {
		display: flex;
		gap: 0.5rem;
	}

	.detail-label {
		font-weight: 600;
		color: #64748b;
		width: 70px;
		flex-shrink: 0;
	}

	.modal-desc {
		line-height: 1.5;
		margin-bottom: 0.5rem;
	}

	.grammar-guide {
		padding: 1.25rem;
		border-radius: 0.75rem;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		font-size: 1rem;
		line-height: 1.6;
		max-height: 400px;
		overflow-y: auto;
		color: #334155;
		box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
	}

	.dark .grammar-guide {
		background: #0f172a;
		border-color: #1e293b;
		color: #cbd5e1;
	}

	.grammar-guide :global(h1),
	.grammar-guide :global(h2),
	.grammar-guide :global(h3),
	.grammar-guide :global(h4) {
		color: #0f172a;
		margin-top: 1.5rem;
		margin-bottom: 0.75rem;
		font-weight: 700;
		line-height: 1.3;
	}

	.dark .grammar-guide :global(h1),
	.dark .grammar-guide :global(h2),
	.dark .grammar-guide :global(h3),
	.dark .grammar-guide :global(h4) {
		color: #f8fafc;
	}

	.grammar-guide :global(h1:first-child),
	.grammar-guide :global(h2:first-child),
	.grammar-guide :global(h3:first-child) {
		margin-top: 0;
	}

	.grammar-guide :global(h1) { font-size: 1.5rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; }
	.grammar-guide :global(h2) { font-size: 1.25rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.3rem; }
	.grammar-guide :global(h3) { font-size: 1.1rem; }

	.dark .grammar-guide :global(h1),
	.dark .grammar-guide :global(h2) { border-color: #1e293b; }

	.grammar-guide :global(p) {
		margin-top: 0;
		margin-bottom: 1rem;
	}

	.grammar-guide :global(p:last-child) {
		margin-bottom: 0;
	}

	.grammar-guide :global(ul),
	.grammar-guide :global(ol) {
		margin-top: 0;
		margin-bottom: 1rem;
		padding-left: 1.5rem;
	}

	.grammar-guide :global(li) {
		margin-bottom: 0.25rem;
	}

	.grammar-guide :global(strong),
	.grammar-guide :global(b) {
		font-weight: 700;
		color: #0f172a;
	}

	.dark .grammar-guide :global(strong),
	.dark .grammar-guide :global(b) {
		color: #f8fafc;
	}

	.grammar-guide :global(em),
	.grammar-guide :global(i) {
		color: #475569;
	}

	.dark .grammar-guide :global(em),
	.dark .grammar-guide :global(i) {
		color: #94a3b8;
	}

	.grammar-guide :global(code) {
		background: #e2e8f0;
		padding: 0.1rem 0.3rem;
		border-radius: 0.25rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.85em;
		color: #db2777;
	}

	.dark .grammar-guide :global(code) {
		background: #1e293b;
		color: #f472b6;
	}

	.grammar-guide :global(pre) {
		background: #1e293b;
		padding: 1rem;
		border-radius: 0.5rem;
		overflow-x: auto;
		margin-bottom: 1rem;
	}

	.grammar-guide :global(pre code) {
		background: transparent;
		color: #e2e8f0;
		padding: 0;
		font-size: 0.9em;
	}

	.grammar-guide :global(blockquote) {
		border-left: 4px solid #3b82f6;
		padding-left: 1rem;
		margin-left: 0;
		margin-right: 0;
		background: #f1f5f9;
		padding-top: 0.5rem;
		padding-bottom: 0.5rem;
		border-radius: 0 0.25rem 0.25rem 0;
		font-style: italic;
	}

	.dark .grammar-guide :global(blockquote) {
		background: #1e293b;
		border-left-color: #60a5fa;
	}

	.grammar-guide :global(table) {
		width: 100%;
		border-collapse: collapse;
		margin-bottom: 1rem;
	}

	.grammar-guide :global(th),
	.grammar-guide :global(td) {
		border: 1px solid #e2e8f0;
		padding: 0.5rem;
		text-align: left;
	}

	.dark .grammar-guide :global(th),
	.dark .grammar-guide :global(td) {
		border-color: #334155;
	}

	.grammar-guide :global(th) {
		background: #f1f5f9;
		font-weight: 600;
	}

	.dark .grammar-guide :global(th) {
		background: #1e293b;
	}
</style>

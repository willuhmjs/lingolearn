<script lang="ts">
	import { onMount } from 'svelte';

	const srsColors: Record<string, string> = {
		LOCKED: 'var(--color-locked, #94a3b8)',
		UNSEEN: 'var(--color-unseen, #e2e8f0)',
		LEARNING: 'var(--color-learning, #fef08a)',
		KNOWN: 'var(--color-known, #6ee7b7)',
		MASTERED: 'var(--color-mastered, #10b981)'
	};

	interface Props {
		allGrammarRules: any[];
		grammarRules: any[];
		onOpenModal: (rule: any, color: string, eloPercent: number) => void;
	}

	let { allGrammarRules, grammarRules, onOpenModal }: Props = $props();

	let grammarSortOrder = $state<'easiest' | 'hardest'>('easiest');
	let grammarView = $state<'web' | 'list'>('web');

	onMount(() => {
		if (window.innerWidth < 640) grammarView = 'list';
	});

	// Topologically sort grammar rules to ensure prerequisites come first
	let sortedRules = $derived(
		(() => {
			const rules = allGrammarRules || [];
			const sorted: any[] = [];
			const visited = new Set<string>();
			const visiting = new Set<string>();

			function visit(rule: any) {
				if (visited.has(rule.id)) return;
				if (visiting.has(rule.id)) return;
				visiting.add(rule.id);

				for (const dep of rule.dependencies || []) {
					const depRule = rules.find((r: any) => r.id === dep.id);
					if (depRule) {
						visit(depRule);
					}
				}

				visiting.delete(rule.id);
				visited.add(rule.id);
				sorted.push(rule);
			}

			for (const rule of rules) {
				visit(rule);
			}

			if (grammarSortOrder === 'hardest') {
				return sorted.reverse();
			}

			return sorted;
		})()
	);

	// Merge user progress with all possible rules for the grammar web
	let grammarWebNodes = $derived(
		sortedRules.map((rule: any) => {
			const userProgress = grammarRules.find((ur: any) => ur.grammarRuleId === rule.id);
			const prereqsMet =
				(rule.dependencies || []).length === 0 ||
				(rule.dependencies || []).every((dep: any) => {
					const depProgress = grammarRules.find((ur: any) => ur.grammarRuleId === dep.id);
					return depProgress?.srsState === 'MASTERED';
				});
			return {
				...userProgress,
				grammarRule: rule,
				srsState: userProgress?.srsState || (prereqsMet ? 'UNSEEN' : 'LOCKED'),
				eloRating: userProgress?.eloRating || 1000,
				isLocked: !prereqsMet
			};
		})
	);

	function computeEloPercent(rule: any): number {
		if (rule.isLocked) return 0;
		return Math.max(
			0,
			Math.min(
				100,
				rule.srsState === 'LEARNING'
					? ((rule.eloRating - 1000) / 50) * 100
					: rule.srsState === 'KNOWN'
						? ((rule.eloRating - 1050) / 100) * 100
						: rule.srsState === 'MASTERED'
							? 100
							: 0
			)
		);
	}

	function handleOpenModal(rule: any) {
		const srsColor = srsColors[rule.srsState] || srsColors.LOCKED;
		const eloPercent = computeEloPercent(rule);
		onOpenModal(rule, srsColor, eloPercent);
	}
</script>

<section class="grammar-section">
	<div class="grammar-header-row">
		<h2>Grammar Web</h2>
		<div class="grammar-header-controls">
			<div class="sort-control">
				<label for="grammar-sort">Sort by:</label>
				<select id="grammar-sort" bind:value={grammarSortOrder}>
					<option value="easiest">Easiest to Hardest</option>
					<option value="hardest">Hardest to Easiest</option>
				</select>
			</div>
			<!-- View toggle -->
			<div class="view-toggle" role="group" aria-label="Grammar view mode">
				<button
					class="view-toggle-btn"
					class:active={grammarView === 'web'}
					onclick={() => (grammarView = 'web')}
					aria-pressed={grammarView === 'web'}
					title="Web view"
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
						width="16"
						height="16"
					>
						<circle cx="12" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle
							cx="19"
							cy="19"
							r="2"
						/>
						<line x1="12" y1="7" x2="5" y2="17" /><line x1="12" y1="7" x2="19" y2="17" />
					</svg>
				</button>
				<button
					class="view-toggle-btn"
					class:active={grammarView === 'list'}
					onclick={() => (grammarView = 'list')}
					aria-pressed={grammarView === 'list'}
					title="List view"
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
						width="16"
						height="16"
					>
						<line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line
							x1="8"
							y1="18"
							x2="21"
							y2="18"
						/>
						<line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line
							x1="3"
							y1="18"
							x2="3.01"
							y2="18"
						/>
					</svg>
				</button>
			</div>
		</div>
	</div>
	{#if grammarWebNodes.length === 0}
		<p class="empty-state">No grammar rules available for this language.</p>
	{:else if grammarView === 'list'}
		<!-- List view fallback -->
		<div class="grammar-list">
			{#each grammarWebNodes as rule}
				{@const srsColor = srsColors[rule.srsState] || srsColors.LOCKED}
				<button
					class="grammar-list-row"
					class:locked={rule.isLocked}
					onclick={() => handleOpenModal(rule)}
					aria-label="View grammar rule: {rule.grammarRule.title}"
				>
					<div class="grammar-list-dot" style="background-color: {srsColor}"></div>
					<div class="grammar-list-info">
						<span class="grammar-list-title">{rule.grammarRule.title}</span>
						{#if rule.grammarRule.level}
							<span class="grammar-list-level">{rule.grammarRule.level}</span>
						{/if}
					</div>
					<span class="grammar-list-state" style="color: {srsColor}">{rule.srsState}</span>
					<svg
						class="grammar-list-chevron"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						aria-hidden="true"
						width="14"
						height="14"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 18l6-6-6-6" />
					</svg>
				</button>
			{/each}
		</div>
	{:else}
		<div class="grammar-web-container">
			<div class="grammar-web-scroll-content">
				<!-- Visual web lines drawing actual connections -->
				<svg class="web-svg-lines" width="100%" height="100%">
					{#each grammarWebNodes as _rule, i}
						{#if i < grammarWebNodes.length - 1}
							<line
								x1="50%"
								y1="{(100 / grammarWebNodes.length) * i + 100 / grammarWebNodes.length / 2}%"
								x2="50%"
								y2="{(100 / grammarWebNodes.length) * (i + 1) + 100 / grammarWebNodes.length / 2}%"
								class="web-connection-line"
							/>
						{/if}
					{/each}
				</svg>

				<div class="web-tree-layout">
					{#each grammarWebNodes as rule}
						{@const srsColor = srsColors[rule.srsState] || srsColors.LOCKED}
						{@const eloPercent = computeEloPercent(rule)}

						<button
							class="web-node-pill"
							class:locked={rule.isLocked}
							style="--node-color: {srsColor}"
							onclick={() => handleOpenModal(rule)}
							onkeydown={(e) => e.key === 'Enter' && handleOpenModal(rule)}
							aria-label="View grammar rule: {rule.grammarRule.title}"
						>
							<div class="node-pill-content tooltip-trigger">
								<div class="node-icon" style="background-color: {srsColor}">
									<span class="sr-only">{rule.srsState}</span>
								</div>
								<span class="node-title">{rule.grammarRule.title}</span>

								<div class="tooltip-content">
									<div class="tooltip-header">
										{rule.grammarRule.title}
									</div>
									<div class="tooltip-body">
										<div class="word-tooltip-elo">
											<div class="elo-header">
												<span>Status: {rule.srsState}</span>
												{#if !rule.isLocked}
													<span class="elo-score">ELO {Math.ceil(rule.eloRating)}</span>
												{/if}
											</div>
											{#if !rule.isLocked}
												<div class="elo-progress-track">
													<div
														class="elo-progress-fill {rule.srsState.toLowerCase()}"
														style="width: {eloPercent}%; background-color: {srsColor}"
													></div>
												</div>
											{/if}
										</div>
										<p class="node-desc">
											{rule.grammarRule.description || 'No description available.'}
										</p>
									</div>
								</div>
							</div>
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</section>

<style>
	h2 {
		font-size: 1.75rem;
		color: var(--text-color, #0f172a);
		margin-bottom: 1.5rem;
		font-weight: 800;
		letter-spacing: -0.025em;
		position: relative;
		display: inline-block;
	}

	.grammar-header-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.grammar-header-row h2 {
		margin-bottom: 0;
	}

	.grammar-header-controls {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.view-toggle {
		display: flex;
		border: 2px solid #334155;
		border-radius: 0.6rem;
		overflow: hidden;
	}

	.view-toggle-btn {
		background: none;
		border: none;
		padding: 0.35rem 0.6rem;
		cursor: pointer;
		color: #64748b;
		display: flex;
		align-items: center;
		transition:
			background 0.15s,
			color 0.15s;
		line-height: 0;
	}

	.view-toggle-btn:first-child {
		border-right: 1px solid #334155;
	}

	.view-toggle-btn.active {
		background: #334155;
		color: #f1f5f9;
	}

	.view-toggle-btn:hover:not(.active) {
		background: #1e293b;
		color: #94a3b8;
	}

	/* Grammar list view */
	.grammar-list {
		background: #1e293b;
		border: 2px solid #334155;
		border-radius: 1rem;
		overflow: hidden;
	}

	.grammar-list-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.85rem 1rem;
		background: none;
		border: none;
		border-bottom: 1px solid #334155;
		cursor: pointer;
		text-align: left;
		transition: background 0.15s;
		font-family: inherit;
	}

	.grammar-list-row:last-child {
		border-bottom: none;
	}

	.grammar-list-row:hover {
		background: rgba(255, 255, 255, 0.04);
	}

	.grammar-list-row.locked {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.grammar-list-dot {
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.grammar-list-info {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.grammar-list-title {
		font-size: 0.9rem;
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: #e2e8f0;
	}

	.grammar-list-level {
		font-size: 0.65rem;
		font-weight: 800;
		background: #334155;
		color: #94a3b8;
		padding: 0.15rem 0.45rem;
		border-radius: 0.35rem;
		flex-shrink: 0;
	}

	.grammar-list-state {
		font-size: 0.65rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		flex-shrink: 0;
	}

	.grammar-list-chevron {
		flex-shrink: 0;
		color: #475569;
	}

	.sort-control {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
	}

	.sort-control select {
		padding: 0.25rem 0.5rem;
		border-radius: 0.375rem;
		border: 1px solid #cbd5e1;
		background-color: #ffffff;
		font-size: 0.9rem;
		cursor: pointer;
	}

	:global(html[data-theme='dark']) .sort-control select {
		background-color: #1e293b;
		border-color: #475569;
		color: #f1f5f9;
	}

	.grammar-web-container {
		position: relative;
		background: var(--card-bg, #ffffff);
		border-radius: 1rem;
		height: 500px;
		box-shadow:
			0 10px 15px -3px rgba(0, 0, 0, 0.05),
			0 4px 6px -4px rgba(0, 0, 0, 0.05);
		border: 1px solid rgba(0, 0, 0, 0.05);
		overflow-y: auto;
		overflow-x: hidden;
		display: block;
	}

	.grammar-web-scroll-content {
		position: relative;
		padding: 2rem;
		min-height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
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

	:global(html[data-theme='dark']) .web-connection-line {
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
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 0 10px var(--node-color) 40;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		cursor: pointer;
	}

	:global(html[data-theme='dark']) .web-node-pill {
		background: #1e293b;
	}

	.web-node-pill:hover {
		transform: translateY(-2px) scale(1.05);
		box-shadow:
			0 10px 15px -3px rgba(0, 0, 0, 0.1),
			0 0 15px var(--node-color) 60;
		z-index: 10;
	}

	.web-node-pill.locked {
		opacity: 0.7;
		border-style: dashed;
		background-color: #f1f5f9;
	}

	:global(html[data-theme='dark']) .web-node-pill.locked {
		background-color: #0f172a;
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
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	.node-title {
		font-weight: 600;
		font-size: 0.95rem;
		color: #334155;
	}

	:global(html[data-theme='dark']) .node-title {
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

	:global(html[data-theme='dark']) .empty-state {
		background: #1e293b;
		border-color: #475569;
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

	/* Tooltip styles */
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
		border: 1px solid rgba(255, 255, 255, 0.1);
		line-height: 1.3;
	}

	.tooltip-content::after {
		content: '';
		position: absolute;
		top: 100%;
		left: 50%;
		margin-left: -6px;
		border-width: 6px;
		border-style: solid;
		border-color: #0f172a transparent transparent transparent;
	}

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

		.grammar-header-row {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}
	}

	.tooltip-header {
		font-weight: 700;
		font-size: 0.95rem;
		margin-bottom: 0.25rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
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
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
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

	.elo-progress-track {
		display: block;
		width: 100%;
		height: 4px;
		background: #1e293b;
		border-radius: 9999px;
		overflow: hidden;
		box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
	}

	.elo-progress-fill {
		display: block;
		height: 100%;
		border-radius: 9999px;
		transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.elo-progress-fill.learning {
		background: linear-gradient(90deg, #facc15, #fef08a);
	}
	.elo-progress-fill.known {
		background: linear-gradient(90deg, #34d399, #6ee7b7);
	}
	.elo-progress-fill.mastered {
		background: linear-gradient(90deg, #10b981, #059669);
	}
</style>

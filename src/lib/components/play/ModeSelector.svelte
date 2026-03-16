<script lang="ts">
	import { fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import type { GameMode, CyclableMode, LeitnerItem } from '$lib/utils/playTypes';

	let {
		gameMode = $bindable<GameMode>('native-to-target'),
		pinnedMode = $bindable<Set<CyclableMode>>(new Set()),
		showingImmerse = $bindable(false),
		localEma,
		lessonLanguage,
		englishFlag,
		assignment,
		sessionChallenges,
		leitnerQueue = $bindable<LeitnerItem[]>([]),
		getNextCycleMode,
		generateChallenge
	}: {
		gameMode: GameMode;
		pinnedMode: Set<CyclableMode>;
		showingImmerse: boolean;
		localEma: number;
		lessonLanguage: any;
		englishFlag: string;
		assignment: any;
		sessionChallenges: number;
		leitnerQueue: LeitnerItem[];
		getNextCycleMode: () => CyclableMode;
		generateChallenge: (retryVocabIds?: string[], retryGrammarIds?: string[]) => void;
	} = $props();

	function handleGenerate() {
		if (gameMode === 'chat') {
			goto('/play/chat');
			return;
		}
		if (gameMode === 'immerse') {
			showingImmerse = true;
			return;
		}
		// Use pinned mode if set, otherwise pick adaptively
		gameMode =
			pinnedMode.size > 0
				? [...pinnedMode][Math.floor(Math.random() * pinnedMode.size)]
				: getNextCycleMode();
		const due = leitnerQueue.filter((q) => q.dueAtChallenge <= sessionChallenges);
		leitnerQueue = leitnerQueue.filter((q) => q.dueAtChallenge > sessionChallenges);
		const retryV = [...new Set(due.flatMap((q) => q.vocabIds))];
		const retryG = [...new Set(due.flatMap((q) => q.grammarIds))];
		generateChallenge(retryV, retryG);
	}
</script>

<div class="card card-duo empty-state shadow-none" in:fly={{ y: 20, duration: 400 }}>
	<h2>Ready to test your skills?</h2>

	<div class="mode-selector">
		<div class="mode-label-row">
			<span class="mode-label">Adaptive Mode</span>
			<span class="mode-ema-hint">
				{#if localEma < 0.45}
					Building confidence with easier modes
				{:else if localEma < 0.65}
					Mixing easy and medium modes
				{:else if localEma < 0.82}
					Balanced mix across all modes
				{:else}
					Favouring harder modes — you're on a roll!
				{/if}
			</span>
		</div>
		{#if assignment}
			<p class="text-blue-600 capitalize">
				{assignment.gamemode.replace(/-/g, ' ')}
				<span class="font-normal">(set by assignment)</span>
			</p>
		{:else}
			<div class="mode-buttons">
				<button
					class="mode-btn"
					class:active={pinnedMode.has('multiple-choice')}
					class:mode-favoured={pinnedMode.size === 0 &&
						gameMode !== 'chat' &&
						gameMode !== 'immerse' &&
						localEma < 0.55}
					onclick={() => {
						const s = new Set(pinnedMode);
						if (s.has('multiple-choice')) s.delete('multiple-choice');
						else s.add('multiple-choice');
						pinnedMode = s;
					}}
				>
					🔘 Multiple Choice
					<span class="mode-difficulty easy">Easiest</span>
				</button>
				<button
					class="mode-btn"
					class:active={pinnedMode.has('target-to-native')}
					class:mode-favoured={pinnedMode.size === 0 &&
						gameMode !== 'chat' &&
						gameMode !== 'immerse' &&
						localEma >= 0.4 &&
						localEma < 0.7}
					onclick={() => {
						const s = new Set(pinnedMode);
						if (s.has('target-to-native')) s.delete('target-to-native');
						else s.add('target-to-native');
						pinnedMode = s;
					}}
				>
					{lessonLanguage?.flag || '🏁'} → {englishFlag}
					{lessonLanguage?.name || 'Target'} to English
					<span class="mode-difficulty easy">Easy</span>
				</button>
				<button
					class="mode-btn"
					class:active={pinnedMode.has('fill-blank')}
					class:mode-favoured={pinnedMode.size === 0 &&
						gameMode !== 'chat' &&
						gameMode !== 'immerse' &&
						localEma >= 0.55 &&
						localEma < 0.85}
					onclick={() => {
						const s = new Set(pinnedMode);
						if (s.has('fill-blank')) s.delete('fill-blank');
						else s.add('fill-blank');
						pinnedMode = s;
					}}
				>
					✏️ Fill in the Blank
					<span class="mode-difficulty medium">Medium</span>
				</button>
				<button
					class="mode-btn"
					class:active={pinnedMode.has('native-to-target')}
					class:mode-favoured={pinnedMode.size === 0 &&
						gameMode !== 'chat' &&
						gameMode !== 'immerse' &&
						localEma >= 0.7}
					onclick={() => {
						const s = new Set(pinnedMode);
						if (s.has('native-to-target')) s.delete('native-to-target');
						else s.add('native-to-target');
						pinnedMode = s;
					}}
				>
					{englishFlag} → {lessonLanguage?.flag || '🏁'} English to {lessonLanguage?.name ||
						'Target'}
					<span class="mode-difficulty hard">Hardest</span>
				</button>
			</div>

			<div class="chat-separator">
				<span class="separator-line"></span>
				<span class="separator-text">or</span>
				<span class="separator-line"></span>
			</div>

			<button
				class="chat-cta-btn"
				class:active={gameMode === 'chat'}
				onclick={() => {
					gameMode = gameMode === 'chat' ? 'native-to-target' : 'chat';
				}}
			>
				💬 AI Chat Practice
				<span class="chat-cta-subtitle">Practice conversation with an AI tutor</span>
			</button>

			<div class="immerse-gap"></div>

			<button
				class="chat-cta-btn immerse-cta-btn"
				class:active={gameMode === 'immerse'}
				onclick={() => {
					gameMode = gameMode === 'immerse' ? 'native-to-target' : 'immerse';
				}}
			>
				✈️ World Immersion
				<span class="chat-cta-subtitle"
					>Travel the world through authentic content — menus, news, letters & more</span
				>
			</button>
		{/if}
	</div>
	<button onclick={handleGenerate} class="btn-duo btn-ai" style="margin-top: 1.5rem; width: 100%;">
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			style="width:1.25rem;height:1.25rem;flex-shrink:0;margin-right:0.5rem;"
			><path
				d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
			/></svg
		>
		{gameMode === 'chat'
			? 'Start Chat Session'
			: gameMode === 'immerse'
				? 'Start Immersive Reading'
				: 'Generate Next Challenge'}
	</button>
</div>

<style>
	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		background: #f8fafc;
		border: 2px solid var(--card-border, #e2e8f0);
		border-radius: 12px;
	}

	:global(html[data-theme='dark']) .empty-state {
		background: #1e293b;
	}

	.empty-state h2 {
		margin-top: 0;
		margin-bottom: 1.5rem;
		color: #1e293b;
		font-size: 1.5rem;
	}

	:global(html[data-theme='dark']) .empty-state h2 {
		color: #f1f5f9;
	}

	.mode-selector {
		margin-bottom: 1.5rem;
	}

	.mode-label-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
		flex-wrap: wrap;
	}

	.mode-label {
		font-size: 0.875rem;
		font-weight: 600;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		flex-shrink: 0;
	}

	.mode-ema-hint {
		font-size: 0.78rem;
		color: #94a3b8;
		font-style: italic;
	}

	:global(html[data-theme='dark']) .mode-ema-hint {
		color: #64748b;
	}

	.mode-favoured {
		border-color: #1cb0f6;
		border-width: 2px;
		box-shadow: 0 3px 0 #1899d6;
	}

	:global(html[data-theme='dark']) .mode-favoured {
		border-color: #38bdf8;
		box-shadow: 0 3px 0 #0369a1;
	}

	.mode-btn.mode-favoured {
		position: relative;
	}
	.mode-btn.mode-favoured::after {
		content: '✨ AI recommended';
		position: absolute;
		bottom: calc(100% + 8px);
		left: 50%;
		transform: translateX(-50%);
		background: #0ea5e9;
		color: #fff;
		font-size: 0.7rem;
		font-weight: 600;
		padding: 0.2rem 0.55rem;
		border-radius: 0.5rem;
		white-space: nowrap;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.15s ease;
		z-index: 10;
	}
	.mode-btn.mode-favoured:hover::after {
		opacity: 1;
	}
	:global(html[data-theme='dark']) .mode-btn.mode-favoured::after {
		background: #38bdf8;
		color: #0f172a;
	}

	.mode-buttons {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
		flex-wrap: wrap;
		overflow: visible;
	}

	.mode-btn {
		padding: 0.75rem 1.25rem;
		border-radius: 1rem;
		border: 2px solid var(--card-border, #e2e8f0);
		background: var(--card-bg, #ffffff);
		color: var(--text-color, #475569);
		font-size: 0.95rem;
		font-family: inherit;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
		box-shadow: 0 4px 0 var(--card-border, #e2e8f0);
	}

	.mode-btn:hover {
		border-color: #93c5fd;
		background: #eff6ff;
		transform: translateY(-2px);
		box-shadow: 0 6px 0 #93c5fd;
	}

	:global(html[data-theme='dark']) .mode-btn:hover {
		border-color: #3b82f6;
		background: #1e293b;
		box-shadow: 0 6px 0 #1e3a5f;
	}

	.mode-btn.active {
		border-color: #1cb0f6;
		background: #ddf4ff;
		color: #1cb0f6;
		transform: translateY(2px);
		box-shadow: 0 2px 0 #1899d6;
	}

	:global(html[data-theme='dark']) .mode-btn.active {
		border-color: #38bdf8;
		background: #0c2340;
		color: #38bdf8;
		box-shadow: 0 2px 0 #0e4166;
	}

	.mode-difficulty {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.1rem 0.5rem;
		border-radius: 9999px;
	}

	.mode-difficulty.easy {
		background-color: #dcfce7;
		color: #166534;
	}

	.mode-difficulty.medium {
		background-color: #fef9c3;
		color: #854d0e;
	}

	.mode-difficulty.hard {
		background-color: #fee2e2;
		color: #991b1b;
	}

	:global(html[data-theme='dark']) .mode-difficulty.easy {
		background-color: rgba(22, 101, 52, 0.3);
		color: #86efac;
	}

	:global(html[data-theme='dark']) .mode-difficulty.medium {
		background-color: rgba(133, 77, 14, 0.3);
		color: #fde68a;
	}

	:global(html[data-theme='dark']) .mode-difficulty.hard {
		background-color: rgba(153, 27, 27, 0.3);
		color: #fca5a5;
	}

	.chat-separator {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 1.25rem 0;
		color: #94a3b8;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.separator-line {
		flex: 1;
		height: 1px;
		background: #e2e8f0;
	}

	.chat-cta-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		width: 100%;
		padding: 1rem 1.25rem;
		border-radius: 1rem;
		border: 2px dashed #cbd5e1;
		background: #f8fafc;
		color: #475569;
		font-size: 0.95rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.chat-cta-btn:hover {
		border-color: #c4b5fd;
		background: #f5f3ff;
		transform: translateY(-2px);
	}

	:global(html[data-theme='dark']) .chat-cta-btn {
		background: #0f172a;
		border-color: #334155;
		color: #cbd5e1;
	}

	:global(html[data-theme='dark']) .chat-cta-btn:hover {
		border-color: #7c3aed;
		background: #1e1533;
	}

	.chat-cta-btn.active {
		border-color: #8b5cf6;
		border-style: solid;
		background: #f5f3ff;
		color: #8b5cf6;
	}

	.immerse-gap {
		height: 0.75rem;
	}

	.immerse-cta-btn {
		border-color: #6ee7b7;
		background: #f0fdf4;
		color: #065f46;
	}

	.immerse-cta-btn:hover {
		border-color: #10b981;
		background: #d1fae5;
		transform: translateY(-2px);
	}

	.chat-cta-btn.immerse-cta-btn.active {
		border-color: #059669;
		border-style: solid;
		background: #d1fae5;
		color: #065f46;
		box-shadow: 0 3px 0 #059669;
	}

	:global(html[data-theme='dark']) .immerse-cta-btn {
		background: #022c22;
		border-color: #065f46;
		color: #6ee7b7;
	}

	:global(html[data-theme='dark']) .immerse-cta-btn:hover {
		border-color: #10b981;
		background: #064e3b;
	}

	:global(html[data-theme='dark']) .chat-cta-btn.immerse-cta-btn.active {
		border-color: #10b981;
		background: #064e3b;
		color: #6ee7b7;
		box-shadow: 0 3px 0 #059669;
	}

	:global(html[data-theme='dark']) .chat-cta-btn.active {
		border-color: #a78bfa;
		background: #2e1065;
		color: #a78bfa;
	}

	.chat-cta-subtitle {
		font-size: 0.8rem;
		font-weight: 400;
		color: #94a3b8;
	}

	@media (max-width: 768px) {
		.mode-buttons {
			flex-direction: row;
			flex-wrap: nowrap;
			overflow-x: auto;
			justify-content: flex-start;
			padding-bottom: 0.375rem;
			-webkit-overflow-scrolling: touch;
			scrollbar-width: none;
		}

		.mode-buttons::-webkit-scrollbar {
			display: none;
		}

		.mode-btn {
			flex-shrink: 0;
			white-space: nowrap;
			font-size: 0.875rem;
			padding: 0.625rem 1rem;
		}
	}
</style>

<script lang="ts">
	import { slide } from 'svelte/transition';

	import { charSets } from '$lib/utils/keyboard';

	export let value: string = '';
	export let inputElement: HTMLInputElement | HTMLTextAreaElement | null = null;
	export let language: string = 'en';

	let isExpanded = false;
	let isShift = false;

	$: normalizedLang = language?.toLowerCase() || 'en';
	$: activeChars =
		charSets[normalizedLang]
			? charSets[normalizedLang]
			: Array.from(new Set([...charSets.fr, ...charSets.es, ...charSets.de]));

	$: displayChars = isShift ? activeChars.map((c) => c.toUpperCase()) : activeChars;

	function insertChar(char: string) {
		if (!inputElement) {
			value += char;
			return;
		}

		const start = inputElement.selectionStart || 0;
		const end = inputElement.selectionEnd || 0;

		value = value.substring(0, start) + char + value.substring(end);

		// Restore cursor position after Svelte updates the DOM
		requestAnimationFrame(() => {
			if (inputElement) {
				inputElement.focus();
				inputElement.setSelectionRange(start + char.length, start + char.length);
			}
		});
	}

	function toggleShift() {
		isShift = !isShift;
	}

	function toggleKeyboard() {
		isExpanded = !isExpanded;
	}
</script>

<div class="special-char-container">
	<button
		type="button"
		class="toggle-button"
		on:click={toggleKeyboard}
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="chevron {isExpanded ? 'expanded' : ''}"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
		Special Characters
	</button>

	{#if isExpanded}
		<div transition:slide class="keyboard-panel-wrapper">
			<div class="keyboard-panel">
				<button
					type="button"
					class="shift-button {isShift ? 'active' : ''}"
					on:click={toggleShift}
				>
					Shift
				</button>
				<div class="char-keys">
					{#each displayChars as char}
						<button
							type="button"
							class="char-key"
							on:click={() => insertChar(char)}
						>
							{char}
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.special-char-container {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin: 0.5rem 0;
	}

	.toggle-button {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		align-self: flex-start;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-gray-500, #6b7280);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		transition: color 0.2s;
	}

	.toggle-button:hover,
	.toggle-button:focus-visible {
		color: var(--color-gray-700, #374151);
		outline: none;
	}

	.chevron {
		height: 1rem;
		width: 1rem;
		transition: transform 0.2s;
	}

	.chevron.expanded {
		transform: rotate(180deg);
	}

	.keyboard-panel-wrapper {
		overflow: hidden; /* For smooth slide transition */
	}

	.keyboard-panel {
		display: flex;
		flex-wrap: nowrap;
		gap: 0.5rem;
		background-color: var(--color-gray-50, #f9fafb);
		padding: 0.5rem;
		border-radius: 0.375rem;
		border: 1px solid var(--color-gray-200, #e5e7eb);
		overflow-x: auto;
		align-items: center;
		/* Custom scrollbar for better look */
		scrollbar-width: thin;
		scrollbar-color: var(--color-gray-300, #d1d5db) transparent;
	}

	.keyboard-panel::-webkit-scrollbar {
		height: 6px;
	}

	.keyboard-panel::-webkit-scrollbar-track {
		background: transparent;
	}

	.keyboard-panel::-webkit-scrollbar-thumb {
		background-color: var(--color-gray-300, #d1d5db);
		border-radius: 10px;
	}

	.shift-button {
		flex-shrink: 0;
		padding: 0.25rem 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		background-color: var(--color-gray-200, #e5e7eb);
		color: var(--color-gray-800, #1f2937);
		border: 1px solid var(--color-gray-300, #d1d5db);
		border-radius: 0.25rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.shift-button:hover {
		background-color: var(--color-gray-300, #d1d5db);
	}

	.shift-button:active {
		transform: scale(0.95);
	}

	.shift-button.active {
		background-color: var(--color-gray-500, #6b7280);
		color: white;
		border-color: var(--color-gray-600, #4b5563);
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.char-keys {
		display: flex;
		gap: 0.25rem;
		flex-wrap: nowrap;
	}

	.char-key {
		flex-shrink: 0;
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.875rem;
		background-color: white;
		color: var(--color-gray-800, #1f2937);
		border: 1px solid var(--color-gray-300, #d1d5db);
		border-radius: 0.25rem;
		cursor: pointer;
		transition: all 0.15s ease;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	.char-key:hover {
		background-color: var(--color-gray-100, #f3f4f6);
		border-color: var(--color-gray-400, #9ca3af);
	}

	.char-key:active {
		background-color: var(--color-gray-200, #e5e7eb);
		transform: scale(0.95);
		box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.char-key:focus-visible,
	.shift-button:focus-visible {
		outline: 2px solid var(--color-blue-500, #3b82f6);
		outline-offset: 1px;
	}
</style>

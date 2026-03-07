<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { toast } from '$lib/toast';

	let sessionStarted = false;
	let sessionId = '';
	let persona = 'A friendly waiter at a café';
	let language = 'German';
	let message = '';
	let isLoading = false;

	interface ChatMessage {
		id: string;
		role: string;
		content: string;
		correction?: string | null;
	}

	let messages: ChatMessage[] = [];

	async function startSession() {
		if (!persona.trim() || !language.trim()) {
			toast.error('Please enter a persona and language.');
			return;
		}
		sessionStarted = true;
		messages = [];
		// Add an initial empty state or we can just let the user send the first message.
	}

	async function sendMessage() {
		if (!message.trim() || isLoading) return;

		const userMessageText = message;
		message = '';
		
		const tempUserMessage: ChatMessage = {
			id: Date.now().toString(),
			role: 'user',
			content: userMessageText
		};
		messages = [...messages, tempUserMessage];
		isLoading = true;

		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId: sessionId || undefined,
					message: userMessageText,
					persona,
					language
				})
			});

			if (!res.ok) {
				const errorData = await res.json();
				throw new Error(errorData.error || 'Failed to send message');
			}

			const data = await res.json();
			if (!sessionId) {
				sessionId = data.sessionId;
			}
			
			messages = [...messages, data.message];
		} catch (error: any) {
			console.error(error);
			toast.error(error.message || 'An error occurred.');
			// Remove the optimistic message if it failed
			messages = messages.filter(m => m.id !== tempUserMessage.id);
		} finally {
			isLoading = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}
</script>

<div class="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
	<div class="flex items-center justify-between mb-8">
		<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Conversational Practice</h1>
	</div>

	{#if !sessionStarted}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
			<h2 class="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Start a new roleplay</h2>
			<div class="space-y-4">
				<div>
					<label for="language" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Language</label>
					<input
						type="text"
						id="language"
						bind:value={language}
						class="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
						placeholder="e.g. German, French, Spanish"
					/>
				</div>
				<div>
					<label for="persona" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Persona / Scenario</label>
					<input
						type="text"
						id="persona"
						bind:value={persona}
						class="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
						placeholder="e.g. A friendly waiter at a café"
					/>
				</div>
				<button
					on:click={startSession}
					class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
				>
					Start Conversation
				</button>
			</div>
		</div>
	{:else}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col h-[600px]">
			<div class="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 rounded-t-lg">
				<div>
					<span class="font-medium text-gray-900 dark:text-white">{persona}</span>
					<span class="text-sm text-gray-500 dark:text-gray-400 ml-2">({language})</span>
				</div>
				<button
					on:click={() => { sessionStarted = false; sessionId = ''; }}
					class="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
				>
					End Session
				</button>
			</div>
			
			<div class="flex-1 overflow-y-auto p-4 space-y-4">
				{#if messages.length === 0}
					<div class="text-center text-gray-500 dark:text-gray-400 mt-10">
						Start the conversation! Introduce yourself or say hello.
					</div>
				{/if}
				{#each messages as msg}
					<div class="flex flex-col {msg.role === 'user' ? 'items-end' : 'items-start'}">
						<div class="max-w-[80%] rounded-lg px-4 py-2 {msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'}">
							<p class="whitespace-pre-wrap">{msg.content}</p>
						</div>
						{#if msg.correction}
							<div class="mt-1 max-w-[80%] text-sm bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded px-3 py-2">
								<span class="font-medium">Correction:</span> {msg.correction}
							</div>
						{/if}
					</div>
				{/each}
				{#if isLoading}
					<div class="flex justify-start">
						<div class="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2 text-gray-500 dark:text-gray-400">
							<span class="animate-pulse">Typing...</span>
						</div>
					</div>
				{/if}
			</div>

			<div class="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-lg">
				<div class="flex space-x-2">
					<textarea
						bind:value={message}
						on:keydown={handleKeydown}
						placeholder="Type your message..."
						class="flex-1 resize-none rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[44px] max-h-32"
						rows="1"
						disabled={isLoading}
					></textarea>
					<button
						on:click={sendMessage}
						disabled={isLoading || !message.trim()}
						class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Send
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

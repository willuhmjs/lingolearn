<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { addToast } from '$lib/toast';

	export let data: PageData;

	let creating = false;

	async function createRemediationAssignment(limit: number) {
		creating = true;
		
		try {
			// Get the top N words
			const targetWords = data.strugglingWords.slice(0, limit);
			const vocabularyIds = targetWords.map(w => w.vocabularyId);
			const lemmas = targetWords.map(w => w.lemma);
			
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

<div class="container mx-auto px-4 py-8">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<a
				href="/classes/{$page.params.id}"
				class="text-sm text-blue-400 hover:text-blue-300 mb-2 inline-block"
			>
				&larr; Back to Class
			</a>
			<h1 class="text-3xl font-bold text-white">{data.classData.name} - Analytics</h1>
			<p class="text-gray-400 mt-1">Struggling Concepts Dashboard</p>
		</div>
	</div>

	<div class="bg-gray-800 rounded-lg shadow-xl overflow-hidden mb-8 border border-gray-700">
		<div class="p-6 border-b border-gray-700 flex justify-between items-center">
			<div>
				<h2 class="text-xl font-semibold text-white">Struggling Words</h2>
				<p class="text-sm text-gray-400 mt-1">
					Words with the lowest average ease factor and highest struggle rate across all students.
				</p>
			</div>
			
			<div class="flex gap-2">
				<div class="dropdown dropdown-end">
					<div tabindex="0" role="button" class="btn btn-primary" class:loading={creating}>
						Create Remediation Assignment
					</div>
					<ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-gray-700 rounded-box w-52 mt-1">
						<li><button on:click={() => createRemediationAssignment(10)}>Top 10 Words</button></li>
						<li><button on:click={() => createRemediationAssignment(20)}>Top 20 Words</button></li>
						<li><button on:click={() => createRemediationAssignment(50)}>Top 50 Words</button></li>
					</ul>
				</div>
			</div>
		</div>

		<div class="overflow-x-auto">
			<table class="w-full text-left text-gray-300">
				<thead class="bg-gray-900/50 text-gray-400 text-sm uppercase">
					<tr>
						<th class="px-6 py-4 font-medium">Word</th>
						<th class="px-6 py-4 font-medium">Meaning</th>
						<th class="px-6 py-4 font-medium text-center">Students Seen</th>
						<th class="px-6 py-4 font-medium text-center">Avg Ease Factor</th>
						<th class="px-6 py-4 font-medium text-center">Struggle Rate</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-700">
					{#if data.strugglingWords.length === 0}
						<tr>
							<td colspan="5" class="px-6 py-8 text-center text-gray-400">
								No data available. Students need to start learning vocabulary first.
							</td>
						</tr>
					{:else}
						{#each data.strugglingWords as word}
							<tr class="hover:bg-gray-700/50 transition-colors">
								<td class="px-6 py-4 font-medium text-white">{word.lemma}</td>
								<td class="px-6 py-4">{word.meaning || '-'}</td>
								<td class="px-6 py-4 text-center">{word.totalStudentsLearned}</td>
								<td class="px-6 py-4 text-center">
									<div class="flex items-center justify-center gap-2">
										<span class="font-mono">{word.averageEaseFactor.toFixed(2)}</span>
										{#if word.averageEaseFactor < 2.0}
											<div class="w-2 h-2 rounded-full bg-red-500" title="Very Difficult"></div>
										{:else if word.averageEaseFactor < 2.5}
											<div class="w-2 h-2 rounded-full bg-orange-500" title="Difficult"></div>
										{:else}
											<div class="w-2 h-2 rounded-full bg-green-500" title="Okay"></div>
										{/if}
									</div>
								</td>
								<td class="px-6 py-4 text-center">
									<div class="flex items-center justify-center gap-2">
										<span class="font-mono">{word.strugglePercentage.toFixed(0)}%</span>
										<div class="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
											<div 
												class="h-full {word.strugglePercentage > 50 ? 'bg-red-500' : 'bg-orange-500'}" 
												style="width: {word.strugglePercentage}%"
											></div>
										</div>
									</div>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>

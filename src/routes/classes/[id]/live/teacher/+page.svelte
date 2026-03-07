<script lang="ts">
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import { toast } from '$lib/toast';
	
	let session: any = null;
	let interval: any;
	let loading = true;
	let status = 'waiting';
	let currentQuestion = '';

	const classId = $page.params.id;

	async function fetchSession() {
		try {
			const res = await fetch(`/api/classes/${classId}/live-session`);
			const data = await res.json();
			session = data.session;
			loading = false;
			
			if (session) {
				status = session.status;
				currentQuestion = session.currentQuestion || '';
			}
		} catch (error) {
			console.error(error);
		}
	}

	async function updateSession(action: string, updates: any = {}) {
		try {
			const res = await fetch(`/api/classes/${classId}/live-session`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action, ...updates })
			});
			if (!res.ok) throw new Error('Failed to update session');
			fetchSession();
		} catch (error: any) {
			toast.error(error.message);
		}
	}

	onMount(() => {
		fetchSession();
		interval = setInterval(fetchSession, 2000); // Polling every 2s
	});

	onDestroy(() => {
		if (interval) clearInterval(interval);
	});
</script>

<div class="container mx-auto p-4 max-w-4xl">
	<h1 class="text-3xl font-bold mb-6 text-primary">Classroom Battle Control</h1>

	{#if loading}
		<p>Loading...</p>
	{:else if !session || session.status === 'finished'}
		<div class="bg-card text-card-foreground p-6 rounded-lg shadow-md border text-center">
			<h2 class="text-xl font-semibold mb-4">No Active Session</h2>
			<button class="btn btn-primary" on:click={() => updateSession('start')}>
				Start Live Session
			</button>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			<div class="bg-card text-card-foreground p-6 rounded-lg shadow-md border">
				<h2 class="text-2xl font-semibold mb-4">Session Controls</h2>
				
				<div class="mb-4">
					<p class="font-medium text-lg mb-2">Status: <span class="capitalize text-primary">{session.status}</span></p>
					
					<div class="flex gap-2 mb-4">
						{#if session.status === 'waiting'}
							<button class="btn btn-primary" on:click={() => updateSession('update', { status: 'active', currentQuestion: 'Question 1: What is "Apple" in German?' })}>
								Start Quiz
							</button>
						{/if}
						<button class="btn btn-destructive" on:click={() => updateSession('end')}>
							End Session
						</button>
					</div>
				</div>

				{#if session.status === 'active'}
					<div class="space-y-4">
						<div class="form-control">
							<label class="label">Current Question</label>
							<textarea class="textarea textarea-bordered w-full" bind:value={currentQuestion}></textarea>
						</div>
						<button class="btn btn-secondary" on:click={() => updateSession('update', { currentQuestion })}>
							Push Question to Students
						</button>
					</div>
				{/if}
			</div>

			<div class="bg-card text-card-foreground p-6 rounded-lg shadow-md border">
				<h2 class="text-2xl font-semibold mb-4">Participants ({session.participants?.length || 0})</h2>
				
				{#if session.participants?.length > 0}
					<ul class="space-y-2">
						{#each session.participants.sort((a, b) => b.score - a.score) as p}
							<li class="flex justify-between items-center p-3 bg-muted rounded-md">
								<span class="font-medium">{p.user?.name || p.user?.username}</span>
								<div class="flex items-center gap-4">
									<span>Score: {p.score}</span>
									{#if p.hasAnswered}
										<span class="text-green-500 font-bold">Answered</span>
									{:else}
										<span class="text-yellow-500 text-sm">Waiting...</span>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-muted-foreground italic">No students have joined yet.</p>
				{/if}
			</div>
		</div>
	{/if}
</div>

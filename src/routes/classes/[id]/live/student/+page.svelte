<script lang="ts">
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import { toast } from '$lib/toast';

	let session: any = null;
	let interval: any;
	let loading = true;
	let joined = false;
	let answer = '';

	const classId = $page.params.id;

	async function fetchSession() {
		try {
			const res = await fetch(`/api/classes/${classId}/live-session`);
			const data = await res.json();
			
			if (data.session) {
				session = data.session;
				loading = false;
			} else {
				session = null;
				joined = false;
			}
		} catch (error) {
			console.error(error);
		}
	}

	async function joinSession() {
		try {
			const res = await fetch(`/api/classes/${classId}/live-session/student`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'join' })
			});
			if (!res.ok) throw new Error('Failed to join session');
			joined = true;
			fetchSession();
		} catch (error: any) {
			toast.error(error.message);
		}
	}

	async function submitAnswer(isCorrect: boolean) {
		try {
			const res = await fetch(`/api/classes/${classId}/live-session/student`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'answer', answer, isCorrect })
			});
			if (!res.ok) throw new Error('Failed to submit answer');
			
			answer = '';
			fetchSession();
			toast.success(isCorrect ? 'Correct!' : 'Incorrect!');
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

<div class="container mx-auto p-4 max-w-2xl text-center">
	<h1 class="text-4xl font-extrabold mb-8 text-primary animate-pulse">Classroom Battle</h1>

	{#if loading && !session}
		<p class="text-xl">Looking for active session...</p>
	{:else if !session || session.status === 'finished'}
		<div class="bg-card text-card-foreground p-8 rounded-xl shadow-lg border">
			<h2 class="text-2xl font-bold mb-4">No active session right now.</h2>
			<p class="text-muted-foreground">Wait for your teacher to start the battle.</p>
		</div>
	{:else if !joined}
		<div class="bg-card text-card-foreground p-8 rounded-xl shadow-lg border">
			<h2 class="text-3xl font-bold mb-6">Battle is ready!</h2>
			<button class="btn btn-primary btn-lg w-full text-xl" on:click={joinSession}>
				Join Now
			</button>
		</div>
	{:else}
		<div class="bg-card text-card-foreground p-8 rounded-xl shadow-2xl border relative overflow-hidden">
			<!-- Simple Background Animation -->
			<div class="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/10 -z-10"></div>
			
			{#if session.status === 'waiting'}
				<h2 class="text-3xl font-bold mb-4">Waiting for teacher to start...</h2>
				<p class="text-xl text-muted-foreground mb-6">Get ready!</p>
				<div class="loading loading-spinner loading-lg text-primary"></div>
			{:else if session.status === 'active'}
				
				{@const me = session.participants?.find((p: any) => p.user?.id === /* ideally auth store */ null) || session.participants?.[session.participants.length - 1]} 
				<!-- Note: properly getting the current user ID requires auth store, but for simplicity we show generic state based on whether they answered -->
				
				<!-- Assuming we check if 'hasAnswered' is set via API, the API won't let them answer twice anyway, 
				     but we can't easily filter 'me' without the user ID in Svelte unless returned. 
				     We will just show the question and rely on API rejection. -->

				<h2 class="text-3xl font-bold mb-8">{session.currentQuestion || "Get Ready!"}</h2>
				
				<div class="grid grid-cols-2 gap-4 mb-8">
					<!-- Dummy Options for Kahoot Style -->
					<button class="btn btn-error btn-lg h-32 text-2xl font-bold text-white shadow-md hover:scale-105 transition-transform" on:click={() => submitAnswer(false)}>
						A: Der Apfel
					</button>
					<button class="btn btn-info btn-lg h-32 text-2xl font-bold text-white shadow-md hover:scale-105 transition-transform" on:click={() => submitAnswer(true)}>
						B: Die Apfel
					</button>
					<button class="btn btn-warning btn-lg h-32 text-2xl font-bold text-white shadow-md hover:scale-105 transition-transform" on:click={() => submitAnswer(false)}>
						C: Das Apfel
					</button>
					<button class="btn btn-success btn-lg h-32 text-2xl font-bold text-white shadow-md hover:scale-105 transition-transform" on:click={() => submitAnswer(false)}>
						D: Den Apfel
					</button>
				</div>
				
				<p class="text-sm text-muted-foreground">Select the correct translation. Faster answers give more points! (Simulation)</p>
			{/if}
		</div>
	{/if}
</div>

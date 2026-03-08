<script lang="ts">
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import { toast } from '$lib/toast';

	export let data: any;

	let session: any = null;
	let interval: any;
	let loading = true;
	let currentUserId = '';

	const classId = $page.params.id;
	$: className = data.className;

	$: currentQuestionData = session?.game?.questions?.[session?.currentQuestionIndex || 0] || null;
	$: totalQuestions = session?.game?.questions?.length || 0;
	$: students = session?.participants || [];
	$: answeredCount = students.filter((p: any) => p.hasAnswered).length;

	async function fetchSession() {
		try {
			const res = await fetch(`/api/classes/${classId}/live-session`);
			const data = await res.json();
			
			if (data.userId) currentUserId = data.userId;

			if (data.session) {
				session = data.session;
			} else {
				session = null;
			}
		} catch (error) {
			console.error(error);
		} finally {
			loading = false;
		}
	}

	async function updateSession(updates: any) {
		try {
			const res = await fetch(`/api/classes/${classId}/live-session`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'update', ...updates })
			});
			if (!res.ok) throw new Error('Failed to update session');
			fetchSession();
		} catch (error: any) {
			toast.error(error.message);
		}
	}

	async function endSession() {
		if (!confirm('Are you sure you want to end this live session?')) return;
		try {
			const res = await fetch(`/api/classes/${classId}/live-session`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'end' })
			});
			if (!res.ok) throw new Error('Failed to end session');
			toast.success('Session ended');
			window.location.href = `/classes/${classId}`;
		} catch (error: any) {
			toast.error(error.message);
		}
	}

	function startGame() {
		updateSession({ status: 'active' });
	}

	function nextQuestion() {
		if (session.currentQuestionIndex < totalQuestions - 1) {
			updateSession({ currentQuestionIndex: session.currentQuestionIndex + 1 });
		} else {
			endSession();
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

<div class="live-container">
	<div class="header-row">
		<h1 class="battle-title pulse">Live Session: {className}</h1>
		<button class="btn-end" on:click={endSession}>End Session</button>
	</div>

	{#if loading && !session}
		<p class="status-text">Loading session for {className}...</p>
	{:else if !session || session.status === 'finished'}
		<div class="battle-card">
			<h2 class="card-title">No active session for {className}.</h2>
			<a href={`/classes/${classId}`} class="btn-primary" style="display:inline-block; margin-top:1rem; padding:0.5rem 1rem;">Back to Class</a>
		</div>
	{:else}
		<div class="battle-card">
			{#if session.status === 'waiting'}
				<h2 class="card-title">Waiting for students from {className} to join...</h2>
				<p class="card-desc">Students joined: {students.length}</p>
				
				<div class="participants-list">
					{#each students as student}
						<div class="participant-badge">
							{student.user.name || student.user.username}
						</div>
					{/each}
				</div>

				<button class="btn-primary w-full btn-large mt-large" on:click={startGame} disabled={students.length === 0}>
					Start Game
				</button>
			{:else if session.status === 'active'}
				<div class="progress-info">
					Question {session.currentQuestionIndex + 1} of {totalQuestions}
				</div>

				<h2 class="question-title">
					{currentQuestionData?.question || '...'}
				</h2>

				<div class="status-board">
					<div class="stat-box">
						<span class="stat-label">Answers Received</span>
						<span class="stat-value">{answeredCount} / {students.length}</span>
					</div>
				</div>

				<div class="participants-list">
					{#each students as student}
						<div class="participant-badge {student.hasAnswered ? 'answered' : 'waiting'}">
							{student.user.name || student.user.username}
							<span class="status-dot"></span>
						</div>
					{/each}
				</div>

				<button class="btn-primary w-full btn-large mt-large" on:click={nextQuestion}>
					{session.currentQuestionIndex < totalQuestions - 1 ? 'Next Question' : 'Finish Game'}
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.live-container {
		max-width: 48rem;
		margin: 0 auto;
		padding: 2rem 1rem;
		text-align: center;
		font-family: inherit;
	}

	.header-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
	}

	.battle-title {
		font-size: 2rem;
		font-weight: 800;
		color: #3b82f6;
		margin: 0;
	}

	.btn-end {
		background-color: #fee2e2;
		color: #ef4444;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		font-weight: bold;
		cursor: pointer;
	}

	.btn-end:hover {
		background-color: #fecaca;
	}

	.status-text {
		font-size: 1.25rem;
		color: #64748b;
	}

	.battle-card {
		background-color: #ffffff;
		padding: 2rem;
		border-radius: 1rem;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
		border: 1px solid #e2e8f0;
	}

	.card-title {
		font-size: 1.5rem;
		font-weight: 700;
		margin-top: 0;
		margin-bottom: 0.5rem;
	}

	.card-desc {
		color: #64748b;
		margin-bottom: 1.5rem;
	}

	.mt-large {
		margin-top: 2rem;
	}

	.btn-primary {
		background-color: #3b82f6;
		color: white;
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
		font-weight: 700;
		transition: transform 0.1s;
		box-shadow: 0 4px 0 #2563eb;
		text-decoration: none;
	}

	.btn-primary:hover:not(:disabled) {
		background-color: #2563eb;
		transform: translateY(-1px);
	}

	.btn-primary:active:not(:disabled) {
		transform: translateY(2px);
		box-shadow: 0 2px 0 #2563eb;
	}

	.btn-primary:disabled {
		background-color: #94a3b8;
		box-shadow: 0 4px 0 #64748b;
		cursor: not-allowed;
	}

	.btn-large {
		padding: 1rem 2rem;
		font-size: 1.25rem;
	}

	.w-full {
		width: 100%;
	}

	.participants-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		justify-content: center;
		margin-top: 1rem;
	}

	.participant-badge {
		background-color: #f1f5f9;
		color: #475569;
		padding: 0.5rem 1rem;
		border-radius: 2rem;
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.participant-badge.answered {
		background-color: #dcfce7;
		color: #16a34a;
	}

	.participant-badge.waiting {
		background-color: #fef3c7;
		color: #d97706;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background-color: currentColor;
	}

	.progress-info {
		display: inline-block;
		background-color: #f1f5f9;
		color: #475569;
		padding: 0.25rem 0.75rem;
		border-radius: 1rem;
		font-weight: bold;
		margin-bottom: 1rem;
	}

	.question-title {
		font-size: 1.875rem;
		font-weight: 700;
		margin-bottom: 2rem;
	}

	.status-board {
		display: flex;
		justify-content: center;
		margin-bottom: 2rem;
	}

	.stat-box {
		background-color: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
		padding: 1rem 2rem;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.stat-label {
		font-size: 0.875rem;
		color: #64748b;
		text-transform: uppercase;
		font-weight: 800;
		letter-spacing: 0.05em;
	}

	.stat-value {
		font-size: 2rem;
		font-weight: 800;
		color: #0f172a;
	}
</style>

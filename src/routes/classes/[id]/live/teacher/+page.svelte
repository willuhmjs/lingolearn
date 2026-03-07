<script lang="ts">
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import { toast } from '$lib/toast';
	
	let session: any = null;
	let interval: any;
	let loading = true;
	let status = 'waiting';
	let currentQuestionText = '';
	let currentOptions = [
		{ id: 'a', text: '', isCorrect: true },
		{ id: 'b', text: '', isCorrect: false },
		{ id: 'c', text: '', isCorrect: false },
		{ id: 'd', text: '', isCorrect: false },
	];

	const classId = $page.params.id;

	async function fetchSession() {
		try {
			const res = await fetch(`/api/classes/${classId}/live-session`);
			const data = await res.json();
			session = data.session;
			loading = false;
			
			if (session) {
				status = session.status;
				if (session.currentQuestion) {
					try {
						const parsed = JSON.parse(session.currentQuestion);
						currentQuestionText = parsed.text || '';
						if (parsed.options) {
							currentOptions = parsed.options;
						}
					} catch (e) {
						currentQuestionText = session.currentQuestion;
					}
				}
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

<div class="control-container">
	<h1 class="page-title">Classroom Battle Control</h1>

	{#if loading}
		<p class="status-text">Loading...</p>
	{:else if !session || session.status === 'finished'}
		<div class="control-card center-text">
			<h2 class="card-title">No Active Session</h2>
			<button class="btn-primary" on:click={() => updateSession('start')}>
				Start Live Session
			</button>
		</div>
	{:else}
		<div class="control-grid">
			<div class="control-card">
				<h2 class="card-title">Session Controls</h2>
				
				<div class="status-section">
					<p class="status-label">Status: <span class="status-value">{session.status}</span></p>
					
					<div class="action-buttons">
						{#if session.status === 'waiting'}
							<button class="btn-primary" on:click={() => updateSession('update', { status: 'active', currentQuestion: JSON.stringify({ text: 'Question 1: What is "Apple" in German?', options: [{id: 'a', text: 'Der Apfel', isCorrect: true}, {id: 'b', text: 'Die Apfel', isCorrect: false}, {id: 'c', text: 'Das Apfel', isCorrect: false}, {id: 'd', text: 'Den Apfel', isCorrect: false}] }) })}>
								Start Quiz
							</button>
						{/if}
						<button class="btn-danger" on:click={() => updateSession('end')}>
							End Session
						</button>
					</div>
				</div>

				{#if session.status === 'active'}
					<div class="question-section">
						<div class="field">
							<label for="currentQuestionText">Current Question</label>
							<textarea id="currentQuestionText" class="textarea" bind:value={currentQuestionText}></textarea>
						</div>
						
						<div class="options-config">
							{#each currentOptions as option, i}
								<div class="option-field">
									<input type="radio" name="correctOption" value={option.id} checked={option.isCorrect} on:change={() => currentOptions.forEach(o => o.isCorrect = (o.id === option.id))} />
									<input type="text" class="input" bind:value={option.text} placeholder={`Option ${option.id.toUpperCase()}`} />
								</div>
							{/each}
						</div>

						<button class="btn-secondary w-full" on:click={() => updateSession('update', { currentQuestion: JSON.stringify({ text: currentQuestionText, options: currentOptions }) })}>
							Push Question to Students
						</button>
					</div>
				{/if}
			</div>

			<div class="control-card">
				<h2 class="card-title">Participants ({session.participants?.length || 0})</h2>
				
				{#if session.participants?.length > 0}
					<ul class="participants-list">
						{#each session.participants.sort((a, b) => b.score - a.score) as p}
							<li class="participant-row">
								<span class="participant-name">{p.user?.name || p.user?.username}</span>
								<div class="participant-stats">
									<span class="score">Score: {p.score}</span>
									{#if p.hasAnswered}
										<span class="status-badge answered">Answered</span>
									{:else}
										<span class="status-badge waiting">Waiting...</span>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="empty-state">No students have joined yet.</p>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.control-container {
		max-width: 64rem;
		margin: 0 auto;
		padding: 2rem 1rem;
		font-family: inherit;
	}

	.page-title {
		font-size: 2rem;
		font-weight: 800;
		margin-bottom: 2rem;
		color: #3b82f6;
	}

	.status-text {
		font-size: 1.125rem;
		color: #64748b;
	}

	.control-card {
		background-color: #ffffff;
		padding: 1.5rem;
		border-radius: 1rem;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		border: 1px solid #e2e8f0;
	}

	.center-text {
		text-align: center;
	}

	.card-title {
		font-size: 1.5rem;
		font-weight: 700;
		margin-bottom: 1.5rem;
		margin-top: 0;
		color: #0f172a;
	}

	.control-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.5rem;
	}

	@media (min-width: 768px) {
		.control-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	.status-section {
		margin-bottom: 1.5rem;
	}

	.status-label {
		font-size: 1.125rem;
		font-weight: 600;
		margin-bottom: 1rem;
		color: #1e293b;
	}

	.status-value {
		color: #3b82f6;
		text-transform: capitalize;
		font-weight: 700;
	}

	.action-buttons {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.question-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		border-top: 1px solid #e2e8f0;
		padding-top: 1.5rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.field label {
		font-size: 0.875rem;
		font-weight: 700;
		color: #475569;
	}

	.textarea {
		width: 100%;
		min-height: 8rem;
		padding: 0.75rem;
		border: 1px solid #cbd5e1;
		border-radius: 0.5rem;
		font-family: inherit;
		font-size: 1rem;
		resize: vertical;
		box-sizing: border-box;
	}

	.textarea:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
	}

	.btn-primary, .btn-secondary, .btn-danger {
		padding: 0.75rem 1.5rem;
		font-size: 1rem;
		font-weight: 700;
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: background-color 0.2s, transform 0.1s;
		font-family: inherit;
	}

	.btn-primary {
		background-color: #3b82f6;
		color: white;
		box-shadow: 0 4px 0 #2563eb;
	}

	.btn-primary:hover {
		background-color: #2563eb;
		transform: translateY(-1px);
	}

	.btn-primary:active {
		transform: translateY(2px);
		box-shadow: 0 2px 0 #2563eb;
	}

	.btn-secondary {
		background-color: #f1f5f9;
		color: #475569;
		border: 1px solid #cbd5e1;
		box-shadow: 0 2px 0 #cbd5e1;
	}

	.btn-secondary:hover {
		background-color: #e2e8f0;
	}

	.btn-secondary:active {
		transform: translateY(2px);
		box-shadow: none;
	}

	.btn-danger {
		background-color: #ef4444;
		color: white;
		box-shadow: 0 4px 0 #dc2626;
	}

	.btn-danger:hover {
		background-color: #dc2626;
		transform: translateY(-1px);
	}

	.btn-danger:active {
		transform: translateY(2px);
		box-shadow: 0 2px 0 #dc2626;
	}

	.w-full {
		width: 100%;
		box-sizing: border-box;
	}

	.participants-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.participant-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		background-color: #f8fafc;
		border-radius: 0.5rem;
		border: 1px solid #e2e8f0;
	}

	.participant-name {
		font-weight: 600;
		color: #1e293b;
	}

	.participant-stats {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.score {
		font-weight: 700;
		color: #475569;
	}

	.status-badge {
		font-size: 0.75rem;
		font-weight: 700;
		padding: 0.25rem 0.5rem;
		border-radius: 9999px;
		text-transform: uppercase;
	}

	.answered {
		background-color: #dcfce7;
		color: #16a34a;
	}

	.waiting {
		background-color: #fef3c7;
		color: #d97706;
	}

	.empty-state {
		color: #64748b;
		font-style: italic;
		margin: 0;
	}
	.options-config {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-top: 1rem;
		margin-bottom: 1rem;
	}

	.option-field {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.input {
		flex: 1;
		padding: 0.75rem;
		border: 1px solid #cbd5e1;
		border-radius: 0.5rem;
		font-family: inherit;
		font-size: 1rem;
		box-sizing: border-box;
	}

	.input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
	}
</style>

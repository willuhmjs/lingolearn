<script lang="ts">
	import toast from 'svelte-french-toast';
	import { modal } from '$lib/modal.svelte';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();
	let game = $derived(data.game);

	// Game Details Editing State
	let isEditingDetails = $state(false);
	let editTitle = $state('');
	let editDescription = $state('');
	let isPublished = $state(false);
	let isPublishing = $state(false);

	$effect(() => {
		if (!isEditingDetails) {
			editTitle = game.title;
			editDescription = game.description || '';
			isPublished = game.isPublished;
		}
	});

	// Generating State
	let isGenerating = $state(false);
	let generateTopic = $state('');
	let generateCount = $state(5);

	// Question State
	let newQuestion = $state('');
	let newAnswer = $state('');
	let newOptions = $state(['', '', '']);
	let isAddingQuestion = $state(false);

	let editingQuestionId: string | null = $state(null);
	let editQuestionText = $state('');
	let editAnswer = $state('');
	let editOptions = $state(['', '', '']);
	
	function startEditQuestion(question: any) {
		editingQuestionId = question.id;
		editQuestionText = question.question;
		editAnswer = question.answer;
		
		const optionsArray = Array.isArray(question.options) 
			? question.options 
			: (typeof question.options === 'string' ? JSON.parse(question.options) : []);
			
		// Pad to 3 options
		editOptions = [
			optionsArray[0] || '',
			optionsArray[1] || '',
			optionsArray[2] || ''
		];
	}

	function cancelEditQuestion() {
		editingQuestionId = null;
		editQuestionText = '';
		editAnswer = '';
		editOptions = ['', '', ''];
	}

	async function saveEditQuestion() {
		if (!editingQuestionId) return;
		if (!editQuestionText || !editAnswer) {
			toast.error('Question and Answer are required');
			return;
		}
		
		const options = editOptions.filter(o => o.trim() !== '');
		
		try {
			const res = await fetch(`/api/games/${game.id}/questions/${editingQuestionId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					question: editQuestionText,
					answer: editAnswer,
					options: options
				})
			});

			if (res.ok) {
				isPublished = false;
				toast.success('Question updated! Game set to Draft status.');
				cancelEditQuestion();
				await invalidateAll();
			} else {
				toast.error('Failed to update question');
			}
		} catch (error) {
			toast.error('Error updating question');
		}
	}

	// Form Submission Functions
	async function saveGameDetails() {
		try {
			const res = await fetch(`/api/games/${game.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: editTitle,
					description: editDescription,
					isPublished: false // Always reset to draft when editing details
				})
			});
			if (res.ok) {
				isPublished = false;
				toast.success('Game details updated! Game set to Draft status.');
				isEditingDetails = false;
				await invalidateAll();
			} else {
				toast.error('Failed to update game details');
			}
		} catch (error) {
			toast.error('Error updating game');
		}
	}

	async function togglePublish() {
		if (isPublished) {
			// Unpublish
			try {
				const res = await fetch(`/api/games/${game.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ isPublished: false })
				});
				if (res.ok) {
					isPublished = false;
					toast.success('Game unpublished');
					await invalidateAll();
				} else {
					toast.error('Failed to unpublish game');
				}
			} catch (error) {
				toast.error('Error unpublishing game');
			}
		} else {
			// Publish (triggers LLM review)
			isPublishing = true;
			toast.loading('Reviewing game...', { id: 'publish' });
			try {
				const res = await fetch(`/api/games/${game.id}/publish`, {
					method: 'POST'
				});
				const data = await res.json();
				if (res.ok) {
					isPublished = true;
					toast.success('Game published successfully!', { id: 'publish' });
					await invalidateAll();
				} else {
					toast.error(data.error || 'Failed to publish game', { id: 'publish' });
				}
			} catch (error) {
				toast.error('Error publishing game', { id: 'publish' });
			} finally {
				isPublishing = false;
			}
		}
	}

	async function deleteGame() {
		if (!(await modal.confirm('Are you sure you want to delete this game? This cannot be undone.')))
			return;
		try {
			const res = await fetch(`/api/games/${game.id}`, { method: 'DELETE' });
			if (res.ok) {
				window.location.href = '/play?tab=games';
			} else {
				toast.error('Failed to delete game');
			}
		} catch (error) {
			toast.error('Error deleting game');
		}
	}

	async function generateQuestions() {
		if (!generateTopic) {
			toast.error('Please enter a topic');
			return;
		}
		isGenerating = true;
		toast.loading('Generating questions...', { id: 'gen' });

		try {
			const res = await fetch(`/api/games/${game.id}/generate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					topic: generateTopic,
					questionCount: generateCount,
					difficulty: 'beginner'
				})
			});

			if (res.ok) {
				isPublished = false; // Reset to draft when generating questions
				toast.success('Questions generated! Game set to Draft status.', { id: 'gen' });
				generateTopic = '';
				await invalidateAll();
			} else {
				toast.error('Failed to generate questions', { id: 'gen' });
			}
		} catch (error) {
			toast.error('Error generating questions', { id: 'gen' });
		} finally {
			isGenerating = false;
		}
	}

	async function addQuestion() {
		if (!newQuestion || !newAnswer) {
			toast.error('Question and Answer are required');
			return;
		}
		
		const options = newOptions.filter(o => o.trim() !== '');
		
		try {
			const res = await fetch(`/api/games/${game.id}/questions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					question: newQuestion,
					answer: newAnswer,
					options: options.length > 0 ? options : undefined
				})
			});

			if (res.ok) {
				isPublished = false; // Reset to draft when adding a question
				toast.success('Question added! Game set to Draft status.');
				newQuestion = '';
				newAnswer = '';
				newOptions = ['', '', ''];
				isAddingQuestion = false;
				await invalidateAll();
			} else {
				toast.error('Failed to add question');
			}
		} catch (error) {
			toast.error('Error adding question');
		}
	}

	async function deleteQuestion(questionId: string) {
		if (!(await modal.confirm('Delete this question?'))) return;
		try {
			const res = await fetch(`/api/games/${game.id}/questions/${questionId}`, {
				method: 'DELETE'
			});
			if (res.ok) {
				isPublished = false; // Reset to draft when deleting a question
				toast.success('Question deleted. Game set to Draft status.');
				await invalidateAll();
			} else {
				toast.error('Failed to delete question');
			}
		} catch (error) {
			toast.error('Error deleting question');
		}
	}
</script>

<div class="editor-container">
	<div class="header-section">
		<div>
			<nav class="breadcrumb">
				<a href="/play?tab=games">Games</a>
				<span class="breadcrumb-sep">/</span>
				<span class="breadcrumb-current">{game.title || 'Edit'}</span>
			</nav>
			<h1>Game Editor</h1>
		</div>
		<div class="header-actions">
			<button onclick={togglePublish} disabled={isPublishing} class="btn-toggle {isPublished ? 'published' : 'draft'} {isPublishing ? 'publishing' : ''}">
				{isPublishing ? 'Publishing...' : (isPublished ? 'Published' : 'Draft')}
			</button>
			<button onclick={deleteGame} disabled={isPublishing} class="btn-delete">
				Delete Game
			</button>
		</div>
	</div>

	<!-- Game Details Section -->
	<div class="card-duo details-card" style={isPublishing ? "opacity: 0.6; pointer-events: none;" : ""}>
		<div class="card-header-flex">
			<h2>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
				Game Details
			</h2>
			<button onclick={() => isEditingDetails = !isEditingDetails} disabled={isPublishing} class="link-btn">
				{isEditingDetails ? 'Cancel' : 'Edit'}
			</button>
		</div>

		{#if isEditingDetails}
			<div class="edit-form">
				<div class="field">
					<label for="title">Title</label>
					<input type="text" id="title" bind:value={editTitle} disabled={isPublishing} class="form-input" />
				</div>
				<div class="field">
					<label for="description">Description</label>
					<textarea id="description" bind:value={editDescription} disabled={isPublishing} rows="2" class="form-input"></textarea>
				</div>
				<button onclick={saveGameDetails} disabled={isPublishing} class="btn-primary save-btn">Save Details</button>
			</div>
		{:else}
			<div class="game-info">
				<h3>{game.title}</h3>
				<span class="language-badge">
					{game.language}
				</span>
				<p class="description-text">
					{game.description || 'No description provided.'}
				</p>
			</div>
		{/if}
	</div>

	<!-- AI Generation Section -->
	<div class="card-duo ai-card" style={isPublishing ? "opacity: 0.6; pointer-events: none;" : ""}>
		<h2>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
			Auto-Generate Questions
		</h2>
		<p class="ai-desc">
			Use AI to instantly create vocabulary or grammar questions for this game.
		</p>
		<div class="ai-form">
			<input 
				type="text" 
				bind:value={generateTopic} 
				placeholder="Topic (e.g., 'Food and drinks', 'Past tense verbs')" 
				class="form-input ai-input"
				disabled={isGenerating || isPublishing}
			/>
			<div class="ai-actions">
				<select bind:value={generateCount} disabled={isGenerating || isPublishing} class="form-input count-select">
					<option value={5}>5 Qs</option>
					<option value={10}>10 Qs</option>
					<option value={15}>15 Qs</option>
				</select>
				<button 
					onclick={generateQuestions} 
					disabled={isGenerating || !generateTopic || isPublishing}
					class="btn-ai generate-btn {isGenerating ? 'submitting' : ''}"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:1.1rem;height:1.1rem;flex-shrink:0;"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
					{isGenerating ? 'Generating...' : 'Generate'}
				</button>
			</div>
		</div>
	</div>

	<!-- Questions List -->
	<div class="questions-header">
		<h2>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
			Questions ({game.questions.length})
		</h2>
		<button onclick={() => isAddingQuestion = !isAddingQuestion} disabled={isPublishing} class="link-btn add-btn">
			{isAddingQuestion ? 'Cancel' : '+ Add Question'}
		</button>
	</div>

	{#if isAddingQuestion}
		<div class="card-duo add-question-card" style={isPublishing ? "opacity: 0.6; pointer-events: none;" : ""}>
			<h3>New Question</h3>
			<div class="edit-form">
				<div class="field">
					<label for="new-question">Question prompt <span class="required">*</span></label>
					<input id="new-question" type="text" bind:value={newQuestion} disabled={isPublishing} placeholder="e.g. Translate 'Hello'" class="form-input" />
				</div>
				<div class="field">
					<label for="new-answer">Correct Answer <span class="required">*</span></label>
					<input id="new-answer" type="text" bind:value={newAnswer} disabled={isPublishing} placeholder="e.g. Bonjour" class="form-input answer-input" />
				</div>
				<div class="field">
					<label for="new-option-1">Incorrect Options (Optional)</label>
					<div class="options-grid">
						<input id="new-option-1" type="text" bind:value={newOptions[0]} disabled={isPublishing} placeholder="Distractor 1" class="form-input" />
						<input type="text" bind:value={newOptions[1]} disabled={isPublishing} placeholder="Distractor 2" class="form-input" aria-label="Distractor 2" />
						<input type="text" bind:value={newOptions[2]} disabled={isPublishing} placeholder="Distractor 3" class="form-input" aria-label="Distractor 3" />
					</div>
				</div>
				<button onclick={addQuestion} disabled={isPublishing} class="btn-primary save-btn mt-2">Save Question</button>
			</div>
		</div>
	{/if}

	<div class="questions-list">
		{#if game.questions.length === 0 && !isAddingQuestion}
			<div class="empty-state">
				<p class="empty-title">No questions yet.</p>
				<p class="empty-desc">Use the AI generator above or add a manual question.</p>
			</div>
		{/if}

		{#each game.questions as question, i}
			<div class="card-duo question-card" style={isPublishing ? "opacity: 0.6; pointer-events: none;" : ""}>
				{#if editingQuestionId === question.id}
					<div class="edit-form" style="width: 100%;">
						<div class="field">
							<label for="edit-question">Question prompt <span class="required">*</span></label>
							<input id="edit-question" type="text" bind:value={editQuestionText} class="form-input" />
						</div>
						<div class="field">
							<label for="edit-answer">Correct Answer <span class="required">*</span></label>
							<input id="edit-answer" type="text" bind:value={editAnswer} class="form-input answer-input" />
						</div>
						<div class="field">
							<label for="edit-option-1">Incorrect Options (Optional)</label>
							<div class="options-grid">
								<input id="edit-option-1" type="text" bind:value={editOptions[0]} class="form-input" aria-label="Distractor 1" />
								<input type="text" bind:value={editOptions[1]} class="form-input" aria-label="Distractor 2" />
								<input type="text" bind:value={editOptions[2]} class="form-input" aria-label="Distractor 3" />
							</div>
						</div>
						<div class="edit-actions" style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
							<button onclick={saveEditQuestion} class="btn-primary save-btn">Save</button>
							<button onclick={cancelEditQuestion} class="btn-toggle draft">Cancel</button>
						</div>
					</div>
				{:else}
					<div class="question-actions">
						<button onclick={() => startEditQuestion(question)} class="edit-q-btn" title="Edit Question">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
						</button>
						<button onclick={() => deleteQuestion(question.id)} class="delete-q-btn" title="Delete Question">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
						</button>
					</div>
					
					<div class="q-number">
						{i + 1}
					</div>
					
					<div class="q-content">
						<h4>{question.question}</h4>
						
						<div class="q-answers-grid">
							<div class="q-answer correct">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
								<span>{question.answer}</span>
							</div>
							
							{#if question.options && Array.isArray(question.options)}
								{#each question.options as opt}
									<div class="q-answer incorrect">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
										<span>{opt}</span>
									</div>
								{/each}
							{:else if typeof question.options === 'string'}
								{#each JSON.parse(question.options) as opt}
									<div class="q-answer incorrect">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
										<span>{opt}</span>
									</div>
								{/each}
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.editor-container {
		max-width: 56rem; /* 4xl */
		margin: 0 auto;
		padding: 1rem;
	}

	@media (min-width: 768px) {
		.editor-container {
			padding: 2rem;
		}
	}

	.header-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	@media (min-width: 768px) {
		.header-section {
			flex-direction: row;
			justify-content: space-between;
			align-items: center;
		}
	}

	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin-bottom: 0.5rem;
		font-size: 0.875rem;
	}

	.breadcrumb a {
		color: #3b82f6;
		text-decoration: none;
		font-weight: 600;
	}

	.breadcrumb a:hover {
		text-decoration: underline;
	}

	.breadcrumb-sep {
		color: #9ca3af;
	}

	.breadcrumb-current {
		color: #6b7280;
	}

	:global(html[data-theme='dark']) .breadcrumb-current {
		color: #9ca3af;
	}

	.header-section h1 {
		font-size: 2rem;
		font-weight: 800;
		color: var(--text-color, #1e293b);
		margin: 0;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.btn-toggle {
		padding: 0.5rem 1rem;
		border-radius: 0.75rem;
		font-weight: bold;
		font-size: 0.875rem;
		border: none;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.btn-toggle.published {
		background-color: #dcfce7;
		color: #15803d;
	}

	.btn-toggle.draft {
		background-color: #e2e8f0;
		color: #334155;
	}

	.btn-toggle.publishing {
		background-color: #fef08a;
		color: #854d0e;
		cursor: not-allowed;
		opacity: 0.8;
	}

	.btn-delete {
		padding: 0.5rem 1rem;
		border-radius: 0.75rem;
		font-weight: bold;
		font-size: 0.875rem;
		background-color: #fee2e2;
		color: #b91c1c;
		border: none;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.btn-delete:hover {
		background-color: #fecaca;
	}

	.card-duo {
		padding: 1.5rem;
		margin-bottom: 2rem;
	}

	.card-header-flex {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1rem;
	}

	.card-header-flex h2,
	.ai-card h2,
	.questions-header h2 {
		font-size: 1.25rem;
		font-weight: bold;
		color: var(--text-color, #1e293b);
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
	}

	.card-header-flex h2 svg { color: #a855f7; width: 1.25rem; height: 1.25rem; }
	.ai-card h2 svg { color: #a855f7; width: 1.25rem; height: 1.25rem; }
	.questions-header h2 svg { color: #eab308; width: 1.5rem; height: 1.5rem; }

	.link-btn {
		color: #3b82f6;
		font-weight: bold;
		font-size: 0.875rem;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
	}

	.link-btn:hover {
		text-decoration: underline;
	}

	.edit-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-top: 1rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.field label {
		font-size: 0.875rem;
		font-weight: bold;
		color: var(--text-color, #334155);
	}

	.form-input {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		border: 2px solid var(--card-border, #cbd5e1);
		background-color: var(--input-bg, #f8fafc);
		color: var(--text-color, #1e293b);
		font-family: inherit;
		font-size: 1rem;
		font-weight: 600;
		transition: all 0.2s;
		box-sizing: border-box;
		outline: none;
	}

	.form-input:focus {
		border-color: #3b82f6;
	}

	.answer-input {
		background-color: #f0fdf4;
		border-color: #86efac;
	}

	.answer-input:focus {
		border-color: #22c55e;
	}

	.save-btn {
		padding: 0.5rem 1.5rem;
		border-radius: 0.75rem;
		align-self: flex-start;
		font-weight: bold;
	}

	.mt-2 { margin-top: 0.5rem; }

	.game-info h3 {
		font-size: 1.5rem;
		font-weight: bold;
		margin: 0 0 0.5rem;
	}

	.language-badge {
		background: #f1f5f9;
		color: #475569;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		font-weight: bold;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		display: inline-block;
	}

	.description-text {
		color: #64748b;
		font-weight: 600;
		margin: 0.75rem 0 0;
	}

	.ai-card {
		background-color: #faf5ff;
		border-color: #e9d5ff;
	}

	.ai-desc {
		font-size: 0.875rem;
		color: #475569;
		font-weight: 600;
		margin: 0 0 1rem;
	}

	.ai-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	@media (min-width: 640px) {
		.ai-form {
			flex-direction: row;
		}
	}

	.ai-input {
		flex: 1;
		padding: 0.75rem 1rem;
		border-radius: 0.75rem;
		border-color: #e9d5ff;
		background-color: white;
	}

	.ai-actions {
		display: flex;
		gap: 0.75rem;
	}

	.count-select {
		width: 6rem;
		padding: 0.75rem;
		border-radius: 0.75rem;
		border-color: #e9d5ff;
		background-color: white;
		text-align: center;
	}

	.generate-btn {
		padding: 0.75rem 1.5rem;
		border-radius: 0.75rem;
		font-weight: bold;
		white-space: nowrap;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.submitting {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.questions-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.add-question-card {
		border-style: dashed;
		border-color: #94a3b8;
	}

	.add-question-card h3 {
		font-size: 1.125rem;
		font-weight: bold;
		margin: 0 0 1rem;
	}

	.required { color: #ef4444; }

	.options-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
	}

	@media (min-width: 768px) {
		.options-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	.questions-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.empty-state {
		background-color: var(--input-bg, #f8fafc);
		border: 2px dashed var(--card-border, #cbd5e1);
		border-radius: 1rem;
		padding: 2rem;
		text-align: center;
	}

	.empty-title {
		font-weight: 600;
		color: #64748b;
		margin: 0 0 0.5rem;
	}

	.empty-desc {
		font-size: 0.875rem;
		color: #94a3b8;
		margin: 0;
	}

	.question-card {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		position: relative;
		padding: 1.25rem;
		margin-bottom: 0;
	}

	@media (min-width: 768px) {
		.question-card {
			flex-direction: row;
		}
	}

	.question-actions {
		position: absolute;
		top: 1rem;
		right: 1rem;
		display: flex;
		gap: 0.5rem;
	}

	.delete-q-btn, .edit-q-btn {
		background: none;
		border: none;
		color: #94a3b8;
		cursor: pointer;
		padding: 0;
		transition: color 0.2s;
	}

	.delete-q-btn:hover {
		color: #ef4444;
	}

	.edit-q-btn:hover {
		color: #3b82f6;
	}

	.delete-q-btn svg, .edit-q-btn svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	.q-number {
		flex-shrink: 0;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		background-color: #eff6ff;
		color: #2563eb;
		font-weight: bold;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.q-content {
		flex: 1;
		padding-right: 2rem;
	}

	.q-content h4 {
		font-weight: bold;
		font-size: 1.125rem;
		margin: 0 0 0.75rem;
	}

	.q-answers-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.5rem;
	}

	@media (min-width: 768px) {
		.q-answers-grid {
			grid-template-columns: 1fr 1fr;
		}
	}

	.q-answer {
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		border: 1px solid;
	}

	.q-answer svg {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
	}

	.q-answer.correct {
		background-color: #f0fdf4;
		border-color: #bbf7d0;
		color: #166534;
	}

	.q-answer.correct svg {
		color: #22c55e;
	}

	.q-answer.incorrect {
		background-color: #f8fafc;
		border-color: #e2e8f0;
		color: #475569;
	}

	.q-answer.incorrect svg {
		color: #94a3b8;
	}
</style>

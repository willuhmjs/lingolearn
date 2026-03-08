<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { fly } from 'svelte/transition';
	import toast from 'svelte-french-toast';
	import type { PageData } from './$types';

	export let data: PageData;

	$: classDetails = data.classDetails;
	$: currentUserRole = data.currentUserRole;
	$: currentLang = data.languages?.find((l) => l.code === createAssignmentLanguage);
	$: availableRules = currentLang ? currentLang.grammarRules : [];

	// Assignment Creation
	let showCreateAssignmentModal = false;
	let createAssignmentTitle = '';
	let createAssignmentDescription = '';
	let createAssignmentMode = 'multiple-choice';
	let createAssignmentTargetScore = 10;
	let createAssignmentPassThreshold = 50;
	let createAssignmentLanguage = data.classDetails.primaryLanguage;
	let createAssignmentTargetCefrLevel = '';
	let createAssignmentTopic = '';
	let selectedGrammarRules: string[] = [];
	let targetVocabList: string[] = [];
	let vocabInput = '';
	let grammarSearchQuery = '';
	let isCreatingAssignment = false;
	let assignmentError = '';

	function openCreateAssignmentModal() {
		showCreateAssignmentModal = true;
		createAssignmentTitle = '';
		createAssignmentDescription = '';
		createAssignmentMode = 'multiple-choice';
		createAssignmentTargetScore = 10;
		createAssignmentPassThreshold = 50;
		createAssignmentLanguage = data.classDetails.primaryLanguage;
		createAssignmentTargetCefrLevel = '';
		createAssignmentTopic = '';
		selectedGrammarRules = [];
		targetVocabList = [];
		vocabInput = '';
		grammarSearchQuery = '';
		assignmentError = '';
	}

	function closeCreateAssignmentModal() {
		showCreateAssignmentModal = false;
	}

	function handleVocabKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			const val = vocabInput.trim();
			if (val && !targetVocabList.includes(val)) {
				targetVocabList = [...targetVocabList, val];
			}
			vocabInput = '';
		}
	}

	function removeVocab(word: string) {
		targetVocabList = targetVocabList.filter((w) => w !== word);
	}

	function toggleGrammarRule(ruleId: string) {
		if (selectedGrammarRules.includes(ruleId)) {
			selectedGrammarRules = selectedGrammarRules.filter((id) => id !== ruleId);
		} else {
			selectedGrammarRules = [...selectedGrammarRules, ruleId];
		}
	}

	async function handleCreateAssignment() {
		if (!createAssignmentTitle.trim()) {
			assignmentError = 'Title is required';
			return;
		}
		isCreatingAssignment = true;
		assignmentError = '';

		try {
			const res = await fetch(`/api/classes/${classDetails.id}/assignments`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: createAssignmentTitle,
					description: createAssignmentDescription || undefined,
					gamemode: createAssignmentMode,
					targetScore: createAssignmentTargetScore,
					passThreshold: createAssignmentPassThreshold,
					language: createAssignmentLanguage,
					targetCefrLevel: createAssignmentTargetCefrLevel || undefined,
					topic: createAssignmentTopic || undefined,
					targetGrammar: selectedGrammarRules.length > 0 ? selectedGrammarRules : undefined,
					targetVocab: targetVocabList.length > 0 ? targetVocabList : undefined
				})
			});
			const result = await res.json();
			if (!res.ok) {
				assignmentError = result.error || 'Failed to create assignment';
			} else {
				closeCreateAssignmentModal();
				await invalidateAll();
			}
		} catch (e) {
			assignmentError = 'An error occurred';
		} finally {
			isCreatingAssignment = false;
		}
	}

	async function handlePromoteMember(userId: string) {
		try {
			const res = await fetch(`/api/classes/${classDetails.id}/members/${userId}/promote`, {
				method: 'POST'
			});
			if (res.ok) {
				await invalidateAll();
			} else {
				toast.error('Failed to promote member.');
			}
		} catch (e) {
			toast.error('An error occurred.');
		}
	}

	async function handleKickMember(userId: string, name: string) {
		if (!confirm(`Remove ${name} from the class?`)) return;
		try {
			const res = await fetch(`/api/classes/${classDetails.id}/members/${userId}/kick`, {
				method: 'POST'
			});
			if (res.ok) {
				await invalidateAll();
			} else {
				const result = await res.json();
				toast.error(result.error || 'Failed to remove member.');
			}
		} catch (e) {
			toast.error('An error occurred.');
		}
	}

	function formatDate(dateString: string | Date) {
		return new Date(dateString).toLocaleDateString();
	}

	function getAssignmentScore(assignment: any) {
		if (!assignment.scores) return null;
		return assignment.scores.find((s: any) => s.userId === data.user?.id) ?? null;
	}

	function getPassedCount(assignment: any) {
		if (!assignment.scores) return 0;
		return assignment.scores.filter((s: any) => s.passed).length;
	}

	function getMemberScore(assignment: any, userId: string) {
		if (!assignment.scores) return null;
		return assignment.scores.find((s: any) => s.userId === userId) ?? null;
	}

	let copiedAssignmentId: string | null = null;

	async function copyAssignmentLink(assignmentId: string) {
		const url = `${window.location.origin}/play?assignmentId=${assignmentId}`;
		await navigator.clipboard.writeText(url);
		copiedAssignmentId = assignmentId;
		setTimeout(() => {
			copiedAssignmentId = null;
		}, 2000);
	}

	async function handleLeaveClass() {
		if (!confirm('Leave this class? You will need the invite code to rejoin.')) return;
		try {
			const res = await fetch(`/api/classes/${classDetails.id}/leave`, { method: 'POST' });
			if (res.ok) {
				window.location.href = '/classes';
			} else {
				const result = await res.json();
				toast.error(result.error || 'Failed to leave class.');
			}
		} catch (e) {
			toast.error('An error occurred.');
		}
	}

	async function handleDeleteClass() {
		if (!confirm('Are you sure you want to delete this class? This action cannot be undone.'))
			return;
		try {
			const res = await fetch(`/api/classes/${classDetails.id}`, { method: 'DELETE' });
			if (res.ok) {
				toast.success('Class deleted successfully.');
				window.location.href = '/classes';
			} else {
				const result = await res.json();
				toast.error(result.error || 'Failed to delete class.');
			}
		} catch (e) {
			toast.error('An error occurred.');
		}
	}

	async function handleResetCode() {
		if (!confirm('Reset the invite code? The old code will no longer work.')) return;
		try {
			const res = await fetch(`/api/classes/${classDetails.id}/reset-code`, { method: 'POST' });
			if (res.ok) {
				await invalidateAll();
			} else {
				const result = await res.json();
				toast.error(result.error || 'Failed to reset invite code.');
			}
		} catch (e) {
			toast.error('An error occurred.');
		}
	}

	function handleCopyCode() {
		navigator.clipboard.writeText(classDetails.inviteCode);
		toast.success('Invite code copied to clipboard!');
	}

	function handleCopyLink() {
		const url = window.location.origin + '/classes?code=' + classDetails.inviteCode;
		navigator.clipboard.writeText(url);
		toast.success('Invite link copied to clipboard!');
	}
</script>

<svelte:head>
	<title>{classDetails.name} - LingoLearn</title>
</svelte:head>

<div class="class-detail-container">
	<!-- Class Header Banner -->
	<div class="class-banner" in:fly={{ y: 20, duration: 400 }}>
		<div class="banner-info">
			<h1>{classDetails.name}</h1>
			{#if classDetails.description}
				<p class="banner-desc">{classDetails.description}</p>
			{/if}
		</div>
		<div class="banner-actions">
			{#if currentUserRole === 'TEACHER'}
				<div class="invite-box">
					<p class="invite-label">Invite Code</p>
					<p class="invite-code">{classDetails.inviteCode}</p>
					<div class="invite-buttons">
						<button on:click={handleCopyCode} class="invite-btn">Copy Code</button>
						<button on:click={handleCopyLink} class="invite-btn">Copy Link</button>
						<button on:click={handleResetCode} class="invite-btn">Reset</button>
					</div>
				</div>
				<a href="/play?tab=games&classId={classDetails.id}" class="btn-duo btn-primary live-btn"
					>Start Live Session</a
				>
				<button on:click={handleLeaveClass} class="btn-duo btn-leave">Leave Class</button>
				<button on:click={handleDeleteClass} class="btn-duo btn-delete-class">Delete Class</button>
			{:else}
				<a href="/classes/{classDetails.id}/live/student" class="btn-duo btn-primary live-btn"
					>Join Live Session</a
				>
				<button on:click={handleLeaveClass} class="btn-duo btn-leave">Leave Class</button>
			{/if}
		</div>
	</div>

	<div class="content-grid" in:fly={{ y: 20, duration: 400, delay: 200 }}>
		<!-- Main Content: Assignments -->
		<div class="main-col">
			<div class="section-header">
				<h2 class="section-title">Assignments</h2>
				{#if currentUserRole === 'TEACHER'}
					<button
						class="btn-duo btn-primary btn-small"
						on:click={openCreateAssignmentModal}
						disabled={classDetails.assignments.length >= 30}
						title={classDetails.assignments.length >= 30
							? 'Assignment limit reached (30)'
							: 'Create new assignment'}
					>
						+ New Assignment
					</button>
				{/if}
			</div>

			<!-- Assignments List -->
			{#if classDetails.assignments.length > 0}
				<div class="assignments-list">
					{#each classDetails.assignments as assignment}
						{@const myScore = getAssignmentScore(assignment)}
						{@const passed = myScore?.passed ?? false}
						{@const passedCount = getPassedCount(assignment)}
						<div class="card-duo assignment-card {passed ? 'assignment-passed' : ''}">
							<div class="assignment-header">
								<div class="assignment-info">
									<div class="assignment-title-row">
										<h4 class="assignment-title">{assignment.title}</h4>
										{#if passed}
											<span class="badge badge-green">&#10003; Passed</span>
										{:else if myScore}
											<span class="badge badge-amber">{myScore.score}/{assignment.targetScore}</span
											>
										{/if}
									</div>
									{#if assignment.description}
										<p class="assignment-desc">{assignment.description}</p>
									{/if}
									<div class="assignment-meta">
										<span class="meta-tag">{assignment.gamemode.replace(/-/g, ' ')}</span>
										<span class="meta-sep">&#183;</span>
										<span>{assignment.targetScore} to pass</span>
										{#if assignment.dueDate}
											<span class="meta-sep">&#183;</span>
											<span class="meta-due">Due {formatDate(assignment.dueDate)}</span>
										{/if}
										{#if currentUserRole === 'TEACHER'}
											<span class="meta-sep">&#183;</span>
											<span class="meta-progress"
												>{passedCount}/{classDetails.members.filter((m) => m.role === 'STUDENT')
													.length} passed</span
											>
										{/if}
									</div>
								</div>
								<div class="assignment-actions-row">
									<a
										href="/play?assignmentId={assignment.id}"
										class="btn-duo {passed
											? 'btn-secondary'
											: 'btn-primary'} assignment-play-btn text-center"
									>
										{passed ? 'Learn Again' : myScore ? 'Keep Learning' : 'Start'}
									</a>
									{#if currentUserRole === 'TEACHER'}
										<a
											href="/classes/{classDetails.id}/assignments/{assignment.id}"
											class="btn-duo btn-secondary assignment-play-btn text-center"
										>
											View Details
										</a>
										<button
											type="button"
											class="btn-duo btn-copy assignment-play-btn text-center"
											aria-label="Copy assignment link"
											on:click={() => copyAssignmentLink(assignment.id)}
										>
											{copiedAssignmentId === assignment.id ? '✓ Copied' : '🔗 Copy Link'}
										</button>
									{/if}
								</div>
							</div>

							<!-- Teacher: per-student progress -->
							{#if currentUserRole === 'TEACHER' && classDetails.members.filter((m) => m.role === 'STUDENT').length > 0}
								<div class="student-progress">
									<p class="student-progress-label">Student Progress</p>
									<div class="student-chips">
										{#each classDetails.members.filter((m) => m.role === 'STUDENT') as member}
											{@const memberScore = getMemberScore(assignment, member.userId)}
											<div class="student-chip">
												<span class="chip-name"
													>{(member.user.name || member.user.username).split(' ')[0]}</span
												>
												{#if memberScore?.passed}
													<span class="chip-passed">&#10003; {memberScore.score}</span>
												{:else if memberScore}
													<span class="chip-in-progress"
														>{memberScore.score}/{assignment.targetScore}</span
													>
												{:else}
													<span class="chip-pending">Pending</span>
												{/if}
											</div>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<div class="empty-state">
					<p class="empty-title">No assignments yet</p>
					<p class="empty-desc">
						{#if currentUserRole === 'TEACHER'}
							Use the form above to create your first assignment!
						{:else}
							Check back later for new practice tasks!
						{/if}
					</p>
				</div>
			{/if}
		</div>

		<!-- Sidebar: Members and Leaderboard -->
		<div class="sidebar-col">
			<h2 class="section-title">Leaderboard</h2>
			<div class="card-duo members-card leaderboard-card" style="margin-bottom: 2rem;">
				<ul class="members-list">
					{#each classDetails.members
						.slice()
						.sort((a, b) => (b.user.totalXp || 0) - (a.user.totalXp || 0)) as member, index}
						<li class="member-row">
							<div class="member-info">
								<div
									class="leaderboard-rank {index === 0
										? 'rank-1'
										: index === 1
											? 'rank-2'
											: index === 2
												? 'rank-3'
												: ''}"
								>
									#{index + 1}
								</div>
								<div class="member-avatar">
									{(member.user.name || member.user.username).charAt(0).toUpperCase()}
								</div>
								<div class="member-details">
									<p class="member-name">
										{member.user.name || member.user.username}
										{#if member.userId === data.user?.id}
											<span class="you-tag">(you)</span>
										{/if}
									</p>
									<p class="member-xp">
										⚡ {member.user.totalXp || 0} XP
									</p>
								</div>
							</div>
						</li>
					{/each}
				</ul>
			</div>

			<h2 class="section-title">Members ({classDetails.members.length})</h2>
			<div class="card-duo members-card">
				<ul class="members-list">
					{#each classDetails.members as member}
						<li class="member-row">
							<div class="member-info">
								<div class="member-avatar">
									{(member.user.name || member.user.username).charAt(0).toUpperCase()}
								</div>
								<div class="member-details">
									<p class="member-name">
										{member.user.name || member.user.username}
										{#if member.userId === data.user?.id}
											<span class="you-tag">(you)</span>
										{/if}
									</p>
									<p
										class="member-role {member.role === 'TEACHER'
											? 'role-teacher'
											: 'role-student'}"
									>
										{member.role}
									</p>
								</div>
							</div>
							{#if currentUserRole === 'TEACHER' && member.userId !== data.user?.id}
								<div class="member-actions">
									{#if member.role === 'STUDENT'}
										<button
											on:click={() => handlePromoteMember(member.userId)}
											title="Promote to Teacher"
											class="action-btn action-promote"
										>
											&#8593; Promote
										</button>
									{/if}
									<button
										on:click={() =>
											handleKickMember(member.userId, member.user.name || member.user.username)}
										title="Remove from class"
										class="action-btn action-remove"
									>
										&#10005; Remove
									</button>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</div>
</div>

{#if showCreateAssignmentModal}
	<div
		class="modal-backdrop"
		on:click={closeCreateAssignmentModal}
		transition:fly={{ duration: 200, opacity: 0 }}
	>
		<div class="modal-content card-duo" on:click|stopPropagation>
			<div class="modal-header">
				<h3 class="create-form-title">Create New Assignment</h3>
				<button class="btn-close" on:click={closeCreateAssignmentModal}>&times;</button>
			</div>

			<form on:submit|preventDefault={handleCreateAssignment} class="create-form">
				<div class="create-form-row">
					<div class="field">
						<label for="title">Title <span class="required">*</span></label>
						<input
							type="text"
							id="title"
							bind:value={createAssignmentTitle}
							placeholder="e.g. Verb practice week 3"
							required
						/>
					</div>
					<div class="field">
						<label for="desc">Description (optional)</label>
						<input
							type="text"
							id="desc"
							bind:value={createAssignmentDescription}
							placeholder="Any notes for students"
						/>
					</div>
				</div>

				<div class="create-form-row">
					<div class="field">
						<label for="topic">Topic (optional)</label>
						<input
							type="text"
							id="topic"
							bind:value={createAssignmentTopic}
							placeholder="e.g. Ordering food, Traveling"
						/>
					</div>
					<div class="field">
						<label for="vocab">Target Vocabulary (optional)</label>
						<div class="vocab-input-container">
							<div class="vocab-tags">
								{#each targetVocabList as word}
									<span class="vocab-tag">
										{word}
										<button type="button" class="remove-vocab" on:click={() => removeVocab(word)}>&times;</button>
									</span>
								{/each}
								<input
									type="text"
									id="vocab"
									bind:value={vocabInput}
									on:keydown={handleVocabKeydown}
									placeholder={targetVocabList.length === 0 ? "Type a word and press Enter" : ""}
									class="vocab-inline-input"
								/>
							</div>
						</div>
					</div>
				</div>

				<div class="field grammar-rules-field">
					<label>Target Grammar Rules (optional)</label>
					<div class="grammar-rules-container">
						{#if availableRules.length > 0}
							<div class="grammar-search">
								<input 
									type="text" 
									bind:value={grammarSearchQuery} 
									placeholder="Search grammar rules..." 
									class="grammar-search-input"
								/>
							</div>
							<div class="grammar-rules-list">
								{#each availableRules.filter(r => r.title.toLowerCase().includes(grammarSearchQuery.toLowerCase())) as rule}
									<label class="grammar-rule-item" class:selected={selectedGrammarRules.includes(rule.id)}>
										<input 
											type="checkbox" 
											checked={selectedGrammarRules.includes(rule.id)}
											on:change={() => toggleGrammarRule(rule.id)}
										/>
										<div class="grammar-rule-info">
											<span class="grammar-rule-title">{rule.title}</span>
											<span class="badge grammar-rule-badge">{rule.level}</span>
										</div>
									</label>
								{/each}
							</div>
						{:else}
							<p class="no-grammar-rules">No grammar rules available for this language.</p>
						{/if}
					</div>
				</div>

				<div class="create-form-bottom">
					<div class="field">
						<label for="gamemode">Game Mode</label>
						<select id="gamemode" bind:value={createAssignmentMode}>
							<option value="multiple-choice">Multiple Choice</option>
							<option value="native-to-target">Native to Target</option>
							<option value="target-to-native">Target to Native</option>
							<option value="fill-blank">Fill in the Blank</option>
							<option value="chat">Chat</option>
						</select>
					</div>
					<div class="field field-small">
						<label for="language">Language</label>
						<select id="language" bind:value={createAssignmentLanguage}>
							<option value="international">International</option>
							<option value="de">German</option>
							<option value="es">Spanish</option>
							<option value="fr">French</option>
						</select>
					</div>
					<div class="field field-small">
						<label for="targetCefrLevel">CEFR Level</label>
						<select id="targetCefrLevel" bind:value={createAssignmentTargetCefrLevel}>
							<option value="">Use Student's Level</option>
							<option value="A1">A1</option>
							<option value="A2">A2</option>
							<option value="B1">B1</option>
							<option value="B2">B2</option>
							<option value="C1">C1</option>
							<option value="C2">C2</option>
						</select>
					</div>
					<div class="field field-small">
						<label for="targetScore">
							{#if createAssignmentMode === 'chat'}
								Target Turns
							{:else}
								Pass Score
							{/if}
						</label>
						<input
							type="number"
							id="targetScore"
							bind:value={createAssignmentTargetScore}
							min="1"
							max="100"
						/>
						{#if createAssignmentMode === 'chat'}
							<span style="font-size: 0.7rem; color: #64748b; margin-top: 0.25rem; display: block;">Number of turns for chat</span>
						{/if}
					</div>
					<div class="field field-small">
						<label for="passThreshold">Threshold (%)</label>
						<input
							type="number"
							id="passThreshold"
							bind:value={createAssignmentPassThreshold}
							min="1"
							max="100"
						/>
					</div>
				</div>

				<div class="modal-actions">
					<button type="button" class="btn-duo btn-secondary" on:click={closeCreateAssignmentModal}>
						Cancel
					</button>
					<button type="submit" disabled={isCreatingAssignment} class="btn-duo btn-primary">
						{isCreatingAssignment ? 'Creating...' : 'Create Assignment'}
					</button>
				</div>
			</form>
			{#if assignmentError}
				<p class="form-error">{assignmentError}</p>
			{/if}
		</div>
	</div>
{/if}

<style>
	.class-detail-container {
		max-width: 1100px;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	/* Class Banner */
	.class-banner {
		background-color: #3b82f6;
		border-radius: 1.5rem;
		padding: 2rem;
		box-shadow: 0 6px 0 #2563eb;
		color: white;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	@media (min-width: 768px) {
		.class-banner {
			flex-direction: row;
			justify-content: space-between;
			align-items: center;
		}
	}

	.class-banner h1 {
		font-size: 2rem;
		margin: 0 0 0.5rem;
		color: white;
		letter-spacing: -0.02em;
	}

	.banner-desc {
		color: #bfdbfe;
		font-size: 1.05rem;
		font-weight: 700;
		margin: 0;
	}

	.banner-actions {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	@media (min-width: 640px) {
		.banner-actions {
			flex-direction: row;
			flex-wrap: wrap;
			justify-content: flex-end;
		}
	}

	.live-btn {
		background-color: #f59e0b;
		color: white;
		border: 1px solid #d97706;
		box-shadow: 0 4px 0 #b45309;
		font-size: 0.9rem;
		text-transform: uppercase;
		font-weight: 800;
	}

	.live-btn:hover {
		background-color: #fbbf24;
		transform: scale(1.02);
	}

	.live-btn:active {
		transform: scale(0.98) translateY(2px);
		box-shadow: 0 2px 0 #b45309;
	}

	.invite-box {
		background: rgba(255, 255, 255, 0.2);
		padding: 1rem 1.5rem;
		border-radius: 1rem;
		text-align: center;
		min-width: 200px;
		border: 1px solid rgba(255, 255, 255, 0.3);
	}

	.invite-label {
		font-size: 0.7rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.15em;
		color: #bfdbfe;
		margin: 0 0 0.25rem;
	}

	.invite-code {
		font-size: 1.75rem;
		font-family: 'Courier New', monospace;
		font-weight: 900;
		letter-spacing: 0.2em;
		margin: 0 0 0.75rem;
	}

	.invite-buttons {
		display: flex;
		gap: 0.5rem;
		justify-content: center;
	}

	.invite-btn {
		font-size: 0.7rem;
		font-weight: 800;
		background: rgba(255, 255, 255, 0.2);
		border: none;
		color: white;
		padding: 0.4rem 0.75rem;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: background-color 0.2s;
		font-family: inherit;
	}

	.invite-btn:hover {
		background: rgba(255, 255, 255, 0.4);
	}

	.btn-leave {
		background: rgba(255, 255, 255, 0.2);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.3);
		box-shadow: 0 4px 0 rgba(0, 0, 0, 0.15);
		font-size: 0.8rem;
		white-space: nowrap;
	}

	.btn-leave:hover {
		background: rgba(255, 255, 255, 0.3);
		transform: scale(1.02);
	}

	.btn-leave:active {
		transform: scale(0.98) translateY(2px);
		box-shadow: 0 2px 0 rgba(0, 0, 0, 0.15);
	}

	.btn-delete-class {
		background: #fee2e2;
		color: #ef4444;
		border: 1px solid #fca5a5;
		box-shadow: 0 4px 0 rgba(239, 68, 68, 0.2);
		font-size: 0.8rem;
		white-space: nowrap;
	}

	.btn-delete-class:hover {
		background: #fecaca;
		transform: scale(1.02);
	}

	.btn-delete-class:active {
		transform: scale(0.98) translateY(2px);
		box-shadow: 0 2px 0 rgba(239, 68, 68, 0.2);
	}

	/* Content Grid */
	.content-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 2rem;
	}

	@media (min-width: 1024px) {
		.content-grid {
			grid-template-columns: 2fr 1fr;
		}
	}

	.section-title {
		font-size: 1.5rem;
		color: var(--text-color, #0f172a);
		margin: 0 0 1.5rem;
		border-bottom: 2px solid var(--card-border, #e2e8f0);
		padding-bottom: 0.5rem;
	}

	/* Create Assignment Form */
	.create-form-card {
		margin-bottom: 1.5rem;
	}

	.create-form-title {
		font-size: 1rem;
		color: var(--text-color, #1e293b);
		margin: 0 0 1rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.create-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.create-form-row {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
	}

	@media (min-width: 640px) {
		.create-form-row {
			grid-template-columns: 1fr 1fr;
		}
	}

	.create-form-bottom {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		align-items: stretch;
	}

	@media (min-width: 640px) {
		.create-form-bottom {
			flex-direction: row;
			align-items: flex-end;
		}
		.create-form-bottom .field {
			flex: 1;
		}
	}

	.create-form-submit {
		display: flex;
		align-items: flex-end;
	}

	.field label {
		display: block;
		font-size: 0.75rem;
		font-weight: 800;
		color: #475569;
		margin-bottom: 0.4rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.required {
		color: #ef4444;
	}

	.field input,
	.field select {
		width: 100%;
		padding: 0.7rem 1rem;
		border-radius: 1rem;
		border: 2px solid var(--card-border, #e5e7eb);
		background-color: var(--input-bg, #ffffff);
		color: var(--text-color, #1e293b);
		font-family: inherit;
		font-size: 0.95rem;
		font-weight: 700;
		transition: border-color 0.2s;
		box-sizing: border-box;
		outline: none;
	}

	.field input:focus,
	.field select:focus {
		border-color: #22c55e;
	}

	.field-small {
		max-width: 140px;
	}

	.vocab-input-container {
		background-color: var(--input-bg, #ffffff);
		border: 2px solid var(--card-border, #e5e7eb);
		border-radius: 1rem;
		padding: 0.5rem;
		min-height: 44px;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
		transition: border-color 0.2s;
	}

	.vocab-input-container:focus-within {
		border-color: #22c55e;
	}

	.vocab-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		width: 100%;
	}

	.vocab-tag {
		background-color: #e0f2fe;
		color: #0369a1;
		padding: 0.25rem 0.5rem;
		border-radius: 0.5rem;
		font-size: 0.85rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.remove-vocab {
		background: none;
		border: none;
		color: #0369a1;
		cursor: pointer;
		font-size: 1rem;
		line-height: 1;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.remove-vocab:hover {
		color: #0c4a6e;
	}

	.vocab-inline-input {
		flex: 1;
		min-width: 120px;
		border: none !important;
		padding: 0.25rem !important;
		font-size: 0.95rem !important;
		border-radius: 0 !important;
		background: transparent !important;
	}

	.vocab-inline-input:focus {
		box-shadow: none !important;
	}

	.grammar-rules-field {
		margin-top: 1rem;
	}

	.grammar-rules-container {
		border: 2px solid var(--card-border, #e5e7eb);
		border-radius: 1rem;
		overflow: hidden;
		background: var(--input-bg, #ffffff);
	}

	.grammar-search {
		padding: 0.5rem;
		border-bottom: 1px solid var(--card-border, #e5e7eb);
	}

	.grammar-search-input {
		width: 100%;
		padding: 0.5rem 1rem !important;
		border: 1px solid var(--card-border, #e5e7eb) !important;
		border-radius: 0.5rem !important;
		font-size: 0.85rem !important;
	}

	.grammar-rules-list {
		max-height: 200px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	.grammar-rule-item {
		display: flex;
		align-items: center;
		padding: 0.75rem 1rem;
		gap: 0.75rem;
		cursor: pointer;
		border-bottom: 1px solid #f1f5f9;
		transition: background-color 0.15s;
		margin: 0 !important;
	}

	.grammar-rule-item input[type='checkbox'] {
		display: none;
	}

	.grammar-rule-item:last-child {
		border-bottom: none;
	}

	.grammar-rule-item:hover {
		background-color: #f8fafc;
	}

	.grammar-rule-item.selected {
		background-color: #f0fdf4;
	}

	.grammar-rule-info {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex: 1;
	}

	.grammar-rule-title {
		font-size: 0.9rem;
		font-weight: 600;
		color: #1e293b;
	}

	.grammar-rule-badge {
		font-size: 0.65rem;
		padding: 0.15rem 0.4rem;
	}

	.no-grammar-rules {
		padding: 1rem;
		text-align: center;
		color: #64748b;
		font-size: 0.85rem;
		font-weight: 600;
		margin: 0;
	}

	.form-error {
		background-color: #fef2f2;
		color: #ef4444;
		font-weight: 700;
		font-size: 0.875rem;
		padding: 0.75rem 1rem;
		border-radius: 0.75rem;
		border: 2px solid #fecaca;
		margin: 1rem 0 0;
	}

	/* Assignments List */
	.assignments-list {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.assignment-passed {
		border-color: #86efac;
	}

	.assignment-header {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	@media (min-width: 640px) {
		.assignment-header {
			flex-direction: row;
			justify-content: space-between;
			align-items: flex-start;
		}
	}

	.assignment-info {
		flex-grow: 1;
		min-width: 0;
	}

	.assignment-title-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.assignment-title-row h4 {
		font-size: 1.4rem;
		color: var(--text-color, #1e293b);
		margin: 0;
		text-transform: uppercase;
		letter-spacing: -0.01em;
	}

	.badge {
		font-size: 0.7rem;
		font-weight: 800;
		padding: 0.2rem 0.6rem;
		border-radius: 9999px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.badge-green {
		background-color: #dcfce7;
		color: #16a34a;
	}

	.badge-amber {
		background-color: #fef3c7;
		color: #d97706;
	}

	.assignment-desc {
		color: #64748b;
		font-size: 0.9rem;
		font-weight: 600;
		margin: 0.4rem 0 0;
	}

	.assignment-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-top: 0.75rem;
		font-size: 0.7rem;
		font-weight: 800;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.meta-tag {
		background-color: var(--card-bg, #f1f5f9);
		padding: 0.2rem 0.5rem;
		border-radius: 0.5rem;
		font-size: 0.65rem;
		border: 2px solid var(--card-border, #e5e7eb);
	}

	.meta-sep {
		color: #cbd5e1;
	}

	.meta-due {
		color: #3b82f6;
	}

	.meta-progress {
		color: #8b5cf6;
	}

	.assignment-title {
		font-size: 1.4rem !important;
	}

	.assignment-play-btn {
		white-space: nowrap;
		flex-shrink: 0;
		padding: 0.5rem 1rem !important;
		font-size: 0.75rem !important;
	}

	.btn-copy {
		background-color: #f1f5f9;
		color: #475569;
		border-color: transparent;
		box-shadow: 0 4px 0 #cbd5e1;
	}

	.btn-copy:hover {
		background-color: #e2e8f0;
		transform: scale(1.02);
	}

	.btn-copy:active {
		transform: scale(0.98) translateY(2px);
		box-shadow: 0 2px 0 #cbd5e1;
	}

	.btn-delete {
		background-color: #fee2e2;
		color: #ef4444;
		border-color: transparent;
		box-shadow: 0 4px 0 #fca5a5;
	}

	.btn-delete:hover {
		background-color: #fecaca;
		transform: scale(1.02);
	}

	.btn-delete:active {
		transform: scale(0.98) translateY(2px);
		box-shadow: 0 2px 0 #fca5a5;
	}

	.assignment-actions-row {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-top: 0.5rem;
		min-width: 8rem;
	}

	@media (min-width: 640px) {
		.assignment-actions-row {
			margin-top: 0;
		}
	}

	/* Student Progress */
	.student-progress {
		margin-top: 1.25rem;
		padding-top: 1.25rem;
		border-top: 2px solid var(--card-border, #f1f5f9);
	}

	.student-progress-label {
		font-size: 0.7rem;
		font-weight: 800;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin: 0 0 0.75rem;
	}

	.student-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.student-chip {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: var(--card-bg, #f8fafc);
		border: 2px solid var(--card-border, #e5e7eb);
		border-radius: 0.75rem;
		padding: 0.4rem 0.75rem;
		font-size: 0.8rem;
		font-weight: 800;
	}

	.chip-name {
		color: var(--text-color, #475569);
	}

	.chip-passed {
		color: #16a34a;
	}

	.chip-in-progress {
		color: #d97706;
	}

	.chip-pending {
		color: #94a3b8;
		font-size: 0.65rem;
		text-transform: uppercase;
	}

	/* Empty State */
	.empty-state {
		text-align: center;
		padding: 3rem 2rem;
		background: var(--card-bg, #f8fafc);
		border-radius: 1.5rem;
		border: 3px dashed var(--card-border, #cbd5e1);
	}

	.empty-title {
		font-size: 1.25rem;
		font-weight: 800;
		color: #64748b;
		margin: 0 0 0.5rem;
	}

	.empty-desc {
		color: #94a3b8;
		font-size: 0.95rem;
		font-weight: 600;
		margin: 0;
	}

	/* Members Sidebar */
	.members-card {
		padding: 0;
		overflow: hidden;
	}

	.members-card:hover {
		transform: none;
		box-shadow: 0 4px 0 #e5e7eb;
	}

	.members-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.member-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.85rem 1.25rem;
		border-bottom: 2px solid var(--card-border, #f1f5f9);
		transition: background-color 0.15s;
		gap: 0.5rem;
	}

	.member-row:last-child {
		border-bottom: none;
	}

	.member-row:hover {
		background-color: var(--card-bg, #f8fafc);
	}

	.member-info {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}

	.member-avatar {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 0.75rem;
		background-color: #dbeafe;
		color: #3b82f6;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 900;
		font-size: 1.1rem;
		flex-shrink: 0;
		border: 2px solid #bfdbfe;
	}

	.member-details {
		min-width: 0;
	}

	.member-name {
		font-weight: 800;
		color: var(--text-color, #1e293b);
		margin: 0;
		font-size: 0.95rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.you-tag {
		color: #94a3b8;
		font-weight: 600;
		font-size: 0.75rem;
		margin-left: 0.25rem;
	}

	.member-role {
		font-size: 0.65rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin: 0.1rem 0 0;
	}

	.member-xp {
		font-size: 0.75rem;
		font-weight: 800;
		color: #3b82f6;
		margin: 0.1rem 0 0;
	}

	.leaderboard-rank {
		font-size: 1.1rem;
		font-weight: 900;
		color: #94a3b8;
		width: 1.5rem;
		text-align: center;
	}

	.rank-1 {
		color: #f59e0b;
	}
	.rank-2 {
		color: #94a3b8;
	}
	.rank-3 {
		color: #b45309;
	}

	.role-teacher {
		color: #8b5cf6;
	}

	.role-student {
		color: #94a3b8;
	}

	.member-actions {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex-shrink: 0;
	}

	.action-btn {
		font-size: 0.65rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.3rem 0.6rem;
		border-radius: 0.5rem;
		border: none;
		cursor: pointer;
		background: none;
		transition: all 0.15s;
		font-family: inherit;
	}

	.action-promote {
		color: #3b82f6;
	}

	.action-promote:hover {
		background-color: #dbeafe;
		color: #2563eb;
	}

	.action-remove {
		color: #f87171;
	}

	.action-remove:hover {
		background-color: #fef2f2;
		color: #ef4444;
	}

	/* Modal Styles */
	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
		border-bottom: 2px solid var(--card-border, #e2e8f0);
		padding-bottom: 0.5rem;
	}

	.section-header .section-title {
		border-bottom: none;
		margin-bottom: 0;
		padding-bottom: 0;
	}

	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(15, 23, 42, 0.6);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.modal-content {
		width: 100%;
		max-width: 600px;
		max-height: 90vh;
		overflow-y: auto;
		background: var(--card-bg, #ffffff);
		padding: 2rem;
		border-radius: 1.5rem;
		position: relative;
		box-shadow:
			0 10px 25px -5px rgba(0, 0, 0, 0.1),
			0 8px 10px -6px rgba(0, 0, 0, 0.1);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.modal-header .create-form-title {
		margin-bottom: 0;
	}

	.btn-close {
		background: none;
		border: none;
		font-size: 1.5rem;
		line-height: 1;
		color: #94a3b8;
		cursor: pointer;
		padding: 0.5rem;
		transition: color 0.2s;
	}

	.btn-close:hover {
		color: #0f172a;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
		margin-top: 2rem;
		padding-top: 1rem;
		border-top: 2px solid var(--card-border, #e2e8f0);
	}

	@media (max-width: 768px) {
		.class-detail-container {
			padding: 1rem 0.5rem;
		}

		.btn-duo {
			width: 100%;
			box-sizing: border-box;
		}

		.assignment-play-btn {
			width: 100%;
		}

		.modal-actions {
			flex-direction: column;
		}
	}
</style>

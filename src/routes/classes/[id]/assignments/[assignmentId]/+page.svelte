<script lang="ts">
	import type { PageData } from './$types';
	import { fly } from 'svelte/transition';

	export let data: PageData;

	$: assignment = data.assignment;
	$: classDetails = data.classDetails;

	// Only consider student members for progress tracking
	$: studentMembers = classDetails.members.filter(m => m.role === 'STUDENT');

	function getScoreForUser(userId: string) {
		return assignment.scores.find(s => s.userId === userId);
	}

	$: totalStudents = studentMembers.length;
	$: passedStudents = studentMembers.filter(m => getScoreForUser(m.userId)?.passed).length;
	$: passPercentage = totalStudents > 0 ? Math.round((passedStudents / totalStudents) * 100) : 0;

	let copied = false;

	async function copyLink() {
		const url = `${window.location.origin}/play?assignmentId=${assignment.id}`;
		await navigator.clipboard.writeText(url);
		copied = true;
		setTimeout(() => { copied = false; }, 2000);
	}
</script>

<svelte:head>
	<title>{assignment.title} Progress - {classDetails.name}</title>
</svelte:head>

<div class="assignment-container">
	<!-- Header Banner -->
	<div class="assignment-banner" in:fly={{ y: 20, duration: 400 }}>
		<div class="banner-info">
			<a href="/classes/{classDetails.id}" class="back-link">&larr; Back to Class</a>
			<h1>{assignment.title}</h1>
			{#if assignment.description}
				<p class="banner-desc">{assignment.description}</p>
			{/if}
			<div class="assignment-meta">
				<span class="meta-tag">{assignment.gamemode.replace(/-/g, ' ')}</span>
				<span class="meta-sep">&bull;</span>
				<span>Target Score: {assignment.targetScore}</span>
			</div>
			<button type="button" class="copy-link-btn" on:click={copyLink}>
				{#if copied}✓ Copied!{:else}🔗 Copy Link{/if}
			</button>
		</div>
		<div class="pass-rate-box">
			<p class="pass-rate-label">Pass Rate</p>
			<div class="pass-rate-value">{passPercentage}%</div>
			<p class="pass-rate-sub">{passedStudents} of {totalStudents} passed</p>
		</div>
	</div>

	<!-- Student Progress -->
	<div in:fly={{ y: 20, duration: 400, delay: 100 }}>
		<h2 class="section-title">Student Progress</h2>

		{#if studentMembers.length === 0}
			<div class="empty-state">
				<p class="empty-title">No students yet</p>
				<p class="empty-desc">Students will appear here once they join the class.</p>
			</div>
		{:else}
			<div class="card-duo members-card">
				<ul class="members-list">
					{#each studentMembers as member}
						{@const scoreInfo = getScoreForUser(member.userId)}
						{@const hasStarted = !!scoreInfo}
						{@const isPassed = scoreInfo?.passed}
						<li class="member-row">
							<div class="member-info">
								<div class="member-avatar">
									{(member.user.name || member.user.username).charAt(0).toUpperCase()}
								</div>
								<div class="member-details">
									<p class="member-name">{member.user.name || member.user.username}</p>
									<p class="member-username">{member.user.username}</p>
								</div>
							</div>
							<div class="score-info">
								{#if !hasStarted}
									<span class="badge badge-pending">Not Started</span>
								{:else if isPassed}
									<div class="score-display score-passed">
										<span class="score-check">&#10003;</span>
										<span class="score-value">{scoreInfo.score}<span class="score-denom">/{assignment.targetScore}</span></span>
										<span class="badge badge-green">Passed</span>
									</div>
								{:else}
									<div class="score-display score-progress">
										<span class="score-value score-amber">{scoreInfo.score}<span class="score-denom">/{assignment.targetScore}</span></span>
										<span class="badge badge-amber">In Progress</span>
									</div>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
</div>

<style>
	.assignment-container {
		max-width: 900px;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	/* Banner */
	.assignment-banner {
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

	@media (min-width: 640px) {
		.assignment-banner {
			flex-direction: row;
			justify-content: space-between;
			align-items: center;
		}
	}

	.back-link {
		display: inline-block;
		font-size: 0.8rem;
		font-weight: 800;
		color: #bfdbfe;
		text-decoration: none;
		margin-bottom: 0.75rem;
		letter-spacing: 0.02em;
		transition: color 0.15s;
	}

	.back-link:hover {
		color: white;
	}

	.assignment-banner h1 {
		font-size: 2rem;
		margin: 0 0 0.4rem;
		color: white;
		letter-spacing: -0.02em;
	}

	.banner-desc {
		color: #bfdbfe;
		font-size: 1rem;
		font-weight: 700;
		margin: 0 0 0.75rem;
	}

	.assignment-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		font-size: 0.7rem;
		font-weight: 800;
		color: #bfdbfe;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.copy-link-btn {
		margin-top: 1rem;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		background: rgba(255, 255, 255, 0.15);
		border: 2px solid rgba(255, 255, 255, 0.3);
		color: white;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		padding: 0.35rem 0.85rem;
		border-radius: 0.6rem;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
	}

	.copy-link-btn:hover {
		background: rgba(255, 255, 255, 0.25);
		border-color: rgba(255, 255, 255, 0.5);
	}

	.meta-tag {
		background: rgba(255, 255, 255, 0.2);
		padding: 0.2rem 0.6rem;
		border-radius: 0.5rem;
		border: 1px solid rgba(255, 255, 255, 0.25);
	}

	.meta-sep {
		color: rgba(255, 255, 255, 0.4);
	}

	/* Pass Rate Box */
	.pass-rate-box {
		background: rgba(255, 255, 255, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 1rem;
		padding: 1.25rem 1.75rem;
		text-align: center;
		flex-shrink: 0;
		min-width: 140px;
	}

	.pass-rate-label {
		font-size: 0.65rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.15em;
		color: #bfdbfe;
		margin: 0 0 0.3rem;
	}

	.pass-rate-value {
		font-size: 2.5rem;
		font-weight: 900;
		color: white;
		line-height: 1;
		margin-bottom: 0.3rem;
	}

	.pass-rate-sub {
		font-size: 0.8rem;
		font-weight: 700;
		color: #bfdbfe;
		margin: 0;
	}

	/* Section Title */
	.section-title {
		font-size: 1.5rem;
		color: var(--text-color, #0f172a);
		margin: 0 0 1.5rem;
		border-bottom: 2px solid var(--card-border, #e2e8f0);
		padding-bottom: 0.5rem;
	}

	/* Members Card */
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

	.member-username {
		font-size: 0.7rem;
		font-weight: 700;
		color: #94a3b8;
		margin: 0.1rem 0 0;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Score display */
	.score-info {
		flex-shrink: 0;
		display: flex;
		align-items: center;
	}

	.score-display {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.score-check {
		color: #16a34a;
		font-weight: 900;
		font-size: 1.1rem;
	}

	.score-value {
		font-size: 1.1rem;
		font-weight: 900;
		color: var(--text-color, #1e293b);
	}

	.score-amber {
		color: #d97706;
	}

	.score-denom {
		font-size: 0.75rem;
		font-weight: 700;
		color: #94a3b8;
	}

	/* Badges */
	.badge {
		font-size: 0.65rem;
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

	.badge-pending {
		background-color: var(--card-bg, #f1f5f9);
		color: #94a3b8;
		border: 2px solid var(--card-border, #e5e7eb);
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
</style>
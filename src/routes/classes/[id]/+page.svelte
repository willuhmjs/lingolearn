<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { fly } from 'svelte/transition';
  import toast from 'svelte-french-toast';
  import { toastError } from '$lib/utils/toast';
  import { modal } from '$lib/modal.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let classDetails = $derived(data.classDetails);
  let currentUserRole = $derived(data.currentUserRole);
  const nativeFlag = '🇬🇧';

  // Assignment Creation
  let showCreateAssignmentModal = $state(false);
  let createAssignmentTitle = $state('');
  let createAssignmentDescription = $state('');
  let createAssignmentMode = $state('multiple-choice');
  let createAssignmentTargetScore = $state(10);
  let createAssignmentPassThreshold = $state(50);
  let createAssignmentLanguage = $state('');
  $effect(() => {
    createAssignmentLanguage = data.classDetails?.primaryLanguage || '';
  });
  let createAssignmentTargetCefrLevel = $state('');
  let createAssignmentTopic = $state('');
  let selectedGrammarRules: string[] = $state([]);
  let targetVocabList: string[] = $state([]);
  let vocabInput = $state('');
  let grammarSearchQuery = $state('');
  let createAssignmentGameId = $state('');
  let createAssignmentDisableHoverTranslation = $state(false);
  let titleWasAutoFilled = $state(false);
  let isCreatingAssignment = $state(false);

  let currentLang = $derived(data.languages?.find((l: any) => l.code === createAssignmentLanguage));
  let availableRules = $derived(currentLang ? currentLang.grammarRules : []);
  let classLang = $derived(
    data.languages?.find((l: any) => l.code === classDetails.primaryLanguage)
  );
  let targetFlag = $derived(classLang?.flag ?? '🎯');

  const MODE_DEFAULTS: Record<string, { targetScore: number; passThreshold: number }> = {
    'multiple-choice': { targetScore: 10, passThreshold: 80 },
    'native-to-target': { targetScore: 10, passThreshold: 80 },
    'target-to-native': { targetScore: 10, passThreshold: 80 },
    'fill-blank': { targetScore: 10, passThreshold: 80 },
    chat: { targetScore: 20, passThreshold: 50 },
    immerse: { targetScore: 10, passThreshold: 50 },
    quiz: { targetScore: 10, passThreshold: 50 }
  };

  function applyModeDefaults(mode: string) {
    const d = MODE_DEFAULTS[mode] ?? { targetScore: 10, passThreshold: 50 };
    createAssignmentTargetScore = d.targetScore;
    createAssignmentPassThreshold = d.passThreshold;
    // Clear quiz selection and auto-title when leaving quiz mode
    if (mode !== 'quiz') {
      if (titleWasAutoFilled) {
        createAssignmentTitle = '';
        titleWasAutoFilled = false;
      }
      createAssignmentGameId = '';
    }
  }

  function handleModeChange(mode: string) {
    createAssignmentMode = mode;
    applyModeDefaults(mode);
  }

  function handleQuizSelect(quizId: string) {
    createAssignmentGameId = quizId;
    const quiz = (data.teacherGames || []).find((q: any) => q.id === quizId);
    if (quiz) {
      // Auto-fill title if empty or was previously auto-filled
      if (!createAssignmentTitle || titleWasAutoFilled) {
        createAssignmentTitle = quiz.title;
        titleWasAutoFilled = true;
      }
      // Default correct answers to total question count
      createAssignmentTargetScore = quiz._count.questions || 10;
    }
  }

  function openCreateAssignmentModal() {
    showCreateAssignmentModal = true;
    createAssignmentTitle = '';
    createAssignmentDescription = '';
    createAssignmentMode = 'multiple-choice';
    createAssignmentTargetScore = 10;
    createAssignmentPassThreshold = 80;
    createAssignmentLanguage = data.classDetails.primaryLanguage;
    createAssignmentTargetCefrLevel = '';
    createAssignmentTopic = '';
    selectedGrammarRules = [];
    targetVocabList = [];
    vocabInput = '';
    grammarSearchQuery = '';
    createAssignmentGameId = '';
    createAssignmentDisableHoverTranslation = false;
    titleWasAutoFilled = false;
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
      toastError('Title is required');
      return;
    }
    if (isCreatingAssignment) return;
    isCreatingAssignment = true;

    try {
      const res = await fetch(`/api/classes/${classDetails.id}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createAssignmentTitle,
          description: createAssignmentDescription || undefined,
          gamemode: createAssignmentMode,
          gameId: createAssignmentMode === 'quiz' ? createAssignmentGameId || undefined : undefined,
          targetScore: createAssignmentTargetScore,
          passThreshold: createAssignmentPassThreshold,
          language: createAssignmentLanguage,
          targetCefrLevel: createAssignmentTargetCefrLevel || undefined,
          topic: createAssignmentTopic || undefined,
          targetGrammar: selectedGrammarRules.length > 0 ? selectedGrammarRules : undefined,
          targetVocab: targetVocabList.length > 0 ? targetVocabList : undefined,
          disableHoverTranslation: createAssignmentDisableHoverTranslation
        })
      });
      const result = await res.json();
      if (!res.ok) {
        toastError(result.error || 'Failed to create assignment');
      } else {
        closeCreateAssignmentModal();
        await invalidateAll();
      }
    } catch (_) {
      toastError('An error occurred');
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
    } catch (_) {
      toast.error('An error occurred.');
    }
  }

  async function handleKickMember(userId: string, name: string) {
    if (!(await modal.confirm(`Remove ${name} from the class?`))) return;
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
    } catch (_) {
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

  let copiedAssignmentId: string | null = $state(null);

  async function copyAssignmentLink(assignmentId: string, gameId?: string | null) {
    const url = gameId
      ? `${window.location.origin}/play/games/${gameId}/play?assignmentId=${assignmentId}`
      : `${window.location.origin}/play?assignmentId=${assignmentId}`;
    await navigator.clipboard.writeText(url);
    copiedAssignmentId = assignmentId;
    setTimeout(() => {
      copiedAssignmentId = null;
    }, 2000);
  }

  async function handleLeaveClass() {
    if (!(await modal.confirm('Leave this class? You will need the invite code to rejoin.')))
      return;
    try {
      const res = await fetch(`/api/classes/${classDetails.id}/leave`, { method: 'POST' });
      if (res.ok) {
        window.location.href = '/classes';
      } else {
        const result = await res.json();
        toast.error(result.error || 'Failed to leave class.');
      }
    } catch (_) {
      toast.error('An error occurred.');
    }
  }

  async function handleDeleteClass() {
    if (
      !(await modal.confirm(
        'Are you sure you want to delete this class? This action cannot be undone.'
      ))
    )
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
    } catch (_) {
      toast.error('An error occurred.');
    }
  }

  async function handleResetCode() {
    if (!(await modal.confirm('Reset the invite code? The old code will no longer work.'))) return;
    try {
      const res = await fetch(`/api/classes/${classDetails.id}/reset-code`, { method: 'POST' });
      if (res.ok) {
        await invalidateAll();
      } else {
        const result = await res.json();
        toast.error(result.error || 'Failed to reset invite code.');
      }
    } catch (_) {
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
      <nav class="breadcrumb">
        <a href="/classes">Classes</a>
        <span class="breadcrumb-sep">/</span>
        <span class="breadcrumb-current">{classDetails.name}</span>
      </nav>
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
            <button onclick={handleCopyCode} class="invite-btn">Copy Code</button>
            <button onclick={handleCopyLink} class="invite-btn">Copy Link</button>
            <button onclick={handleResetCode} class="invite-btn">Reset</button>
          </div>
        </div>
        <div class="action-stack">
          <a href="/play?tab=games&classId={classDetails.id}" class="btn-duo btn-primary live-btn"
            >Start Live Session</a
          >
          <a href="/classes/{classDetails.id}/analytics" class="btn-duo btn-secondary live-btn"
            >View Analytics</a
          >
          <div class="action-row">
            <button onclick={handleLeaveClass} class="btn-duo btn-leave">Leave Class</button>
            <button onclick={handleDeleteClass} class="btn-duo btn-delete-class"
              >Delete Class</button
            >
          </div>
        </div>
      {:else}
        <div class="action-stack">
          <a href="/classes/{classDetails.id}/live/student" class="btn-duo btn-primary live-btn"
            >Join Live Session</a
          >
          <div class="action-row">
            <button onclick={handleLeaveClass} class="btn-duo btn-leave">Leave Class</button>
          </div>
        </div>
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
            onclick={openCreateAssignmentModal}
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
                    <span class="meta-tag mode-tag">{assignment.gamemode.replace(/-/g, ' ')}</span>
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
                    <span class="meta-tag score-tag">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        class="meta-icon"
                        ><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle
                          cx="12"
                          cy="12"
                          r="2"
                        /></svg
                      >
                      {assignment.targetScore} to pass
                    </span>
                    {#if currentUserRole === 'TEACHER'}
                      <span class="meta-tag progress-tag">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          class="meta-icon"
                          ><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle
                            cx="9"
                            cy="7"
                            r="4"
                          /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path
                            d="M16 3.13a4 4 0 0 1 0 7.75"
                          /></svg
                        >
                        {passedCount}/{classDetails.members.filter((m) => m.role === 'STUDENT')
                          .length} passed
                      </span>
                    {/if}
                    {#if assignment.dueDate}
                      <span class="meta-tag due-tag">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          class="meta-icon"
                          ><circle cx="12" cy="12" r="10" /><polyline
                            points="12 6 12 12 16 14"
                          /></svg
                        >
                        Due {formatDate(assignment.dueDate)}
                      </span>
                    {/if}
                  </div>

                  <div class="assignment-start-container">
                    <a
                      href={assignment.gamemode === 'quiz' && assignment.gameId
                        ? `/play/games/${assignment.gameId}/play?assignmentId=${assignment.id}`
                        : `/play?assignmentId=${assignment.id}`}
                      class="btn-duo {passed
                        ? 'btn-secondary'
                        : 'btn-primary'} assignment-play-btn text-center"
                    >
                      {passed ? 'Play Again' : myScore ? 'Continue' : 'Start'}
                    </a>
                  </div>
                </div>
                {#if currentUserRole === 'TEACHER'}
                  <div class="assignment-actions-row">
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
                      onclick={() =>
                        copyAssignmentLink(
                          assignment.id,
                          assignment.gamemode === 'quiz' ? assignment.gameId : null
                        )}
                    >
                      {copiedAssignmentId === assignment.id ? '✓ Copied' : '🔗 Copy Link'}
                    </button>
                  </div>
                {/if}
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
                      onclick={() => handlePromoteMember(member.userId)}
                      title="Promote to Teacher"
                      class="action-btn action-promote"
                    >
                      &#8593; Promote
                    </button>
                  {/if}
                  <button
                    onclick={() =>
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
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-backdrop"
    onclick={closeCreateAssignmentModal}
    transition:fly={{ duration: 200, opacity: 0 }}
  >
    <div class="modal-content card-duo" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <div>
          <h3 class="modal-title">New Assignment</h3>
          <p class="modal-subtitle">Set up a task for your students</p>
        </div>
        <button class="btn-close" onclick={closeCreateAssignmentModal}>&times;</button>
      </div>

      <form
        onsubmit={(e) => {
          e.preventDefault();
          handleCreateAssignment();
        }}
        class="create-form"
      >
        <!-- Step 1: Mode selection — always shown first -->
        <div class="form-section">
          <p class="section-label">Mode</p>
          <div class="mode-grid">
            {#each [{ value: 'multiple-choice', label: 'Multiple Choice', icon: '🔘' }, { value: 'native-to-target', label: 'Into Target', icon: `${nativeFlag}→${targetFlag}` }, { value: 'target-to-native', label: 'Into Native', icon: `${targetFlag}→${nativeFlag}` }, { value: 'fill-blank', label: 'Fill in Blank', icon: '✏️' }, { value: 'chat', label: 'Chat', icon: '💬' }, { value: 'immerse', label: 'Immerse', icon: '📖' }, { value: 'quiz', label: 'Quiz', icon: '🎯' }] as m}
              <button
                type="button"
                class="mode-btn"
                class:mode-active={createAssignmentMode === m.value}
                onclick={() => handleModeChange(m.value)}
              >
                <span class="mode-icon">{m.icon}</span>
                <span class="mode-label-text">{m.label}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Quiz picker (quiz mode only) -->
        {#if createAssignmentMode === 'quiz'}
          <div class="form-section">
            <p class="section-label">Quiz <span class="required">*</span></p>
            {#if (data.teacherGames || []).length === 0}
              <p class="empty-hint">
                You have no quizzes yet. <a href="/play/games/create" target="_blank">Create one</a> first.
              </p>
            {:else}
              <div class="quiz-list">
                {#each data.teacherGames || [] as quiz}
                  <label
                    class="quiz-option"
                    class:quiz-selected={createAssignmentGameId === quiz.id}
                  >
                    <input
                      type="radio"
                      name="quizPicker"
                      value={quiz.id}
                      checked={createAssignmentGameId === quiz.id}
                      onchange={() => handleQuizSelect(quiz.id)}
                    />
                    <div class="quiz-option-info">
                      <span class="quiz-option-title">{quiz.title}</span>
                      <span class="quiz-option-meta"
                        >{quiz._count.questions} questions{quiz.isPublished ? '' : ' · draft'}</span
                      >
                    </div>
                    {#if createAssignmentGameId === quiz.id}
                      <span class="quiz-check">✓</span>
                    {/if}
                  </label>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        <!-- Basic info -->
        <div class="form-section">
          <p class="section-label">Details</p>
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
        </div>

        <!-- AI targeting — only for learn modes -->
        {#if ['multiple-choice', 'native-to-target', 'target-to-native', 'fill-blank'].includes(createAssignmentMode)}
          <div class="form-section">
            <p class="section-label">AI Focus <span class="optional-label">(optional)</span></p>
            <div class="create-form-row">
              <div class="field">
                <label for="topic">Topic</label>
                <input
                  type="text"
                  id="topic"
                  bind:value={createAssignmentTopic}
                  placeholder="e.g. Ordering food, Traveling"
                />
              </div>
              <div class="field">
                <label for="vocab">Target Vocabulary</label>
                <div class="vocab-input-container">
                  <div class="vocab-tags">
                    {#each targetVocabList as word}
                      <span class="vocab-tag">
                        {word}
                        <button type="button" class="remove-vocab" onclick={() => removeVocab(word)}
                          >&times;</button
                        >
                      </span>
                    {/each}
                    <input
                      type="text"
                      id="vocab"
                      bind:value={vocabInput}
                      onkeydown={handleVocabKeydown}
                      placeholder={targetVocabList.length === 0
                        ? 'Type a word and press Enter'
                        : ''}
                      class="vocab-inline-input"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div class="field grammar-rules-field">
              <span class="field-label">Target Grammar Rules</span>
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
                    {#each availableRules.filter((r: any) => r.title
                        .toLowerCase()
                        .includes(grammarSearchQuery.toLowerCase())) as rule}
                      <label
                        class="grammar-rule-item"
                        class:selected={selectedGrammarRules.includes(rule.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedGrammarRules.includes(rule.id)}
                          onchange={() => toggleGrammarRule(rule.id)}
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
          </div>
        {/if}

        <!-- Scoring & settings -->
        <div class="form-section">
          <p class="section-label">Settings</p>
          <div class="settings-row">
            {#if createAssignmentMode !== 'quiz'}
              <div class="field">
                <label for="language">Language</label>
                <select id="language" bind:value={createAssignmentLanguage}>
                  <option value="international">International</option>
                  <option value="de">German</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                </select>
              </div>
            {/if}
            {#if createAssignmentMode !== 'quiz'}
              <div class="field">
                <label for="targetCefrLevel">CEFR Level</label>
                <select id="targetCefrLevel" bind:value={createAssignmentTargetCefrLevel}>
                  <option value="">Student's level</option>
                  <option value="A1">A1</option>
                  <option value="A2">A2</option>
                  <option value="B1">B1</option>
                  <option value="B2">B2</option>
                  <option value="C1">C1</option>
                  <option value="C2">C2</option>
                </select>
              </div>
            {/if}
            <div class="field">
              <label for="targetScore">
                {#if createAssignmentMode === 'chat'}Target Turns
                {:else if createAssignmentMode === 'immerse'}Target Questions
                {:else if createAssignmentMode === 'quiz'}Correct Answers
                {:else}Pass Score{/if}
              </label>
              <input
                type="number"
                id="targetScore"
                bind:value={createAssignmentTargetScore}
                min="1"
                max="100"
              />
            </div>
            {#if createAssignmentMode !== 'chat' && createAssignmentMode !== 'quiz'}
              <div class="field">
                <label for="passThreshold">Pass Threshold</label>
                <div class="threshold-input">
                  <input
                    type="number"
                    id="passThreshold"
                    bind:value={createAssignmentPassThreshold}
                    min="1"
                    max="100"
                  />
                  <span class="threshold-pct">%</span>
                </div>
              </div>
            {/if}
          </div>
        </div>

        <label class="toggle-row">
          <input type="checkbox" bind:checked={createAssignmentDisableHoverTranslation} />
          <span>Disable hover translation for students</span>
        </label>

        <div class="modal-actions">
          <button type="button" class="btn-duo btn-secondary" onclick={closeCreateAssignmentModal}>
            Cancel
          </button>
          <button type="submit" disabled={isCreatingAssignment} class="btn-duo btn-primary">
            {isCreatingAssignment ? 'Creating...' : 'Create Assignment'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
    font-size: 0.8rem;
  }

  .breadcrumb a {
    color: #bfdbfe;
    text-decoration: none;
    font-weight: 600;
    transition: color 0.15s;
  }

  .breadcrumb a:hover {
    color: white;
  }

  .breadcrumb-sep {
    color: rgba(255, 255, 255, 0.4);
  }

  .breadcrumb-current {
    color: rgba(255, 255, 255, 0.7);
  }

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
    gap: 1.5rem;
  }

  @media (min-width: 640px) {
    .banner-actions {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
  }

  .action-stack {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
  }

  @media (min-width: 640px) {
    .action-stack {
      width: auto;
      align-items: stretch;
    }
  }

  .action-row {
    display: flex;
    gap: 0.5rem;
    width: 100%;
    flex-direction: column;
  }

  @media (min-width: 640px) {
    .action-row {
      width: auto;
      justify-content: flex-end;
      flex-direction: row;
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

  /* Create Assignment Modal */
  .modal-title {
    font-size: 1.1rem;
    font-weight: 800;
    color: var(--text-color, #1e293b);
    margin: 0 0 0.15rem;
  }

  .modal-subtitle {
    font-size: 0.8rem;
    color: #94a3b8;
    margin: 0;
    font-weight: 600;
  }

  .create-form {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .form-section {
    padding: 1.25rem 0;
    border-bottom: 1px solid var(--card-border, #f1f5f9);
  }

  .form-section:last-of-type {
    border-bottom: none;
  }

  .section-label {
    font-size: 0.7rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #94a3b8;
    margin: 0 0 0.75rem;
  }

  .optional-label {
    font-weight: 600;
    text-transform: none;
    letter-spacing: 0;
    color: #cbd5e1;
  }

  /* Mode selector */
  .mode-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
  }

  @media (max-width: 520px) {
    .mode-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .mode-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    padding: 0.6rem 0.4rem;
    border-radius: 0.75rem;
    border: 2px solid var(--card-border, #e5e7eb);
    background: var(--input-bg, #f8fafc);
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }

  .mode-btn:hover {
    border-color: #94a3b8;
    background: var(--card-bg, #fff);
  }

  .mode-btn.mode-active {
    border-color: #22c55e;
    background: #f0fdf4;
    box-shadow: 0 2px 0 #16a34a22;
  }

  :global(html[data-theme='dark']) .mode-btn.mode-active {
    background: #14532d44;
  }

  .mode-icon {
    font-size: 1.2rem;
    line-height: 1;
  }

  .mode-label-text {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-color, #475569);
    text-align: center;
    line-height: 1.2;
  }

  /* Quiz picker */
  .empty-hint {
    font-size: 0.85rem;
    color: #64748b;
    margin: 0;
  }

  .empty-hint a {
    color: #3b82f6;
    font-weight: 700;
  }

  .quiz-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    max-height: 180px;
    overflow-y: auto;
  }

  .quiz-option {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 0.9rem;
    border-radius: 0.75rem;
    border: 2px solid var(--card-border, #e5e7eb);
    cursor: pointer;
    transition: all 0.15s;
    background: var(--input-bg, #f8fafc);
  }

  .quiz-option input[type='radio'] {
    display: none;
  }

  .quiz-option:hover {
    border-color: #94a3b8;
  }

  .quiz-option.quiz-selected {
    border-color: #22c55e;
    background: #f0fdf4;
  }

  .quiz-option-info {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    flex: 1;
    min-width: 0;
  }

  .quiz-option-title {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--text-color, #1e293b);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .quiz-option-meta {
    font-size: 0.72rem;
    color: #94a3b8;
    font-weight: 600;
  }

  .quiz-check {
    color: #16a34a;
    font-weight: 900;
    font-size: 1rem;
    flex-shrink: 0;
  }

  /* Settings row */
  .settings-row {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    align-items: flex-end;
  }

  .settings-row .field {
    flex: 1;
    min-width: 100px;
  }

  .threshold-input {
    display: flex;
    align-items: center;
    gap: 0;
    border: 2px solid var(--card-border, #e5e7eb);
    border-radius: 1rem;
    overflow: hidden;
    background: var(--input-bg, #fff);
    transition: border-color 0.2s;
  }

  .threshold-input:focus-within {
    border-color: #22c55e;
  }

  .threshold-input input {
    border: none !important;
    border-radius: 0 !important;
    flex: 1;
    min-width: 0;
  }

  .threshold-pct {
    padding: 0 0.75rem;
    font-size: 0.9rem;
    font-weight: 800;
    color: #94a3b8;
    background: var(--input-bg, #f8fafc);
    border-left: 2px solid var(--card-border, #e5e7eb);
    height: 100%;
    display: flex;
    align-items: center;
  }

  /* Shared field styles */
  .create-form-row {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  @media (min-width: 560px) {
    .create-form-row {
      grid-template-columns: 1fr 1fr;
    }
  }

  .field label,
  .field-label {
    display: block;
    font-size: 0.72rem;
    font-weight: 800;
    color: #64748b;
    margin-bottom: 0.35rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .required {
    color: #ef4444;
  }

  .field input,
  .field select {
    width: 100%;
    padding: 0.65rem 0.9rem;
    border-radius: 0.75rem;
    border: 2px solid var(--card-border, #e5e7eb);
    background-color: var(--input-bg, #ffffff);
    color: var(--text-color, #1e293b);
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 700;
    transition: border-color 0.2s;
    box-sizing: border-box;
    outline: none;
  }

  .field input:focus,
  .field select:focus {
    border-color: #22c55e;
  }

  .vocab-input-container {
    background-color: var(--input-bg, #ffffff);
    border: 2px solid var(--card-border, #e5e7eb);
    border-radius: 0.75rem;
    padding: 0.4rem 0.6rem;
    min-height: 42px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem;
    transition: border-color 0.2s;
  }

  .vocab-input-container:focus-within {
    border-color: #22c55e;
  }

  .vocab-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    width: 100%;
  }

  .vocab-tag {
    background-color: #e0f2fe;
    color: #0369a1;
    padding: 0.2rem 0.5rem;
    border-radius: 0.5rem;
    font-size: 0.8rem;
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
    min-width: 100px;
    border: none !important;
    padding: 0.2rem !important;
    font-size: 0.9rem !important;
    border-radius: 0 !important;
    background: transparent !important;
  }

  .vocab-inline-input:focus {
    box-shadow: none !important;
  }

  .grammar-rules-field {
    margin-top: 0.75rem;
  }

  .grammar-rules-container {
    border: 2px solid var(--card-border, #e5e7eb);
    border-radius: 0.75rem;
    overflow: hidden;
    background: var(--input-bg, #ffffff);
  }

  .grammar-search {
    padding: 0.4rem;
    border-bottom: 1px solid var(--card-border, #e5e7eb);
  }

  .grammar-search-input {
    width: 100%;
    padding: 0.4rem 0.75rem !important;
    border: 1px solid var(--card-border, #e5e7eb) !important;
    border-radius: 0.5rem !important;
    font-size: 0.85rem !important;
    background-color: var(--input-bg, #ffffff);
    color: var(--input-text, #0f172a);
  }

  .grammar-search-input::placeholder {
    color: #94a3b8;
  }

  :global(html[data-theme='dark']) .grammar-search-input::placeholder {
    color: #4a5260;
  }

  :global(html[data-theme='dark']) .vocab-inline-input {
    color: var(--input-text, #e2e8f0);
  }

  .grammar-rules-list {
    max-height: 180px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .grammar-rule-item {
    display: flex;
    align-items: center;
    padding: 0.6rem 0.9rem;
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
    font-size: 0.85rem;
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

  /* Assignments List */
  .assignments-list {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .assignment-card {
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
    border-radius: 1rem;
    padding: 1.25rem 1.5rem;
  }

  .assignment-card:hover {
    transform: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 0.5rem;
  }

  .assignment-title-row h4 {
    font-size: 1.1rem;
    color: var(--text-color, #1e293b);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .badge {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
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
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .assignment-start-container {
    margin-top: 1.5rem;
    display: flex;
  }

  .assignment-start-container .btn-duo {
    padding-left: 2.5rem;
    padding-right: 2.5rem;
    font-size: 1rem !important;
  }

  .meta-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.65rem;
    border-radius: 0.5rem;
    font-size: 0.75rem;
    font-weight: 700;
    box-shadow: 0 2px 0 var(--card-border, #e2e8f0);
    border: 1px solid var(--card-border, #e2e8f0);
    background-color: var(--card-bg, #ffffff);
  }

  .meta-icon {
    width: 1rem;
    height: 1rem;
    opacity: 0.7;
  }

  .mode-tag {
    color: #475569;
    background-color: #f8fafc;
    border: 1px solid var(--card-border, #e2e8f0);
    box-shadow: none;
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .score-tag {
    color: #64748b;
  }

  .due-tag {
    color: #ef4444;
    border-color: #fecaca;
    background-color: #fef2f2;
    box-shadow: 0 2px 0 #fecaca;
  }

  .progress-tag {
    color: #8b5cf6;
    border-color: #ddd6fe;
    background-color: #faf5ff;
    box-shadow: 0 2px 0 #ddd6fe;
  }

  .assignment-title {
    font-size: 1.25rem !important;
    font-weight: 800;
    color: #1e293b;
  }

  .assignment-play-btn {
    white-space: nowrap;
    flex-shrink: 0;
    padding: 0.45rem 1rem !important;
    font-size: 0.8rem !important;
  }

  .btn-copy {
    background-color: transparent;
    color: #64748b;
    border-color: var(--card-border, #e2e8f0);
    box-shadow: none;
  }

  .btn-copy:hover {
    background-color: var(--card-bg, #f1f5f9);
    transform: none;
  }

  .btn-copy:active {
    transform: scale(0.98);
    box-shadow: none;
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
    background: rgba(15, 23, 42, 0.65);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
    box-sizing: border-box;
  }

  .modal-content {
    width: 100%;
    max-width: 580px;
    max-height: 88vh;
    overflow-y: auto;
    background: var(--card-bg, #ffffff);
    padding: 1.5rem;
    border-radius: 1.5rem;
    position: relative;
    box-shadow:
      0 20px 60px -10px rgba(0, 0, 0, 0.25),
      0 4px 0 var(--card-border, #e2e8f0);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid var(--card-border, #f1f5f9);
    margin-bottom: 0;
  }

  .btn-close {
    background: var(--input-bg, #f1f5f9);
    border: none;
    font-size: 1.1rem;
    line-height: 1;
    color: #64748b;
    cursor: pointer;
    padding: 0.35rem 0.55rem;
    border-radius: 0.5rem;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .btn-close:hover {
    background: #e2e8f0;
    color: #0f172a;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #475569;
    cursor: pointer;
    padding: 0.5rem 0;
  }

  .toggle-row input[type='checkbox'] {
    width: 1rem;
    height: 1rem;
    accent-color: #3b82f6;
    cursor: pointer;
    flex-shrink: 0;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding-top: 1.25rem;
    margin-top: 0.25rem;
    border-top: 1px solid var(--card-border, #f1f5f9);
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

  /* Dark mode overrides for assignment creation modal */
  :global(html[data-theme='dark']) .btn-close {
    color: #94a3b8;
  }

  :global(html[data-theme='dark']) .btn-close:hover {
    background: #3a4150;
    color: #e2e8f0;
  }

  :global(html[data-theme='dark']) .field label,
  :global(html[data-theme='dark']) .field-label {
    color: #94a3b8;
  }

  :global(html[data-theme='dark']) .mode-btn:hover {
    background: var(--card-bg, #21252e);
  }

  :global(html[data-theme='dark']) .empty-hint {
    color: #94a3b8;
  }

  :global(html[data-theme='dark']) .quiz-option.quiz-selected {
    background: rgba(20, 83, 45, 0.25);
  }

  :global(html[data-theme='dark']) .grammar-rules-container {
    background: var(--input-bg, #2a303c);
  }

  :global(html[data-theme='dark']) .grammar-rule-item {
    border-bottom-color: #2d3340;
  }

  :global(html[data-theme='dark']) .grammar-rule-item:hover {
    background-color: #2a303c;
  }

  :global(html[data-theme='dark']) .grammar-rule-item.selected {
    background-color: rgba(20, 83, 45, 0.25);
  }

  :global(html[data-theme='dark']) .grammar-rule-title {
    color: #e2e8f0;
  }

  :global(html[data-theme='dark']) .no-grammar-rules {
    color: #94a3b8;
  }

  :global(html[data-theme='dark']) .vocab-tag {
    background-color: rgba(3, 105, 161, 0.25);
    color: #7dd3fc;
  }

  :global(html[data-theme='dark']) .remove-vocab {
    color: #7dd3fc;
  }

  :global(html[data-theme='dark']) .remove-vocab:hover {
    color: #bae6fd;
  }

  :global(html[data-theme='dark']) .action-promote:hover {
    background-color: rgba(59, 130, 246, 0.15);
  }

  :global(html[data-theme='dark']) .action-remove:hover {
    background-color: rgba(239, 68, 68, 0.15);
  }

  :global(html[data-theme='dark']) .member-avatar {
    background-color: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.3);
  }
</style>

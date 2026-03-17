<script lang="ts">
  import type { PageData } from './$types';
  import { fly } from 'svelte/transition';
  import toast from 'svelte-french-toast';
  import { toastError } from '$lib/utils/toast';
  import { modal } from '$lib/modal.svelte';

  let { data }: { data: PageData } = $props();

  let assignment = $derived(data.assignment);
  let classDetails = $derived(data.classDetails);

  // Only consider student members for progress tracking
  let studentMembers = $derived(classDetails.members.filter((m: any) => m.role === 'STUDENT'));

  function getScoreForUser(userId: string) {
    return assignment.scores.find((s: any) => s.userId === userId);
  }

  let totalStudents = $derived(studentMembers.length);
  let passedStudents = $derived(
    studentMembers.filter((m: any) => getScoreForUser(m.userId)?.passed).length
  );
  let passPercentage = $derived(
    totalStudents > 0 ? Math.round((passedStudents / totalStudents) * 100) : 0
  );

  let copied = $state(false);

  async function copyLink() {
    const url = `${window.location.origin}/play?assignmentId=${assignment.id}`;
    await navigator.clipboard.writeText(url);
    copied = true;
    setTimeout(() => {
      copied = false;
    }, 2000);
  }

  async function handleDeleteAssignment() {
    if (!(await modal.confirm('Are you sure you want to delete this assignment?'))) return;
    try {
      const res = await fetch(`/api/classes/${classDetails.id}/assignments/${assignment.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast.success('Assignment deleted');
        window.location.href = `/classes/${classDetails.id}`;
      } else {
        const result = await res.json();
        toast.error(result.error || 'Failed to delete assignment.');
      }
    } catch (_) {
      toast.error('An error occurred.');
    }
  }

  import { invalidateAll } from '$app/navigation';
  import SpecialCharKeyboard from '$lib/components/SpecialCharKeyboard.svelte';

  // Edit Assignment
  let showEditModal = $state(false);
  let editTitle = $state('');
  let editDescription = $state('');
  let editMode = $state('multiple-choice');
  let editTargetScore = $state(10);
  let editPassThreshold = $state(50);
  let editDisableHoverTranslation = $state(false);
  let editLanguage = $state('');
  let editTargetCefrLevel = $state('');
  let editTopic = $state('');
  let selectedGrammarRules: string[] = $state([]);
  let targetVocabList: string[] = $state([]);
  let vocabInput = $state('');
  let vocabInputRef = $state<HTMLInputElement | undefined>(undefined);
  let grammarSearchQuery = $state('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let editGameId = $state('');
  let isSaving = $state(false);

  let currentLang = $derived(data.languages?.find((l: any) => l.code === editLanguage));
  let availableRules = $derived(currentLang ? currentLang.grammarRules : []);

  function openEditModal() {
    editTitle = assignment.title;
    editDescription = assignment.description || '';
    editMode = assignment.gamemode || 'multiple-choice';
    editTargetScore = assignment.targetScore || 10;
    editPassThreshold = assignment.passThreshold || 50;
    editLanguage = assignment.language || data.classDetails.primaryLanguage;
    editTargetCefrLevel = assignment.targetCefrLevel || '';
    editTopic = assignment.topic || '';
    selectedGrammarRules = assignment.targetGrammar ? [...assignment.targetGrammar] : [];
    targetVocabList = assignment.targetVocab ? [...assignment.targetVocab] : [];
    vocabInput = '';
    grammarSearchQuery = '';
    editGameId = assignment.gameId || '';
    editDisableHoverTranslation = assignment.disableHoverTranslation ?? false;
    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
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

  async function handleSaveEdit() {
    if (!editTitle.trim()) {
      toastError('Title is required');
      return;
    }
    if (isSaving) return;

    isSaving = true;
    try {
      const res = await fetch(`/api/classes/${classDetails.id}/assignments/${assignment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription || undefined,
          gamemode: editMode,
          targetScore: editTargetScore,
          passThreshold: editPassThreshold,
          language: editLanguage,
          targetCefrLevel: editTargetCefrLevel || undefined,
          topic: editTopic || undefined,
          targetGrammar: selectedGrammarRules.length > 0 ? selectedGrammarRules : [],
          targetVocab: targetVocabList.length > 0 ? targetVocabList : [],
          disableHoverTranslation: editDisableHoverTranslation
        })
      });

      if (res.ok) {
        toast.success('Assignment updated');
        closeEditModal();
        await invalidateAll();
      } else {
        const result = await res.json();
        toastError(result.error || 'Failed to update assignment');
      }
    } catch (_) {
      toastError('An error occurred');
    } finally {
      isSaving = false;
    }
  }
</script>

<svelte:head>
  <title>{assignment.title} Progress - {classDetails.name}</title>
</svelte:head>

<div class="assignment-container">
  <!-- Header Banner -->
  <div class="assignment-banner" in:fly={{ y: 20, duration: 400 }}>
    <div class="banner-info">
      <nav class="breadcrumb">
        <a href="/classes">Classes</a>
        <span class="breadcrumb-sep">/</span>
        <a href="/classes/{classDetails.id}">{classDetails.name}</a>
        <span class="breadcrumb-sep">/</span>
        <span class="breadcrumb-current">{assignment.title}</span>
      </nav>
      <h1>{assignment.title}</h1>
      {#if assignment.description}
        <p class="banner-desc">{assignment.description}</p>
      {/if}
      <div class="assignment-meta">
        <span class="meta-tag">{assignment.gamemode.replace(/-/g, ' ')}</span>
        <span class="meta-sep">&bull;</span>
        <span>Target Score: {assignment.targetScore}</span>
      </div>
      <div class="banner-actions">
        <button type="button" class="copy-link-btn" onclick={copyLink}>
          {#if copied}✓ Copied!{:else}🔗 Copy Link{/if}
        </button>
        <button type="button" class="edit-btn" onclick={openEditModal}> Edit </button>
        <button type="button" class="delete-btn" onclick={handleDeleteAssignment}> Delete </button>
      </div>
    </div>
    <div class="pass-rate-box">
      <p class="pass-rate-label">Pass Rate</p>
      <div class="pass-rate-value">{passPercentage}%</div>
      <p class="pass-rate-sub">{passedStudents} of {totalStudents} passed</p>
    </div>
  </div>

  <!-- Student Progress (#6) -->
  <div in:fly={{ y: 20, duration: 400, delay: 100 }}>
    <div class="section-header-row">
      <h2 class="section-title">Student Progress</h2>
      {#if studentMembers.length > 0}
        <div class="section-stats">
          <span class="section-stat passed">{passedStudents} passed</span>
          <span class="section-stat-sep">&bull;</span>
          <span class="section-stat in-progress"
            >{studentMembers.filter((m: any) => {
              const s = getScoreForUser(m.userId);
              return s && !s.passed;
            }).length} in progress</span
          >
          <span class="section-stat-sep">&bull;</span>
          <span class="section-stat not-started"
            >{studentMembers.filter((m: any) => !getScoreForUser(m.userId)).length} not started</span
          >
        </div>
      {/if}
    </div>

    {#if studentMembers.length === 0}
      <div class="empty-state">
        <div class="empty-icon">👥</div>
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
            {@const pct = scoreInfo
              ? Math.min(100, Math.round((scoreInfo.score / assignment.targetScore) * 100))
              : 0}
            <li class="member-row">
              <div class="member-info">
                <div
                  class="member-avatar"
                  class:avatar-passed={isPassed}
                  class:avatar-progress={hasStarted && !isPassed}
                >
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
                {:else}
                  <div class="score-block">
                    <div class="score-top">
                      {#if isPassed}
                        <span class="score-check">&#10003;</span>
                      {/if}
                      <span
                        class="score-value"
                        class:score-passed-text={isPassed}
                        class:score-amber={!isPassed}
                      >
                        {scoreInfo.score}<span class="score-denom">/{assignment.targetScore}</span>
                      </span>
                      <span
                        class="badge"
                        class:badge-green={isPassed}
                        class:badge-amber={!isPassed}
                      >
                        {isPassed ? 'Passed' : 'In Progress'}
                      </span>
                    </div>
                    <div class="score-bar-track">
                      <div
                        class="score-bar-fill"
                        class:fill-passed={isPassed}
                        class:fill-progress={!isPassed}
                        style="width: {pct}%"
                      ></div>
                    </div>
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

{#if showEditModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-backdrop"
    onclick={closeEditModal}
    transition:fly={{ duration: 200, opacity: 0 }}
  >
    <div class="modal-content card-duo" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3 class="modal-title">Edit Assignment</h3>
        <button class="btn-close" onclick={closeEditModal}>&times;</button>
      </div>

      <form
        onsubmit={(e) => {
          e.preventDefault();
          handleSaveEdit();
        }}
        class="create-form"
      >
        <div class="create-form-row">
          <div class="field">
            <label for="title">Title <span class="required">*</span></label>
            <input
              type="text"
              id="title"
              bind:value={editTitle}
              placeholder="e.g. Verb practice week 3"
              required
            />
          </div>
          <div class="field">
            <label for="desc">Description (optional)</label>
            <input
              type="text"
              id="desc"
              bind:value={editDescription}
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
              bind:value={editTopic}
              placeholder="e.g. Ordering food, Traveling"
            />
          </div>
          <div class="field">
            <label for="vocab">Target Vocabulary (optional)</label>
            <SpecialCharKeyboard
              bind:value={vocabInput}
              inputElement={vocabInputRef}
              language={editLanguage}
            />
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
                  bind:this={vocabInputRef}
                  bind:value={vocabInput}
                  onkeydown={handleVocabKeydown}
                  placeholder={targetVocabList.length === 0 ? 'Type a word and press Enter' : ''}
                  class="vocab-inline-input"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="field grammar-rules-field">
          <span class="field-label">Target Grammar Rules (optional)</span>
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

        <div class="create-form-bottom">
          <div class="field">
            <label for="gamemode">Game Mode</label>
            <select id="gamemode" bind:value={editMode}>
              <option value="multiple-choice">Multiple Choice</option>
              <option value="native-to-target">Native to Target</option>
              <option value="target-to-native">Target to Native</option>
              <option value="fill-blank">Fill in the Blank</option>
              <option value="chat">Chat</option>
              <option value="immerse">Immerse</option>
            </select>
          </div>
          <div class="field field-small">
            <label for="language">Language</label>
            <select id="language" bind:value={editLanguage}>
              <option value="international">International</option>
              <option value="de">German</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
            </select>
          </div>
          <div class="field field-small">
            <label for="targetCefrLevel">CEFR Level</label>
            <select id="targetCefrLevel" bind:value={editTargetCefrLevel}>
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
              {#if editMode === 'chat'}
                Target Turns
              {:else if editMode === 'immerse'}
                Target Questions
              {:else}
                Pass Score
              {/if}
            </label>
            <input type="number" id="targetScore" bind:value={editTargetScore} min="1" max="100" />
            {#if editMode === 'chat'}
              <span style="font-size: 0.7rem; color: #64748b; margin-top: 0.25rem; display: block;"
                >Number of turns for chat</span
              >
            {:else if editMode === 'immerse'}
              <span style="font-size: 0.7rem; color: #64748b; margin-top: 0.25rem; display: block;"
                >Number of correct answers to pass</span
              >
            {/if}
          </div>
          <div class="field field-small">
            <label for="passThreshold">Threshold (%)</label>
            <input
              type="number"
              id="passThreshold"
              bind:value={editPassThreshold}
              min="1"
              max="100"
            />
          </div>
        </div>

        <label class="toggle-row">
          <input type="checkbox" bind:checked={editDisableHoverTranslation} />
          <span>Disable hover translation for students</span>
        </label>

        <div class="modal-actions">
          <button type="button" class="btn-secondary" onclick={closeEditModal}> Cancel </button>
          <button type="submit" disabled={isSaving} class="btn-primary">
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

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

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-bottom: 0.75rem;
    font-size: 0.8rem;
    letter-spacing: 0.02em;
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
    color: #6b7280;
  }

  .breadcrumb-current {
    color: #9ca3af;
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

  .banner-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
    align-items: center;
  }

  .copy-link-btn,
  .edit-btn,
  .delete-btn {
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
    transition:
      background 0.15s,
      border-color 0.15s;
  }

  .copy-link-btn:hover,
  .edit-btn:hover {
    background: rgba(255, 255, 255, 0.25);
    border-color: rgba(255, 255, 255, 0.5);
  }

  .delete-btn {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
  }

  .delete-btn:hover {
    background: rgba(239, 68, 68, 0.4);
    border-color: rgba(239, 68, 68, 0.6);
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

  /* Section Header */
  .section-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.5rem;
    border-bottom: 2px solid var(--card-border, #e2e8f0);
    padding-bottom: 0.75rem;
    flex-wrap: wrap;
  }

  .section-title {
    font-size: 1.5rem;
    color: var(--text-color, #0f172a);
    margin: 0;
  }

  .section-stats {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .section-stat {
    font-weight: 700;
  }
  .section-stat.passed {
    color: #16a34a;
  }
  .section-stat.in-progress {
    color: #d97706;
  }
  .section-stat.not-started {
    color: #94a3b8;
  }
  .section-stat-sep {
    color: #cbd5e1;
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
    transition:
      background-color 0.2s,
      border-color 0.2s;
  }

  .member-avatar.avatar-passed {
    background-color: #dcfce7;
    color: #16a34a;
    border-color: #86efac;
  }

  .member-avatar.avatar-progress {
    background-color: #fef3c7;
    color: #d97706;
    border-color: #fde68a;
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

  .score-block {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.35rem;
    min-width: 140px;
  }

  .score-top {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .score-passed-text {
    color: #16a34a;
  }

  .score-bar-track {
    width: 100%;
    height: 4px;
    background: var(--card-border, #e2e8f0);
    border-radius: 9999px;
    overflow: hidden;
  }

  .score-bar-fill {
    height: 100%;
    border-radius: 9999px;
    transition: width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .fill-passed {
    background: #16a34a;
  }
  .fill-progress {
    background: #f59e0b;
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
    padding: 3.5rem 2rem;
    background: var(--card-bg, #f8fafc);
    border-radius: 1.5rem;
    border: 3px dashed var(--card-border, #cbd5e1);
  }

  .empty-icon {
    font-size: 2.75rem;
    margin-bottom: 0.75rem;
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

  /* Modal Styles */
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
    max-width: 800px;
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

  .modal-title {
    font-size: 1.25rem;
    color: var(--text-color, #1e293b);
    margin: 0;
    font-weight: 800;
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

  .field label,
  .field-label {
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
    gap: 1rem;
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 2px solid var(--card-border, #e2e8f0);
  }

  .btn-primary,
  .btn-secondary {
    padding: 0.6rem 1.25rem;
    border-radius: 0.75rem;
    font-weight: 800;
    font-size: 0.9rem;
    cursor: pointer;
    border: none;
    font-family: inherit;
  }

  .btn-primary {
    background-color: #3b82f6;
    color: white;
    box-shadow: 0 4px 0 #2563eb;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: #2563eb;
    transform: translateY(-2px);
    box-shadow: 0 6px 0 #1d4ed8;
  }

  .btn-primary:active:not(:disabled) {
    transform: translateY(2px);
    box-shadow: 0 2px 0 #1d4ed8;
  }

  .btn-secondary {
    background-color: #f1f5f9;
    color: #475569;
    box-shadow: 0 4px 0 #cbd5e1;
  }

  .btn-secondary:hover {
    background-color: #e2e8f0;
    transform: translateY(-2px);
    box-shadow: 0 6px 0 #94a3b8;
  }

  .btn-secondary:active {
    transform: translateY(2px);
    box-shadow: 0 2px 0 #94a3b8;
  }

  button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
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

  /* Dark mode */
  :global(html[data-theme='dark']) .btn-secondary {
    background-color: #2a303c;
    color: #94a3b8;
    box-shadow: 0 4px 0 #3a4150;
  }

  :global(html[data-theme='dark']) .btn-secondary:hover {
    background-color: #3a4150;
    box-shadow: 0 6px 0 #3a4150;
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
</style>

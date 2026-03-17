<script lang="ts">
  import type { PageData } from './$types';
  import { fly, slide } from 'svelte/transition';
  import { marked } from 'marked';
  import { onMount } from 'svelte';

  let { data }: { data: PageData } = $props();

  // SrsState enum values from Prisma schema
  const srsColors = {
    LOCKED: 'var(--color-locked, #94a3b8)', // gray-400
    UNSEEN: 'var(--color-unseen, #e2e8f0)', // gray-200
    LEARNING: 'var(--color-learning, #fef08a)', // yellow-200
    KNOWN: 'var(--color-known, #6ee7b7)', // emerald-300
    MASTERED: 'var(--color-mastered, #10b981)' // emerald-500
  };

  let grammarSortOrder = $state<'easiest' | 'hardest'>('easiest');
  let grammarView = $state<'web' | 'list'>('web');

  let sortedRules = $derived(
    (() => {
      const rules = data.allGrammarRules || [];
      const sorted: any[] = [];
      const visited = new Set<string>();
      const visiting = new Set<string>();
      function visit(rule: any) {
        if (visited.has(rule.id)) return;
        if (visiting.has(rule.id)) return;
        visiting.add(rule.id);
        for (const dep of rule.dependencies || []) {
          const depRule = rules.find((r: any) => r.id === dep.id);
          if (depRule) visit(depRule);
        }
        visiting.delete(rule.id);
        visited.add(rule.id);
        sorted.push(rule);
      }
      for (const rule of rules) visit(rule);
      return grammarSortOrder === 'hardest' ? sorted.reverse() : sorted;
    })()
  );

  // Merge user progress with all possible rules
  let grammarWebNodes = $derived(
    sortedRules.map((rule: any) => {
      const userProgress = data.grammarRules.find((ur: any) => ur.grammarRuleId === rule.id);
      const prereqsMet =
        (rule.dependencies || []).length === 0 ||
        (rule.dependencies || []).every((dep: any) => {
          const depProgress = data.grammarRules.find((ur: any) => ur.grammarRuleId === dep.id);
          return depProgress?.srsState === 'MASTERED';
        });
      return {
        ...userProgress,
        grammarRule: rule,
        srsState: userProgress?.srsState || (prereqsMet ? 'UNSEEN' : 'LOCKED'),
        eloRating: userProgress?.eloRating || 1000,
        isLocked: !prereqsMet
      };
    })
  );

  // Summary Statistics Calculations
  let totalVocab = $derived(data.vocabularies.length);
  let vocabSrsBreakdown = $derived(
    data.vocabularies.reduce(
      (acc, v) => {
        acc[v.srsState] = (acc[v.srsState] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    )
  );

  let grammarSrsBreakdown = $derived(
    data.grammarRules.reduce(
      (acc, r) => {
        acc[r.srsState] = (acc[r.srsState] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    )
  );

  // Modal navigation stack - supports drilling into prerequisite modals
  let modalStack = $state<
    Array<{
      type: 'vocab' | 'grammar';
      data: any;
      color: string;
      eloPercent: number;
    }>
  >([]);
  let selectedModalItem = $derived(
    modalStack.length > 0 ? modalStack[modalStack.length - 1] : null
  );

  // Test-out state
  let grammarModalPhase = $state<'detail' | 'testing' | 'results'>('detail');
  let testOutQuestions = $state<any[] | null>(null);
  let testOutCurrentIndex = $state(0);
  let testOutSelectedAnswer = $state<number | null>(null);
  let testOutAnsweredCurrent = $state(false);
  let testOutScores = $state<boolean[]>([]);
  let testOutLoading = $state(false);
  let testOutError = $state<string | null>(null);
  let testOutMastering = $state(false);
  let testOutMasteryDone = $state(false);

  let testOutPassedCount = $derived(testOutScores.filter(Boolean).length);
  let testOutTotalQuestions = $derived(testOutQuestions?.length || 10);
  let testOutPassed = $derived(
    testOutScores.length === testOutTotalQuestions && testOutPassedCount >= 9
  );

  function resetTestOut() {
    testOutQuestions = null;
    testOutCurrentIndex = 0;
    testOutSelectedAnswer = null;
    testOutAnsweredCurrent = false;
    testOutScores = [];
    testOutLoading = false;
    testOutError = null;
    testOutMastering = false;
    testOutMasteryDone = false;
  }

  function openVocabModal(vocab: any, color: string, eloPercent: number) {
    modalStack = [{ type: 'vocab', data: vocab, color, eloPercent }];
    grammarModalPhase = 'detail';
    resetTestOut();
  }

  function openGrammarModal(rule: any, color: string, eloPercent: number) {
    modalStack = [{ type: 'grammar', data: rule, color, eloPercent }];
    grammarModalPhase = 'detail';
    resetTestOut();
  }

  function navigateToPrereq(ruleId: string) {
    const node = grammarWebNodes.find((n: any) => n.grammarRule.id === ruleId);
    if (!node) return;
    const srsColor = (srsColors as any)[node.srsState] || srsColors.LOCKED;
    const eloPercent = node.isLocked
      ? 0
      : Math.max(
          0,
          Math.min(
            100,
            node.srsState === 'LEARNING'
              ? ((node.eloRating - 1000) / 50) * 100
              : node.srsState === 'KNOWN'
                ? ((node.eloRating - 1050) / 100) * 100
                : node.srsState === 'MASTERED'
                  ? 100
                  : 0
          )
        );
    modalStack = [...modalStack, { type: 'grammar', data: node, color: srsColor, eloPercent }];
    grammarModalPhase = 'detail';
    resetTestOut();
  }

  function goBack() {
    if (grammarModalPhase !== 'detail') {
      grammarModalPhase = 'detail';
      resetTestOut();
    } else if (modalStack.length > 1) {
      modalStack = modalStack.slice(0, -1);
    }
  }

  function closeModal() {
    modalStack = [];
    grammarModalPhase = 'detail';
    resetTestOut();
  }

  async function startTestOut(ruleId: string) {
    grammarModalPhase = 'testing';
    testOutLoading = true;
    testOutError = null;
    testOutQuestions = null;
    testOutCurrentIndex = 0;
    testOutSelectedAnswer = null;
    testOutAnsweredCurrent = false;
    testOutScores = [];
    try {
      const res = await fetch(`/api/grammar/${ruleId}/test-out`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        testOutError = err.error || 'Failed to generate questions.';
        grammarModalPhase = 'detail';
        return;
      }
      const responseData = await res.json();
      testOutQuestions = responseData.questions;
    } catch {
      testOutError = 'Failed to generate questions. Please try again.';
      grammarModalPhase = 'detail';
    } finally {
      testOutLoading = false;
    }
  }

  function handleTestAnswer(optionIndex: number) {
    if (testOutAnsweredCurrent || !testOutQuestions) return;
    testOutSelectedAnswer = optionIndex;
    testOutAnsweredCurrent = true;
    const correct = optionIndex === testOutQuestions[testOutCurrentIndex].correctIndex;
    testOutScores = [...testOutScores, correct];
  }

  function nextTestQuestion() {
    if (!testOutQuestions) return;
    const wrongCount = testOutScores.filter((s) => !s).length;
    if (testOutCurrentIndex >= testOutQuestions.length - 1 || wrongCount >= 2) {
      grammarModalPhase = 'results';
    } else {
      testOutCurrentIndex++;
      testOutSelectedAnswer = null;
      testOutAnsweredCurrent = false;
    }
  }

  async function submitMastery(ruleId: string) {
    testOutMastering = true;
    testOutError = null;
    try {
      const res = await fetch(`/api/grammar/${ruleId}/master`, { method: 'POST' });
      if (res.ok) {
        testOutMasteryDone = true;
        // Update local data to reflect mastery and trigger reactivity in grammarWebNodes
        const existing = data.grammarRules.find((r: any) => r.grammarRuleId === ruleId);
        if (existing) {
          data = {
            ...data,
            grammarRules: data.grammarRules.map((r: any) =>
              r.grammarRuleId === ruleId ? { ...r, srsState: 'MASTERED', eloRating: 1200 } : r
            )
          };
        } else {
          // Create a new grammar rule progress entry with the full structure
          const newGrammarRule = data.allGrammarRules.find((r: any) => r.id === ruleId);
          if (newGrammarRule) {
            data = {
              ...data,
              grammarRules: [
                ...data.grammarRules,
                {
                  id: `temp-${ruleId}`,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  userId: data.user?.id || '',
                  grammarRuleId: ruleId,
                  srsState: 'MASTERED' as const,
                  eloRating: 1200,
                  nextReviewDate: null,
                  grammarRule: newGrammarRule
                } as any
              ]
            };
          }
        }
        // Update the modal stack entry so the detail view reflects mastery
        modalStack = modalStack.map((item, i) => {
          if (
            i === modalStack.length - 1 &&
            item.type === 'grammar' &&
            item.data.grammarRule?.id === ruleId
          ) {
            return {
              ...item,
              data: { ...item.data, srsState: 'MASTERED', isLocked: false },
              color: srsColors.MASTERED
            };
          }
          return item;
        });
      } else {
        const err = await res.json();
        testOutError = err.error || 'Failed to mark as mastered.';
      }
    } catch {
      testOutError = 'Failed to mark as mastered. Please try again.';
    } finally {
      testOutMastering = false;
    }
  }

  onMount(() => {
    if (window.innerWidth < 640) grammarView = 'list';
  });

  function getPrerequisiteProgress(rule: any) {
    const deps = rule.grammarRule?.dependencies || [];
    return deps.map((dep: any) => {
      const node = grammarWebNodes.find((n: any) => n.grammarRule.id === dep.id);
      const srsState = node?.srsState || 'LOCKED';
      const isComplete = srsState === 'KNOWN' || srsState === 'MASTERED';
      const elo = node?.eloRating || 1000;
      const percent =
        srsState === 'MASTERED'
          ? 100
          : srsState === 'KNOWN'
            ? Math.max(0, Math.min(100, ((elo - 1050) / 100) * 100))
            : srsState === 'LEARNING'
              ? Math.max(0, Math.min(100, ((elo - 1000) / 50) * 100))
              : 0;
      return {
        id: dep.id,
        title: dep.title,
        srsState,
        isComplete,
        percent,
        color: (srsColors as any)[srsState] || srsColors.LOCKED
      };
    });
  }

  // Collapsible section states
  let showMemoryHealth = $state(false);
  let showInsights = $state(false);
  let showIntelligence = $state(false);
</script>

<div class="dashboard-container">
  <header class="dashboard-header" in:fly={{ y: 20, duration: 400 }}>
    <h1>Proficiency Dashboard</h1>
    <p>Track your language learning progress.</p>

    {#if (data as any).cefrProgress}
      {@const cp = (data as any).cefrProgress}
      <div class="cefr-progress-container">
        <div class="cefr-labels">
          <span class="current-level">{cp.currentLevel}</span>
          <span class="next-level">{cp.nextLevel || 'MAX'}</span>
        </div>
        <div class="cefr-bar-track">
          <div class="cefr-bar-fill" style="width: {cp.percentComplete}%">
            <span class="cefr-percent">{cp.percentComplete}%</span>
          </div>
        </div>
        <p class="cefr-subtext">Overall Progress to {cp.nextLevel || 'Mastery'}</p>
      </div>
    {/if}

    <div class="header-actions">
      <a href="/play" class="btn-duo btn-primary">Start Lesson</a>
      {#if data.dueReviewCount > 0}
        <a href="/review" class="btn-duo btn-secondary">Review ({data.dueReviewCount})</a>
      {/if}
      <a href="/play?tab=games" class="btn-duo btn-secondary">Play a Quiz</a>
      <a href="/onboarding" class="redo-onboarding-link">redo onboarding</a>
      {#if (data as any).activeLiveSessions?.length > 0}
        {@const session = (data as any).activeLiveSessions[0]}
        <a href="/classes/{session.classId}/live/student" class="btn-duo btn-live">
          <span class="live-pulse" aria-hidden="true"></span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3" /></svg
          >
          Join Live Session
          <span class="live-class-name">{session.class.name}</span>
        </a>
      {/if}
      {#if (data as any).dueSoonAssignments?.length > 0}
        {@const assignment = (data as any).dueSoonAssignments[0]}
        {@const hoursLeft = Math.round(
          (new Date(assignment.dueDate).getTime() - Date.now()) / 3600000
        )}
        <a href="/play?assignmentId={assignment.id}" class="btn-duo btn-assignment">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            ><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline
              points="14 2 14 8 20 8"
            /><line x1="16" y1="13" x2="8" y2="13" /><line
              x1="16"
              y1="17"
              x2="8"
              y2="17"
            /><polyline points="10 9 9 9 8 9" /></svg
          >
          Assignment Due
          <span class="assignment-meta">{assignment.title} · {hoursLeft}h left</span>
        </a>
      {/if}
    </div>

    {#if (data as any).dueSoonAssignments?.length > 0}
      <div class="due-soon-banner">
        <div class="due-soon-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div class="due-soon-content">
          <p class="due-soon-label">Assignments due soon</p>
          <ul class="due-soon-list">
            {#each (data as any).dueSoonAssignments as a}
              {@const hoursLeft = Math.round(
                (new Date(a.dueDate).getTime() - Date.now()) / 3600000
              )}
              <li>
                <a href="/play?assignmentId={a.id}" class="due-soon-link">
                  <span class="due-soon-title">{a.title}</span>
                  <span class="due-soon-class">{a.class.name}</span>
                </a>
                <span class="due-soon-time">{hoursLeft}h left</span>
              </li>
            {/each}
          </ul>
        </div>
      </div>
    {/if}
  </header>

  <!-- PRIMARY VISUALS: Vocabulary Heatmap + Grammar Web -->
  <div class="dashboard-content" in:fly={{ y: 20, duration: 400, delay: 100 }}>
    <section class="vocabulary-section">
      <h2>Vocabulary Heatmap</h2>
      <div class="heatmap-legend">
        <div class="legend-item">
          <span class="color-box" style="background-color: {srsColors.UNSEEN}"></span> Unseen
        </div>
        <div class="legend-item">
          <span class="color-box" style="background-color: {srsColors.LEARNING}"></span> Learning
        </div>
        <div class="legend-item">
          <span class="color-box" style="background-color: {srsColors.KNOWN}"></span> Known
        </div>
        <div class="legend-item">
          <span class="color-box" style="background-color: {srsColors.MASTERED}"></span> Mastered
        </div>
      </div>

      {#if data.vocabularies.length === 0}
        <div class="empty-state-vocab">
          <p class="empty-state-vocab-title">No vocabulary added yet</p>
          <p class="empty-state-vocab-desc">
            Start a lesson to build your word bank and track your progress here.
          </p>
          <a href="/play" class="empty-state-vocab-btn">Start Learning</a>
        </div>
      {:else}
        <div class="heatmap-grid">
          {#each data.vocabularies as vocab}
            {@const isUnseen = vocab.srsState === 'UNSEEN'}
            {@const elo = vocab.eloRating !== undefined ? Math.round(vocab.eloRating) : 1000}
            {@const level = vocab.srsState}
            {@const levelText = isUnseen
              ? 'Unseen'
              : level.charAt(0) + level.slice(1).toLowerCase()}
            {@const cellColor = srsColors[level]}
            {@const progressPct = Math.max(
              0,
              Math.min(
                100,
                level === 'LEARNING'
                  ? ((elo - 1000) / 50) * 100
                  : level === 'KNOWN'
                    ? ((elo - 1050) / 100) * 100
                    : 100
              )
            )}
            <button
              class="heatmap-cell tooltip-trigger"
              style="background-color: {cellColor}"
              onclick={() => openVocabModal(vocab, cellColor, progressPct)}
              onkeydown={(e) => e.key === 'Enter' && openVocabModal(vocab, cellColor, progressPct)}
              aria-label="View details for {vocab.vocabulary.lemma}"
            >
              <span class="sr-only">{vocab.vocabulary.lemma}</span>
              <div class="tooltip-content">
                <div class="tooltip-header">
                  {#if vocab.vocabulary.partOfSpeech?.toLowerCase() === 'noun'}
                    {vocab.vocabulary.lemma.charAt(0).toUpperCase() +
                      vocab.vocabulary.lemma.slice(1)}
                  {:else}
                    {vocab.vocabulary.lemma}
                  {/if}
                </div>
                <div class="tooltip-body">
                  {#if vocab.eloRating !== undefined && !isUnseen}
                    <div class="word-tooltip-elo">
                      <div class="elo-header">
                        <span>Mastery: {levelText}</span><span class="elo-score">ELO {elo}</span>
                      </div>
                      <div class="elo-progress-track">
                        <div
                          class="elo-progress-fill {levelText.toLowerCase()}"
                          style="width: {progressPct}%"
                        ></div>
                      </div>
                    </div>
                  {:else if isUnseen}
                    <div class="word-tooltip-elo">
                      <div class="elo-header"><span>Status: {levelText}</span></div>
                    </div>
                  {/if}
                  {#if vocab.vocabulary.partOfSpeech}
                    <div><strong>POS:</strong> {vocab.vocabulary.partOfSpeech}</div>
                  {/if}
                  {#if vocab.vocabulary.partOfSpeech?.toLowerCase() === 'noun' && vocab.vocabulary.gender}
                    <div><strong>Gender:</strong> {vocab.vocabulary.gender}</div>
                  {/if}
                  {#if vocab.vocabulary.plural}
                    <div><strong>Plural:</strong> {vocab.vocabulary.plural}</div>
                  {/if}
                  {#if (vocab.vocabulary as any).meaning}
                    <div><strong>Meaning:</strong> {(vocab.vocabulary as any).meaning}</div>
                  {/if}
                </div>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </section>

    <section class="grammar-section">
      <div class="grammar-header-row">
        <h2>Grammar Web</h2>
        <div class="grammar-header-controls">
          <div class="sort-control">
            <label for="grammar-sort">Sort by:</label>
            <select id="grammar-sort" bind:value={grammarSortOrder}>
              <option value="easiest">Easiest to Hardest</option>
              <option value="hardest">Hardest to Easiest</option>
            </select>
          </div>
          <div class="view-toggle" role="group" aria-label="Grammar view mode">
            <button
              class="view-toggle-btn"
              class:active={grammarView === 'web'}
              onclick={() => (grammarView = 'web')}
              aria-pressed={grammarView === 'web'}
              title="Web view"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" width="16" height="16">
                <circle cx="12" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" />
                <line x1="12" y1="7" x2="5" y2="17" /><line x1="12" y1="7" x2="19" y2="17" />
              </svg>
            </button>
            <button
              class="view-toggle-btn"
              class:active={grammarView === 'list'}
              onclick={() => (grammarView = 'list')}
              aria-pressed={grammarView === 'list'}
              title="List view"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" width="16" height="16">
                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
          </div>
          <a
            href="/dictionary?tab=grammar"
            class="grammar-expand-btn"
            title="Open full grammar map"
            aria-label="Open full grammar map in library"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      </div>
      {#if grammarWebNodes.length === 0}
        <p class="empty-state">No grammar rules available for this language.</p>
      {:else if grammarView === 'list'}
        <div class="grammar-list">
          {#each grammarWebNodes as rule}
            {@const srsColor = (srsColors as any)[rule.srsState] || srsColors.LOCKED}
            {@const eloPercent = rule.isLocked ? 0 : Math.max(0, Math.min(100,
              rule.srsState === 'LEARNING' ? ((rule.eloRating - 1000) / 50) * 100
              : rule.srsState === 'KNOWN' ? ((rule.eloRating - 1050) / 100) * 100 : 100))}
            <button
              class="grammar-list-row"
              class:locked={rule.isLocked}
              onclick={() => openGrammarModal(rule, srsColor, eloPercent)}
              aria-label="View grammar rule: {rule.grammarRule.title}"
            >
              <div class="grammar-list-dot" style="background-color: {srsColor}"></div>
              <div class="grammar-list-info">
                <span class="grammar-list-title">{rule.grammarRule.title}</span>
                {#if rule.grammarRule.level}
                  <span class="grammar-list-level">{rule.grammarRule.level}</span>
                {/if}
              </div>
              <span class="grammar-list-state" style="color: {srsColor}">{rule.srsState}</span>
              <svg class="grammar-list-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" width="14" height="14">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 18l6-6-6-6" />
              </svg>
            </button>
          {/each}
        </div>
      {:else}
        <div class="grammar-web-container">
          <div class="grammar-web-scroll-content">
            <svg class="web-svg-lines" width="100%" height="100%">
              {#each grammarWebNodes as _rule, i}
                {#if i < grammarWebNodes.length - 1}
                  <line
                    x1="50%" y1="{(100 / grammarWebNodes.length) * i + 100 / grammarWebNodes.length / 2}%"
                    x2="50%" y2="{(100 / grammarWebNodes.length) * (i + 1) + 100 / grammarWebNodes.length / 2}%"
                    class="web-connection-line"
                  />
                {/if}
              {/each}
            </svg>
            <div class="web-tree-layout">
              {#each grammarWebNodes as rule}
                {@const srsColor = (srsColors as any)[rule.srsState] || srsColors.LOCKED}
                {@const eloPercent = rule.isLocked ? 0 : Math.max(0, Math.min(100,
                  rule.srsState === 'LEARNING' ? ((rule.eloRating - 1000) / 50) * 100
                  : rule.srsState === 'KNOWN' ? ((rule.eloRating - 1050) / 100) * 100 : 100))}
                <button
                  class="web-node-pill"
                  class:locked={rule.isLocked}
                  style="--node-color: {srsColor}"
                  onclick={() => openGrammarModal(rule, srsColor, eloPercent)}
                  aria-label="View grammar rule: {rule.grammarRule.title}"
                >
                  <div class="node-pill-content tooltip-trigger">
                    <div class="node-icon" style="background-color: {srsColor}">
                      <span class="sr-only">{rule.srsState}</span>
                    </div>
                    <span class="node-title">{rule.grammarRule.title}</span>
                    <div class="tooltip-content">
                      <div class="tooltip-header">{rule.grammarRule.title}</div>
                      <div class="tooltip-body">
                        <div class="word-tooltip-elo">
                          <div class="elo-header">
                            <span>Status: {rule.srsState}</span>
                            {#if !rule.isLocked}
                              <span class="elo-score">ELO {Math.ceil(rule.eloRating)}</span>
                            {/if}
                          </div>
                          {#if !rule.isLocked}
                            <div class="elo-progress-track">
                              <div class="elo-progress-fill {rule.srsState.toLowerCase()}" style="width: {eloPercent}%; background-color: {srsColor}"></div>
                            </div>
                          {/if}
                        </div>
                        <p class="node-desc">{rule.grammarRule.description || 'No description available.'}</p>
                      </div>
                    </div>
                  </div>
                </button>
              {/each}
            </div>
          </div>
        </div>
      {/if}
    </section>
  </div>

  <!-- QUICK STATS -->
  <div class="quick-stats-row" in:fly={{ y: 16, duration: 400, delay: 200 }}>
    <div class="qstat">
      <span class="qstat-value">{totalVocab}</span>
      <span class="qstat-label">Words Learned</span>
    </div>
    <div class="qstat qstat-green">
      <span class="qstat-value">{vocabSrsBreakdown['MASTERED'] || 0}</span>
      <span class="qstat-label">Words Mastered</span>
    </div>
    <div class="qstat qstat-purple">
      <span class="qstat-value">{grammarSrsBreakdown['MASTERED'] || 0}</span>
      <span class="qstat-label">Rules Mastered</span>
    </div>
    {#if (data as any).sessionEma !== undefined}
      <div class="qstat qstat-blue">
        <span class="qstat-value">{(data as any).sessionEma}%</span>
        <span class="qstat-label">Session Accuracy</span>
      </div>
    {/if}
    {#if data.dueReviewCount > 0}
      <div class="qstat qstat-warn">
        <span class="qstat-value">{data.dueReviewCount}</span>
        <span class="qstat-label">Due for Review</span>
      </div>
    {/if}
  </div>

  <!-- MEMORY HEALTH (collapsible) -->
  {#if data.retentionStats && data.retentionStats.totalReviewed > 0}
    {@const rs = data.retentionStats}
    <section class="accordion-card" in:fly={{ y: 16, duration: 400, delay: 300 }}>
      <button
        class="accordion-toggle"
        onclick={() => (showMemoryHealth = !showMemoryHealth)}
        aria-expanded={showMemoryHealth}
      >
        <span class="accordion-title">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            width="18"
            height="18"
            aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg
          >
          Memory Health
        </span>
        <span class="accordion-meta"
          >{rs.avgRetentionPct}% retention · {rs.totalReviewed} reviewed</span
        >
        <svg
          class="accordion-chevron"
          class:rotated={showMemoryHealth}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          width="18"
          height="18"
          aria-hidden="true"
          ><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg
        >
      </button>
      {#if showMemoryHealth}
        <div class="accordion-body" transition:slide={{ duration: 280 }}>
          <div class="retention-kpi-row">
            <div class="retention-kpi">
              <span class="retention-kpi-value">{rs.avgRetentionPct}%</span>
              <span class="retention-kpi-label">Avg. Retention</span>
            </div>
            <div class="retention-kpi">
              <span class="retention-kpi-value">{rs.avgStabilityDays}d</span>
              <span class="retention-kpi-label">Avg. Stability</span>
            </div>
            <div class="retention-kpi">
              <span class="retention-kpi-value">{rs.totalReviewed}</span>
              <span class="retention-kpi-label">Words Reviewed</span>
            </div>
            <div class="retention-kpi">
              <span class="retention-kpi-value">{rs.totalLapses}</span>
              <span class="retention-kpi-label">Total Lapses</span>
            </div>
          </div>

          <div class="retention-charts-row">
            <div class="retention-chart-card">
              <h3>Retention Distribution</h3>
              <div class="bar-chart" aria-label="Retention distribution">
                {#each rs.retentionBuckets as bucket}
                  {@const maxCount = Math.max(...rs.retentionBuckets.map((b) => b.count), 1)}
                  <div class="bar-row">
                    <span class="bar-label">{bucket.label}</span>
                    <div class="bar-track">
                      <div
                        class="bar-fill retention-fill"
                        style="width: {Math.round((bucket.count / maxCount) * 100)}%"
                      ></div>
                    </div>
                    <span class="bar-count">{bucket.count}</span>
                  </div>
                {/each}
              </div>
            </div>

            <div class="retention-chart-card">
              <h3>Stability Distribution</h3>
              <div class="bar-chart" aria-label="Stability distribution">
                {#each rs.stabilityBuckets as bucket}
                  {@const maxCount = Math.max(...rs.stabilityBuckets.map((b) => b.count), 1)}
                  <div class="bar-row">
                    <span class="bar-label">{bucket.label}</span>
                    <div class="bar-track">
                      <div
                        class="bar-fill stability-fill"
                        style="width: {Math.round((bucket.count / maxCount) * 100)}%"
                      ></div>
                    </div>
                    <span class="bar-count">{bucket.count}</span>
                  </div>
                {/each}
              </div>
            </div>

            <div class="retention-chart-card">
              <h3>Forgetting Curve <span class="chart-subtitle">(median item)</span></h3>
              <div class="bar-chart" aria-label="Predicted retention over time">
                {#each rs.forgettingCurve as point}
                  <div class="bar-row">
                    <span class="bar-label">{point.days}d</span>
                    <div class="bar-track">
                      <div
                        class="bar-fill forgetting-fill"
                        style="width: {point.retentionPct}%"
                      ></div>
                    </div>
                    <span class="bar-count">{point.retentionPct}%</span>
                  </div>
                {/each}
              </div>
            </div>
          </div>

          {#if data.newWordIntake && data.newWordIntake.some((w) => w.count > 0)}
            {@const maxIntake = Math.max(...data.newWordIntake.map((w) => w.count), 1)}
            <div class="intake-card">
              <h3>New Word Intake</h3>
              <p class="insight-desc">Words added to your vocabulary over the past 8 weeks.</p>
              <div class="intake-bars">
                {#each data.newWordIntake as week}
                  <div class="intake-col">
                    <span class="intake-count">{week.count > 0 ? week.count : ''}</span>
                    <div class="intake-bar-track">
                      <div
                        class="intake-bar-fill"
                        style="height:{Math.round((week.count / maxIntake) * 100)}%"
                      ></div>
                    </div>
                    <span class="intake-label">{week.label}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <div class="upcoming-reviews">
            <h3>Upcoming Reviews</h3>
            <div class="upcoming-row">
              <div class="upcoming-chip">
                <span class="upcoming-count">{rs.upcomingReviews.in1Day}</span>
                <span class="upcoming-label">due today</span>
              </div>
              <div class="upcoming-chip">
                <span class="upcoming-count">{rs.upcomingReviews.in7Days}</span>
                <span class="upcoming-label">due in 7 days</span>
              </div>
              <div class="upcoming-chip">
                <span class="upcoming-count">{rs.upcomingReviews.in30Days}</span>
                <span class="upcoming-label">due in 30 days</span>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </section>
  {/if}

  <!-- LEARNING INSIGHTS (collapsible) -->
  {#if totalVocab > 0}
    {@const urgent = (data as any).urgentItems ?? []}
    {@const errors = (data as any).errorTypeCounts ?? {}}
    {@const coverage = (data as any).grammarCoverage}
    {@const errorLabels: Record<string, string> = {
			wrong_case: 'Wrong Case',
			wrong_tense: 'Wrong Tense',
			wrong_gender: 'Wrong Gender',
			spelling: 'Spelling',
			word_order: 'Word Order',
			vocabulary_gap: 'Vocabulary Gap'
		}}
    <section class="accordion-card" in:fly={{ y: 16, duration: 400, delay: 400 }}>
      <button
        class="accordion-toggle"
        onclick={() => (showInsights = !showInsights)}
        aria-expanded={showInsights}
      >
        <span class="accordion-title">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            width="18"
            height="18"
            aria-hidden="true"
            ><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle
              cx="12"
              cy="12"
              r="3"
            /></svg
          >
          Learning Insights
        </span>
        <span class="accordion-meta">
          {#if urgent.length > 0}{urgent.length} fading{:else}0 fading{/if}{#if Object.keys(errors).length > 0}
            · errors tracked{/if}
        </span>
        <svg
          class="accordion-chevron"
          class:rotated={showInsights}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          width="18"
          height="18"
          aria-hidden="true"
          ><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg
        >
      </button>
      {#if showInsights}
        <div class="accordion-body" transition:slide={{ duration: 280 }}>
          <div class="insights-grid">
            {#if urgent.length > 0}
              <div class="insight-card urgent-card">
                <h3>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    width="16"
                    height="16"
                    aria-hidden="true"
                    ><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line
                      x1="12"
                      y1="16"
                      x2="12.01"
                      y2="16"
                    /></svg
                  >
                  Fading Fast
                </h3>
                <p class="insight-desc">
                  Words your memory of has dropped below 70% — review them soon.
                </p>
                <ul class="urgent-list">
                  {#each urgent as item}
                    <li class="urgent-row">
                      <span class="urgent-lemma">{item.lemma}</span>
                      {#if item.meaning}<span class="urgent-meaning">{item.meaning}</span>{/if}
                      <span
                        class="urgent-ret"
                        style="color: {item.retrievabilityPct < 40
                          ? '#ef4444'
                          : item.retrievabilityPct < 60
                            ? '#f97316'
                            : '#eab308'}">{item.retrievabilityPct}%</span
                      >
                      {#if item.lapses > 0}<span class="urgent-lapses"
                          >{item.lapses} lapse{item.lapses !== 1 ? 's' : ''}</span
                        >{/if}
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}

            {#if Object.keys(errors).length > 0}
              {@const totalErrors = Object.values(errors).reduce(
                (a, b) => (a as number) + (b as number),
                0
              ) as number}
              <div class="insight-card error-card">
                <h3>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    width="16"
                    height="16"
                    aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg
                  >
                  Error Breakdown
                </h3>
                <p class="insight-desc">Types of mistakes in your most recent answers.</p>
                <div class="error-bars">
                  {#each Object.entries(errors).sort((a, b) => (b[1] as number) - (a[1] as number)) as [type, count]}
                    <div class="error-bar-row">
                      <span class="error-label">{errorLabels[type] ?? type}</span>
                      <div class="error-track">
                        <div
                          class="error-fill"
                          style="width:{Math.round(((count as number) / totalErrors) * 100)}%"
                        ></div>
                      </div>
                      <span class="error-count">{count as number}</span>
                    </div>
                  {/each}
                </div>
                {#if (data as any).totalOverrides > 0}
                  <p class="override-note">
                    {(data as any).totalOverrides} self-correction{(data as any).totalOverrides !==
                    1
                      ? 's'
                      : ''} recorded
                  </p>
                {/if}
              </div>
            {/if}

            {#if coverage}
              <div class="insight-card coverage-card">
                <h3>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    width="16"
                    height="16"
                    aria-hidden="true"
                    ><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path
                      d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"
                    /></svg
                  >
                  Grammar Coverage
                </h3>
                <p class="insight-desc">{coverage.total} total rules in this language.</p>
                <div class="coverage-rows">
                  <div class="coverage-row">
                    <span class="coverage-dot" style="background:#10b981"></span>
                    <span class="coverage-label">Mastered / Known</span>
                    <span class="coverage-val">{coverage.mastered}</span>
                  </div>
                  <div class="coverage-row">
                    <span class="coverage-dot" style="background:#fef08a;border:1px solid #ca8a04"
                    ></span>
                    <span class="coverage-label">Interacted</span>
                    <span class="coverage-val">{coverage.interacted - coverage.mastered}</span>
                  </div>
                  <div class="coverage-row">
                    <span class="coverage-dot" style="background:#e2e8f0;border:1px solid #94a3b8"
                    ></span>
                    <span class="coverage-label">Available to Learn</span>
                    <span class="coverage-val">{coverage.available}</span>
                  </div>
                  <div class="coverage-row">
                    <span class="coverage-dot" style="background:#94a3b8"></span>
                    <span class="coverage-label">Locked (prereqs unmet)</span>
                    <span class="coverage-val">{coverage.locked}</span>
                  </div>
                </div>
                <div class="coverage-bar-track">
                  <div
                    class="coverage-seg mastered-seg"
                    style="width:{Math.round((coverage.mastered / coverage.total) * 100)}%"
                  ></div>
                  <div
                    class="coverage-seg learning-seg"
                    style="width:{Math.round(
                      ((coverage.interacted - coverage.mastered) / coverage.total) * 100
                    )}%"
                  ></div>
                  <div
                    class="coverage-seg available-seg"
                    style="width:{Math.round((coverage.available / coverage.total) * 100)}%"
                  ></div>
                </div>
              </div>
            {/if}

            <!-- Recently Mastered -->
            {#if data.recentlyMastered && data.recentlyMastered.length > 0}
              <div class="insight-card mastered-card">
                <h3>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    width="16"
                    height="16"
                    aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg
                  >
                  Recently Mastered
                </h3>
                <p class="insight-desc">Your most recently learned words.</p>
                <div class="mastered-chips">
                  {#each data.recentlyMastered as word}
                    <span class="mastered-chip" title={word.partOfSpeech ?? ''}>{word.lemma}</span>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Most Confused Words -->
            {#if (data as any).mostConfusedWords?.length > 0}
              <div class="insight-card confused-card">
                <h3>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    width="16"
                    height="16"
                    aria-hidden="true"
                    ><circle cx="12" cy="12" r="10" /><path
                      d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"
                    /><line x1="12" y1="17" x2="12.01" y2="17" /></svg
                  >
                  Most Confused
                </h3>
                <p class="insight-desc">
                  Words you've forgotten most often — they need extra attention.
                </p>
                <ul class="confused-list">
                  {#each (data as any).mostConfusedWords as word}
                    <li class="confused-row">
                      <span class="confused-lemma">{word.lemma}</span>
                      {#if word.meaning}<span class="confused-meaning">{word.meaning}</span>{/if}
                      <span class="confused-lapses"
                        >{word.lapses} lapse{word.lapses !== 1 ? 's' : ''}</span
                      >
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}

            <!-- Part of Speech Breakdown -->
            {#if data.posBreakdown && data.posBreakdown.length > 0}
              {@const totalPos = data.posBreakdown.reduce((s, p) => s + p.count, 0)}
              <div class="insight-card pos-card">
                <h3>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    width="16"
                    height="16"
                    aria-hidden="true"
                    ><rect x="3" y="3" width="18" height="18" rx="2" /><path
                      d="M3 9h18M9 21V9"
                    /></svg
                  >
                  Parts of Speech
                </h3>
                <p class="insight-desc">Breakdown of your vocabulary by word type.</p>
                <div class="pos-bars">
                  {#each data.posBreakdown as p}
                    <div class="pos-bar-row">
                      <span class="pos-label">{p.pos.charAt(0).toUpperCase() + p.pos.slice(1)}</span
                      >
                      <div class="pos-track">
                        <div
                          class="pos-fill"
                          style="width:{Math.round((p.count / totalPos) * 100)}%"
                        ></div>
                      </div>
                      <span class="pos-count">{p.count}</span>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- CEFR Level Breakdown -->
            {#if data.cefrBreakdown && (data.cefrBreakdown.vocab.some((v) => v.total > 0) || data.cefrBreakdown.grammar.some((g) => g.total > 0))}
              <div class="insight-card cefr-card">
                <h3>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    width="16"
                    height="16"
                    aria-hidden="true"><path d="M18 20V10M12 20V4M6 20v-6" /></svg
                  >
                  CEFR Level Breakdown
                </h3>
                <p class="insight-desc">
                  Vocab and grammar rules you've touched at each proficiency level.
                </p>
                <div class="cefr-grid">
                  {#each data.cefrBreakdown.vocab.filter((v) => v.total > 0) as row}
                    <div class="cefr-row">
                      <span class="cefr-badge cefr-{row.level.toLowerCase()}">{row.level}</span>
                      <div class="cefr-bar-wrap">
                        <div class="cefr-bar-track">
                          <div
                            class="cefr-bar-fill"
                            style="width:{Math.round((row.known / Math.max(row.total, 1)) * 100)}%"
                          ></div>
                        </div>
                        <span class="cefr-nums">{row.known}/{row.total} vocab</span>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Next Grammar Unlocks -->
            {#if data.nextUnlocks && data.nextUnlocks.length > 0}
              <div class="insight-card unlocks-card">
                <h3>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    width="16"
                    height="16"
                    aria-hidden="true"
                    ><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path
                      d="M7 11V7a5 5 0 0 1 9.9-1"
                    /></svg
                  >
                  Next Grammar Unlocks
                </h3>
                <p class="insight-desc">
                  Rules you can start learning now — all prerequisites mastered.
                </p>
                <ul class="unlocks-list">
                  {#each data.nextUnlocks as rule}
                    <li class="unlock-row">
                      <span class="unlock-title">{rule.title}</span>
                      <span class="cefr-badge cefr-{rule.level.toLowerCase()}">{rule.level}</span>
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </section>
  {/if}

  <!-- LEARNING INTELLIGENCE (collapsible, power users) -->
  {#if (data as any).sessionEma !== undefined}
    {@const ad = data as any}
    <section
      class="accordion-card accordion-technical"
      in:fly={{ y: 16, duration: 400, delay: 500 }}
    >
      <button
        class="accordion-toggle"
        onclick={() => (showIntelligence = !showIntelligence)}
        aria-expanded={showIntelligence}
      >
        <span class="accordion-title">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            width="18"
            height="18"
            aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg
          >
          Learning Intelligence
        </span>
        <span class="accordion-meta">Adaptive · FSRS-5 · Bandit</span>
        <svg
          class="accordion-chevron"
          class:rotated={showIntelligence}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          width="18"
          height="18"
          aria-hidden="true"
          ><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg
        >
      </button>
      {#if showIntelligence}
        <div class="accordion-body" transition:slide={{ duration: 280 }}>
          <p class="algo-intro">
            Live signals from the scheduling algorithms personalised to your session history.
          </p>
          <div class="algo-grid">
            <div class="algo-card">
              <h3 class="algo-card-title">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  width="16"
                  height="16"
                  aria-hidden="true"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg
                >
                Adaptive Pace
              </h3>
              <p class="algo-card-desc">
                Your recent answer accuracy drives how many new words are introduced each day.
              </p>
              <div class="algo-stat-row">
                <span class="algo-stat-label">Session accuracy (EMA)</span>
                <span class="algo-stat-value">{ad.sessionEma}%</span>
              </div>
              <div class="algo-ema-bar">
                <div class="algo-ema-fill" style="width:{ad.sessionEma}%"></div>
              </div>
              <div class="algo-stat-row" style="margin-top:0.5rem">
                <span class="algo-stat-label">Today's new-word cap</span>
                <span class="algo-stat-value algo-cap">{ad.adaptiveCap} words</span>
              </div>
              <p class="algo-footnote">Range 5–20. Higher accuracy → more new words introduced.</p>
            </div>

            <!-- Bandit interleave card -->
            <div class="algo-card">
              <h3 class="algo-card-title">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  width="16"
                  height="16"
                  aria-hidden="true"
                  ><circle cx="12" cy="12" r="10" /><path d="M8 12h8M12 8v8" /></svg
                >
                Review Mix (Bandit)
              </h3>
              <p class="algo-card-desc">
                A Thompson-sampling bandit learns how many mastered items to interleave per lesson
                for best retention.
              </p>
              {#if ad.banditArmMeans}
                <div class="bandit-arms">
                  {#each ad.banditArmMeans as arm}
                    <div
                      class="bandit-arm-row"
                      class:bandit-best={arm.interleaveCount === ad.bestBanditArm.interleaveCount}
                    >
                      <span class="bandit-arm-label"
                        >{arm.interleaveCount} review{arm.interleaveCount !== 1 ? 's' : ''}</span
                      >
                      <div class="bandit-arm-track">
                        <div class="bandit-arm-fill" style="width:{arm.mean}%"></div>
                      </div>
                      <span class="bandit-arm-pct">{arm.mean}%</span>
                      <span class="bandit-arm-obs"
                        >{arm.observations > 0 ? arm.observations + ' obs' : 'prior'}</span
                      >
                    </div>
                  {/each}
                </div>
                <p class="algo-footnote">
                  Best arm: {ad.bestBanditArm.interleaveCount} interleaved items ({ad.bestBanditArm
                    .mean}% success rate)
                </p>
              {/if}
            </div>

            <!-- ELO confidence card -->
            {#if ad.highVarianceVocab?.length > 0}
              <div class="algo-card">
                <h3 class="algo-card-title">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    width="16"
                    height="16"
                    aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg
                  >
                  ELO Uncertainty
                </h3>
                <p class="algo-card-desc">
                  Words where the algorithm is least certain of your true proficiency — expect them
                  to appear more often.
                </p>
                <ul class="variance-list">
                  {#each ad.highVarianceVocab as v}
                    <li class="variance-row">
                      <span class="variance-lemma">{v.lemma}</span>
                      <span class="variance-level">{v.level}</span>
                      <span class="variance-elo">{v.elo}</span>
                      <span class="variance-sigma" title="ELO uncertainty (±σ)">±{v.sigma}</span>
                    </li>
                  {/each}
                </ul>
                <p class="algo-footnote">σ shrinks with each review. New items start at σ≈20.</p>
              </div>
            {/if}

            <!-- PFA at-risk grammar card -->
            {#if ad.pfaAtRisk?.length > 0}
              <div class="algo-card">
                <h3 class="algo-card-title">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    width="16"
                    height="16"
                    aria-hidden="true"
                    ><path
                      d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                    /><line x1="12" y1="9" x2="12" y2="13" /><line
                      x1="12"
                      y1="17"
                      x2="12.01"
                      y2="17"
                    /></svg
                  >
                  Grammar at Risk
                </h3>
                <p class="algo-card-desc">
                  Rules the Performance Factor model predicts you're likely to get wrong — they'll
                  be prioritised in lessons.
                </p>
                <ul class="pfa-list">
                  {#each ad.pfaAtRisk as g}
                    <li class="pfa-row">
                      <span class="pfa-title">{g.title}</span>
                      <span class="pfa-level">{g.level}</span>
                      <span
                        class="pfa-p"
                        style="color:{(g.pCorrect ?? 0) < 0.4 ? '#ef4444' : '#f97316'}"
                        >{Math.round((g.pCorrect ?? 0) * 100)}%</span
                      >
                    </li>
                  {/each}
                </ul>
                <p class="algo-footnote">P(correct) from PFA model — below 60% means at-risk.</p>
              </div>
            {/if}

            <!-- Error co-occurrence card -->
            {#if ad.coOccurrencePairs?.length > 0}
              {@const errorLabels: Record<string, string> = {
						wrong_case: 'Wrong Case', wrong_tense: 'Wrong Tense', wrong_gender: 'Wrong Gender',
						spelling: 'Spelling', word_order: 'Word Order', vocabulary_gap: 'Vocab Gap'
					}}
              <div class="algo-card">
                <h3 class="algo-card-title">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    width="16"
                    height="16"
                    aria-hidden="true"
                    ><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle
                      cx="18"
                      cy="19"
                      r="3"
                    /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line
                      x1="15.41"
                      y1="6.51"
                      x2="8.59"
                      y2="10.49"
                    /></svg
                  >
                  Error Patterns
                </h3>
                <p class="algo-card-desc">
                  Error types that tend to appear together across learners — fixing one often helps
                  the other.
                </p>
                <ul class="coerr-list">
                  {#each ad.coOccurrencePairs as pair}
                    <li class="coerr-row">
                      <span class="coerr-from">{errorLabels[pair.from] ?? pair.from}</span>
                      <span class="coerr-arrow">↔</span>
                      <span class="coerr-to">{errorLabels[pair.to] ?? pair.to}</span>
                      <span class="coerr-strength coerr-{pair.strength}">{pair.strength}</span>
                    </li>
                  {/each}
                </ul>
                <p class="algo-footnote">
                  Grammar rules addressing co-occurring errors are surfaced first.
                </p>
              </div>
            {/if}

            <!-- FSRS personalisation card -->
            <div class="algo-card">
              <h3 class="algo-card-title">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  width="16"
                  height="16"
                  aria-hidden="true"
                  ><path d="M12 20h9" /><path
                    d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
                  /></svg
                >
                FSRS Personalisation
              </h3>
              <p class="algo-card-desc">
                The spaced-repetition scheduler fits 19 weights to your review history daily.
              </p>
              <div class="algo-stat-row">
                <span class="algo-stat-label">Personal weights</span>
                <span
                  class="algo-stat-value"
                  style="color:{ad.hasPersonalizedWeights ? '#10b981' : '#94a3b8'}"
                  >{ad.hasPersonalizedWeights ? 'Active' : 'Building (need 50 reviews)'}</span
                >
              </div>
              <div class="algo-stat-row">
                <span class="algo-stat-label">Target retention</span>
                <span class="algo-stat-value">{ad.fsrsRetention}%</span>
              </div>
              <div class="algo-stat-row">
                <span class="algo-stat-label">Algorithm version</span>
                <span class="algo-stat-value">FSRS-5</span>
              </div>
            </div>

            <!-- ELO Calibration scatter -->
            {#if ad.eloCalibration?.length > 1}
              <div class="algo-card">
                <h3 class="algo-card-title">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    width="16"
                    height="16"
                    aria-hidden="true"
                    ><circle cx="8" cy="16" r="2" /><circle cx="16" cy="8" r="2" /><circle
                      cx="14"
                      cy="18"
                      r="2"
                    /><circle cx="6" cy="10" r="2" /><line
                      x1="2"
                      y1="22"
                      x2="22"
                      y2="2"
                      stroke-dasharray="3 3"
                    /></svg
                  >
                  ELO Calibration
                </h3>
                <p class="algo-card-desc">
                  Does your ELO score actually predict how often you answer correctly? A
                  well-calibrated model rises left-to-right.
                </p>
                <div class="calibration-chart">
                  {#each ad.eloCalibration as point}
                    <div class="cal-col">
                      <span class="cal-pct">{point.actualPassPct}%</span>
                      <div class="cal-bar-track">
                        <div class="cal-bar-fill" style="height:{point.actualPassPct}%"></div>
                      </div>
                      <span class="cal-elo">{point.elo}</span>
                      <span class="cal-n">n={point.sampleSize}</span>
                    </div>
                  {/each}
                </div>
                <p class="algo-footnote">
                  ELO buckets vs actual pass rate across all your reviews.
                </p>
              </div>
            {/if}

            <!-- Word Frequency Coverage -->
            {#if data.freqCoverage && data.freqCoverage.some((f) => f.total > 0)}
              <div class="algo-card">
                <h3 class="algo-card-title">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    width="16"
                    height="16"
                    aria-hidden="true"
                    ><path d="M12 2L2 7l10 5 10-5-10-5z" /><path
                      d="M2 17l10 5 10-5M2 12l10 5 10-5"
                    /></svg
                  >
                  Word Frequency Coverage
                </h3>
                <p class="algo-card-desc">
                  How many of the most common words in this language you've mastered or know.
                </p>
                <div class="freq-coverage-rows">
                  {#each data.freqCoverage as tier}
                    {#if tier.total > 0}
                      <div class="freq-row">
                        <span class="freq-label"
                          >Top {tier.threshold >= 1000
                            ? tier.threshold / 1000 + 'k'
                            : tier.threshold}</span
                        >
                        <div class="freq-track">
                          <div
                            class="freq-fill"
                            style="width:{Math.round((tier.known / tier.total) * 100)}%"
                          ></div>
                        </div>
                        <span class="freq-stat">{tier.known}/{tier.total}</span>
                        <span class="freq-pct"
                          >{Math.round((tier.known / Math.max(tier.total, 1)) * 100)}%</span
                        >
                      </div>
                    {/if}
                  {/each}
                </div>
                <p class="algo-footnote">
                  Based on corpus frequency rank. Only words in your vocabulary are counted.
                </p>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </section>
  {/if}
</div>

{#if selectedModalItem}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-backdrop"
    onclick={closeModal}
    onkeydown={(e) => e.key === 'Escape' && closeModal()}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <button class="modal-close" onclick={closeModal}>&times;</button>

      {#if selectedModalItem.type === 'vocab'}
        {@const vocab = selectedModalItem.data}
        {@const isUnseen = vocab.srsState === 'UNSEEN'}
        {@const elo = vocab.eloRating !== undefined ? Math.round(vocab.eloRating) : 1000}
        {@const levelText = isUnseen
          ? 'Unseen'
          : vocab.srsState.charAt(0) + vocab.srsState.slice(1).toLowerCase()}

        <h3 class="modal-title">
          {#if vocab.vocabulary.partOfSpeech?.toLowerCase() === 'noun'}
            {vocab.vocabulary.lemma.charAt(0).toUpperCase() + vocab.vocabulary.lemma.slice(1)}
          {:else}
            {vocab.vocabulary.lemma}
          {/if}
        </h3>

        <div class="modal-body">
          {#if !isUnseen}
            <div class="modal-elo-section">
              <div class="modal-elo-header">
                <span>Mastery: {levelText}</span>
                <span class="modal-elo-score" style="color: {selectedModalItem.color}"
                  >ELO {elo}</span
                >
              </div>
              <div class="elo-progress-track">
                <div
                  class="elo-progress-fill"
                  style="width: {selectedModalItem.eloPercent}%; background-color: {selectedModalItem.color}"
                ></div>
              </div>
            </div>
          {:else}
            <div class="modal-elo-section">
              <div class="modal-elo-header"><span>Status: {levelText}</span></div>
            </div>
          {/if}

          <div class="modal-details">
            {#if vocab.vocabulary.partOfSpeech}
              <div class="modal-detail-row">
                <span class="detail-label">POS:</span>
                <span>{vocab.vocabulary.partOfSpeech}</span>
              </div>
            {/if}
            {#if vocab.vocabulary.partOfSpeech?.toLowerCase() === 'noun' && vocab.vocabulary.gender}
              <div class="modal-detail-row">
                <span class="detail-label">Gender:</span>
                <span>{vocab.vocabulary.gender}</span>
              </div>
            {/if}
            {#if vocab.vocabulary.plural}
              <div class="modal-detail-row">
                <span class="detail-label">Plural:</span>
                <span>{vocab.vocabulary.plural}</span>
              </div>
            {/if}
            {#if (vocab.vocabulary as any).meaning}
              <div class="modal-detail-row">
                <span class="detail-label">Meaning:</span>
                <span>{(vocab.vocabulary as any).meaning}</span>
              </div>
            {/if}
          </div>
        </div>
      {:else if selectedModalItem.type === 'grammar'}
        {@const rule = selectedModalItem.data}
        {@const prereqs = getPrerequisiteProgress(rule)}
        {@const allPrereqsMastered =
          prereqs.length === 0 || prereqs.every((p: any) => p.srsState === 'MASTERED')}
        {@const canTestOut = !rule.isLocked && rule.srsState !== 'MASTERED' && allPrereqsMastered}

        <!-- Back navigation -->
        {#if grammarModalPhase !== 'detail' || modalStack.length > 1}
          <button class="modal-back-btn" onclick={goBack}>
            ←
            {#if grammarModalPhase !== 'detail'}
              Back to Details
            {:else}
              {modalStack[modalStack.length - 2]?.data?.grammarRule?.title || 'Back'}
            {/if}
          </button>
        {/if}

        {#if grammarModalPhase === 'detail'}
          <h3 class="modal-title">{rule.grammarRule.title}</h3>

          <div class="modal-body">
            <div class="modal-elo-section">
              <div class="modal-elo-header">
                <span>Status: {rule.srsState}</span>
                {#if !rule.isLocked}
                  <span class="modal-elo-score" style="color: {selectedModalItem.color}"
                    >ELO {Math.ceil(rule.eloRating)}</span
                  >
                {/if}
              </div>
              {#if !rule.isLocked}
                <div class="elo-progress-track">
                  <div
                    class="elo-progress-fill"
                    style="width: {selectedModalItem.eloPercent}%; background-color: {selectedModalItem.color}"
                  ></div>
                </div>
              {/if}
            </div>

            {#if prereqs.length > 0}
              <div class="prereq-section">
                <h4 class="prereq-heading">
                  {rule.isLocked ? 'Prerequisites to Unlock' : 'Prerequisites'}
                </h4>
                <div class="prereq-list">
                  {#each prereqs as prereq}
                    <button
                      class="prereq-item prereq-item-clickable"
                      onclick={() => navigateToPrereq(prereq.id)}
                      title="View {prereq.title}"
                    >
                      <div class="prereq-item-header">
                        <span class="prereq-dot" style="background-color: {prereq.color}"></span>
                        <span class="prereq-title">{prereq.title}</span>
                        <span class="prereq-status" style="color: {prereq.color}"
                          >{prereq.srsState}</span
                        >
                        <span class="prereq-arrow">›</span>
                      </div>
                      <div class="prereq-bar-track">
                        <div
                          class="prereq-bar-fill"
                          style="width: {prereq.percent}%; background-color: {prereq.color}"
                        ></div>
                      </div>
                    </button>
                  {/each}
                </div>
              </div>
            {/if}

            {#if canTestOut}
              <div class="test-out-section">
                <div class="test-out-divider"></div>
                <p class="test-out-hint">
                  All prerequisites mastered! You can test out of this rule by answering 9 out of 10
                  questions correctly.
                </p>
                <button class="test-out-btn" onclick={() => startTestOut(rule.grammarRule.id)}>
                  Test Out of {rule.grammarRule.title}
                </button>
              </div>
            {/if}

            {#if testOutError}
              <p class="test-out-error">{testOutError}</p>
            {/if}

            <div class="modal-details">
              <p class="modal-desc">
                {rule.grammarRule.description || 'No description available.'}
              </p>
              {#if rule.grammarRule.guide}
                <div class="grammar-guide markdown-body">
                  {@html marked(rule.grammarRule.guide)}
                </div>
              {/if}
            </div>
          </div>
        {:else if grammarModalPhase === 'testing'}
          <h3 class="modal-title">Test Out: {rule.grammarRule.title}</h3>

          <div class="modal-body">
            {#if testOutLoading}
              <div class="test-loading">
                <div class="test-loading-spinner"></div>
                <p>Generating questions…</p>
              </div>
            {:else if testOutError && !testOutQuestions}
              <div class="test-error-state">
                <p>{testOutError}</p>
                <button class="test-retry-btn" onclick={() => startTestOut(rule.grammarRule.id)}
                  >Try Again</button
                >
              </div>
            {:else if testOutQuestions}
              {@const q = testOutQuestions[testOutCurrentIndex]}
              {@const lastScore = testOutScores[testOutScores.length - 1]}

              <div class="test-progress-header">
                <span class="test-q-count"
                  >Question {testOutCurrentIndex + 1} / {testOutTotalQuestions}</span
                >
                <span class="test-score-preview">{testOutPassedCount} correct so far</span>
              </div>
              <div class="test-progress-bar-track">
                <div
                  class="test-progress-bar-fill"
                  style="width: {(testOutCurrentIndex / testOutTotalQuestions) * 100}%"
                ></div>
              </div>

              <div class="test-question-card">
                <p class="test-sentence">{q.sentence}</p>
                <p class="test-context">{q.context}</p>
              </div>

              <div class="test-options">
                {#each q.options as option, i}
                  <button
                    class="test-option"
                    class:option-correct={testOutAnsweredCurrent && i === q.correctIndex}
                    class:option-incorrect={testOutAnsweredCurrent &&
                      i === testOutSelectedAnswer &&
                      i !== q.correctIndex}
                    class:option-disabled={testOutAnsweredCurrent &&
                      i !== q.correctIndex &&
                      i !== testOutSelectedAnswer}
                    onclick={() => handleTestAnswer(i)}
                    disabled={testOutAnsweredCurrent}
                  >
                    <span class="option-letter">{String.fromCharCode(65 + i)}</span>
                    <span class="option-text">{option}</span>
                  </button>
                {/each}
              </div>

              {#if testOutAnsweredCurrent}
                <div
                  class="test-feedback"
                  class:feedback-correct={lastScore}
                  class:feedback-incorrect={!lastScore}
                >
                  <span class="feedback-icon">{lastScore ? '✓' : '✗'}</span>
                  <div class="feedback-content">
                    <span class="feedback-label"
                      >{lastScore
                        ? 'Correct!'
                        : `Incorrect — correct answer: ${q.options[q.correctIndex]}`}</span
                    >
                    <p class="feedback-explanation">{q.explanation}</p>
                  </div>
                </div>
                {@const wrongSoFar = testOutScores.filter((s) => !s).length}
                <button class="test-next-btn" onclick={nextTestQuestion}>
                  {testOutCurrentIndex >= testOutTotalQuestions - 1 || wrongSoFar >= 2
                    ? 'See Results →'
                    : 'Next Question →'}
                </button>
              {/if}
            {/if}
          </div>
        {:else if grammarModalPhase === 'results'}
          {@const endedEarly =
            testOutScores.filter((s) => !s).length >= 2 &&
            testOutScores.length < testOutTotalQuestions}
          <h3 class="modal-title">Results: {rule.grammarRule.title}</h3>

          <div class="modal-body">
            <div
              class="results-score-display"
              class:results-pass={testOutPassed}
              class:results-fail={!testOutPassed}
            >
              <span class="results-number">{testOutPassedCount}/{testOutScores.length}</span>
              <span class="results-label">correct</span>
            </div>

            <div class="score-dots">
              {#each testOutScores as correct}
                <span class="score-dot" class:dot-correct={correct} class:dot-incorrect={!correct}>
                  {correct ? '✓' : '✗'}
                </span>
              {/each}
            </div>

            {#if testOutPassed}
              <p class="results-message results-pass-msg">
                You've demonstrated mastery of {rule.grammarRule.title}!
              </p>
              {#if testOutMasteryDone}
                <div class="mastery-confirmed">
                  <span>✓ Marked as Mastered!</span>
                </div>
              {:else}
                <button
                  class="master-confirm-btn"
                  onclick={() => submitMastery(rule.grammarRule.id)}
                  disabled={testOutMastering}
                >
                  {testOutMastering ? 'Saving…' : 'Mark as Mastered →'}
                </button>
              {/if}
            {:else}
              <p class="results-message results-fail-msg">
                {#if endedEarly}
                  Test ended early — 2 wrong answers means passing is no longer possible. Keep
                  practicing and try again!
                {:else}
                  You need at least 9/10 correct to test out. Keep practicing and try again!
                {/if}
              </p>
              <div class="results-actions">
                <button class="results-retry-btn" onclick={() => startTestOut(rule.grammarRule.id)}>
                  Try Again
                </button>
                <button class="results-back-btn" onclick={goBack}> Back to Details </button>
              </div>
            {/if}

            {#if testOutError}
              <p class="test-out-error">{testOutError}</p>
            {/if}
          </div>
        {/if}
      {/if}
    </div>
  </div>
{/if}

<style>
  /* ── Quick-stats KPI chips ── */
  .quick-stats-row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .qstat {
    flex: 1 1 120px;
    background: var(--card-bg, #ffffff);
    border-radius: 0.875rem;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    border: 1px solid rgba(0, 0, 0, 0.06);
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease;
  }

  .qstat:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
  }

  .qstat-value {
    font-size: 1.75rem;
    font-weight: 800;
    line-height: 1;
    color: #0f172a;
    letter-spacing: -0.02em;
  }

  .qstat-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
  }

  .qstat-green .qstat-value {
    color: #10b981;
  }
  .qstat-purple .qstat-value {
    color: #8b5cf6;
  }
  .qstat-blue .qstat-value {
    color: #3b82f6;
  }
  .qstat-warn .qstat-value {
    color: #f97316;
  }

  :global(html[data-theme='dark']) .qstat {
    background: #1e293b;
    border-color: rgba(255, 255, 255, 0.06);
  }
  :global(html[data-theme='dark']) .qstat-value {
    color: #f1f5f9;
  }
  :global(html[data-theme='dark']) .qstat-label {
    color: #94a3b8;
  }

  /* ── Accordion cards ── */
  .accordion-card {
    background: var(--card-bg, #ffffff);
    border-radius: 1rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
    border: 1px solid rgba(0, 0, 0, 0.06);
    margin-bottom: 1rem;
    overflow: hidden;
  }

  .accordion-technical {
    border-left: 3px solid #8b5cf6;
  }

  .accordion-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1.1rem 1.5rem;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease;
  }

  .accordion-toggle:hover {
    background: rgba(0, 0, 0, 0.03);
  }

  :global(html[data-theme='dark']) .accordion-toggle:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .accordion-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 700;
    color: #0f172a;
    flex: 1;
  }

  :global(html[data-theme='dark']) .accordion-title {
    color: #f1f5f9;
  }

  .accordion-meta {
    font-size: 0.8rem;
    color: #64748b;
    white-space: nowrap;
  }

  :global(html[data-theme='dark']) .accordion-meta {
    color: #94a3b8;
  }

  .accordion-chevron {
    color: #94a3b8;
    transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
    flex-shrink: 0;
  }

  .accordion-chevron.rotated {
    transform: rotate(180deg);
  }

  .accordion-body {
    padding: 1.25rem 1.5rem 1.5rem;
    border-top: 1px solid rgba(0, 0, 0, 0.06);
  }

  :global(html[data-theme='dark']) .accordion-body {
    border-top-color: rgba(255, 255, 255, 0.08);
  }

  :global(html[data-theme='dark']) .accordion-card {
    background: #1e293b;
    border-color: rgba(255, 255, 255, 0.06);
  }

  .dashboard-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    box-sizing: border-box;
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
    color: #334155;
  }

  .dashboard-header {
    margin-bottom: 2rem;
    text-align: center;
    padding: 3rem 1rem;
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border-radius: 1rem;
    color: white;
    box-shadow:
      0 10px 25px -5px rgba(0, 0, 0, 0.2),
      0 8px 10px -6px rgba(0, 0, 0, 0.1);
  }

  .dashboard-header h1 {
    font-size: 2.5rem;
    color: #ffffff;
    margin-bottom: 0.5rem;
    font-weight: 800;
    letter-spacing: -0.025em;
  }

  .dashboard-header p {
    color: #94a3b8;
    font-size: 1.1rem;
    margin-bottom: 1.5rem;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
  }

  .cefr-progress-container {
    max-width: 400px;
    margin: 0 auto 2.5rem;
    padding: 0 1rem;
  }

  .cefr-labels {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.6rem;
    font-weight: 800;
    font-size: 1.25rem;
    color: #ffffff;
    letter-spacing: 0.05em;
  }

  .cefr-bar-track {
    width: 100%;
    height: 1.25rem;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 9999px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.2);
    position: relative;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .cefr-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #8b5cf6, #d946ef);
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: width 1.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    min-width: 2.5rem;
    box-shadow: 0 0 10px rgba(139, 92, 246, 0.5);
  }

  .cefr-percent {
    font-size: 0.7rem;
    font-weight: 900;
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  }

  .cefr-subtext {
    font-size: 0.75rem;
    color: #94a3b8;
    margin-top: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 700;
  }

  .cefr-detail-bars {
    margin-top: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .detail-bar-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .detail-bar-label {
    font-size: 0.65rem;
    color: #94a3b8;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    width: 110px;
    text-align: right;
    flex-shrink: 0;
  }

  .detail-bar-track {
    flex: 1;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 9999px;
    overflow: hidden;
  }

  .detail-bar-fill {
    height: 100%;
    border-radius: 9999px;
    transition: width 1s ease;
  }

  .detail-bar-fill.vocab {
    background: #3b82f6;
  }
  .detail-bar-fill.grammar {
    background: #8b5cf6;
  }
  .detail-bar-fill.exposure {
    background: #f59e0b;
  }
  .detail-bar-fill.elo {
    background: #10b981;
  }

  .detail-bar-value {
    font-size: 0.65rem;
    color: #cbd5e1;
    font-weight: 700;
    width: 70px;
    flex-shrink: 0;
  }

  .header-actions {
    display: flex;
    justify-content: center;
    gap: 1rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .redo-onboarding-link {
    font-size: 0.78rem;
    color: var(--text-muted, #888);
    text-decoration: none;
    width: 100%;
    text-align: center;
    margin-top: -0.25rem;
  }

  .redo-onboarding-link:hover {
    text-decoration: underline;
  }

  /* Live session button */
  :global(.btn-live) {
    background-color: #f97316;
    color: white;
    border-color: transparent;
    box-shadow: 0 4px 0 #c2410c;
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  :global(.btn-live svg) {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
  :global(.btn-live:hover) {
    background-color: #fb923c;
    transform: scale(1.02);
  }
  :global(.btn-live:active) {
    transform: scale(0.98) translateY(2px);
    box-shadow: 0 2px 0 #c2410c;
  }
  :global(.live-class-name) {
    font-size: 0.7em;
    font-weight: 600;
    opacity: 0.85;
    text-transform: none;
    letter-spacing: 0;
    background: rgba(0, 0, 0, 0.15);
    border-radius: 0.4rem;
    padding: 0.1rem 0.4rem;
  }
  :global(.live-pulse) {
    display: inline-block;
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    background: white;
    flex-shrink: 0;
    animation: live-pulse 1.4s ease-in-out infinite;
  }
  @keyframes live-pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.4;
      transform: scale(0.7);
    }
  }

  /* Assignment due button */
  :global(.btn-assignment) {
    background-color: #eab308;
    color: white;
    border-color: transparent;
    box-shadow: 0 4px 0 #a16207;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  :global(.btn-assignment svg) {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
  :global(.btn-assignment:hover) {
    background-color: #facc15;
    transform: scale(1.02);
  }
  :global(.btn-assignment:active) {
    transform: scale(0.98) translateY(2px);
    box-shadow: 0 2px 0 #a16207;
  }
  :global(.assignment-meta) {
    font-size: 0.7em;
    font-weight: 600;
    opacity: 0.85;
    text-transform: none;
    letter-spacing: 0;
    background: rgba(0, 0, 0, 0.15);
    border-radius: 0.4rem;
    padding: 0.1rem 0.4rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 14ch;
  }

  /* Assignment due-soon banner (#10) */
  .due-soon-banner {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    background: rgba(245, 158, 11, 0.15);
    border: 1.5px solid rgba(245, 158, 11, 0.4);
    border-radius: 1rem;
    padding: 0.85rem 1.1rem;
    margin-top: 1.25rem;
    text-align: left;
    max-width: 480px;
    margin-left: auto;
    margin-right: auto;
  }

  .due-soon-icon {
    flex-shrink: 0;
    width: 1.5rem;
    height: 1.5rem;
    color: #d97706;
    margin-top: 0.1rem;
  }

  .due-soon-icon svg {
    width: 100%;
    height: 100%;
  }

  .due-soon-content {
    flex: 1;
    min-width: 0;
  }

  .due-soon-label {
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #d97706;
    margin: 0 0 0.35rem;
  }

  .due-soon-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .due-soon-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .due-soon-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    text-decoration: none;
    min-width: 0;
  }

  .due-soon-link:hover .due-soon-title {
    text-decoration: underline;
  }

  .due-soon-title {
    font-size: 0.875rem;
    font-weight: 700;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
  }

  .due-soon-class {
    font-size: 0.7rem;
    font-weight: 600;
    color: #94a3b8;
    white-space: nowrap;
  }

  .due-soon-time {
    font-size: 0.75rem;
    font-weight: 800;
    color: #f59e0b;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .re-onboard-link {
    display: inline-block;
    padding: 0.75rem 1.5rem;
    background-color: #3b82f6;
    color: #ffffff;
    text-decoration: none;
    border-radius: 9999px;
    font-size: 0.95rem;
    font-weight: 600;
    transition: all 0.2s;
    box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.5);
  }

  .re-onboard-link:hover {
    background-color: #2563eb;
    transform: translateY(-2px);
    box-shadow: 0 6px 8px -1px rgba(59, 130, 246, 0.6);
  }

  /* Summary Section */
  .summary-section {
    margin-bottom: 3rem;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
  }

  @media (min-width: 768px) {
    .summary-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  .summary-card {
    background: var(--card-bg, #ffffff);
    border-radius: 1rem;
    padding: 2rem;
    box-shadow:
      0 10px 15px -3px rgba(0, 0, 0, 0.05),
      0 4px 6px -4px rgba(0, 0, 0, 0.05);
    transition:
      transform 0.3s ease,
      box-shadow 0.3s ease;
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.05);
  }

  .summary-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 4px;
    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  }

  .summary-card:hover {
    transform: translateY(-4px);
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 8px 10px -6px rgba(0, 0, 0, 0.05);
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    font-size: 1.1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  }

  .stat-row:last-of-type {
    border-bottom: none;
  }

  .stat-label {
    color: #64748b;
    font-weight: 500;
  }

  :global(html[data-theme='dark']) .stat-label {
    color: #94a3b8;
  }

  .stat-value {
    color: #0f172a;
    font-weight: 700;
    font-size: 1.25rem;
    background: #f1f5f9;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
  }

  :global(html[data-theme='dark']) .stat-value {
    background: #1e293b;
    color: #f1f5f9;
  }

  .srs-breakdown {
    margin-top: 2rem;
    background: #f8fafc;
    padding: 1.5rem;
    border-radius: 0.75rem;
  }

  :global(html[data-theme='dark']) .srs-breakdown {
    background: #1e293b;
  }

  .breakdown-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
    font-size: 0.95rem;
  }

  .breakdown-row:last-child {
    margin-bottom: 0;
  }

  .breakdown-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: #334155;
    font-weight: 500;
  }

  :global(html[data-theme='dark']) .breakdown-label {
    color: #94a3b8;
  }

  .dashboard-content {
    display: grid;
    grid-template-columns: 1fr;
    gap: 3rem;
    margin-bottom: 2rem;
    min-width: 0;
  }

  .dashboard-content > section {
    min-width: 0;
  }

  @media (min-width: 1024px) {
    .dashboard-content {
      grid-template-columns: 1fr 1fr;
    }
  }

  h2 {
    font-size: 1.75rem;
    color: var(--text-color, #0f172a);
    margin-bottom: 1.5rem;
    font-weight: 800;
    letter-spacing: -0.025em;
    position: relative;
    display: inline-block;
  }

  /* Vocabulary Heatmap */
  .heatmap-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
    margin-bottom: 2rem;
    font-size: 0.9rem;
    background: #f8fafc;
    padding: 1rem;
    border-radius: 0.5rem;
    justify-content: center;
  }

  :global(html[data-theme='dark']) .heatmap-legend {
    background: #1e293b;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
    color: #475569;
  }

  .color-box {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 4px;
    display: inline-block;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .heatmap-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    background: var(--card-bg, #ffffff);
    padding: 2rem;
    border-radius: 1rem;
    box-shadow:
      0 10px 15px -3px rgba(0, 0, 0, 0.05),
      0 4px 6px -4px rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.05);
    max-width: 100%;
    box-sizing: border-box;
  }

  .heatmap-cell {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .heatmap-cell:hover {
    transform: scale(1.1) translateY(-2px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
    z-index: 10;
  }

  .tooltip-trigger {
    position: relative;
  }

  .tooltip-content {
    visibility: hidden;
    opacity: 0;
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%) translateY(5px);
    margin-bottom: 0;
    background-color: #0f172a;
    color: #f8fafc;
    text-align: left;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    width: max-content;
    min-width: 140px;
    max-width: 200px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
    z-index: 100;
    pointer-events: none;
    border: 1px solid rgba(255, 255, 255, 0.1);
    line-height: 1.3;
  }

  .tooltip-content::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -6px;
    border-width: 6px;
    border-style: solid;
    border-color: #0f172a transparent transparent transparent;
  }

  @media (max-width: 768px) {
    .tooltip-content {
      display: none;
    }
  }

  .tooltip-trigger:hover .tooltip-content {
    visibility: visible;
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }

  @media (max-width: 768px) {
    .tooltip-trigger:hover .tooltip-content {
      transform: translateX(0) translateY(0);
    }
  }

  .tooltip-header {
    font-weight: 700;
    font-size: 0.95rem;
    margin-bottom: 0.25rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 0.25rem;
    color: #ffffff;
  }

  .tooltip-body {
    font-size: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    color: #cbd5e1;
  }

  .word-tooltip-elo {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 0.25rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .elo-header {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 0.7rem;
    color: #94a3b8;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .elo-score {
    color: #3b82f6;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  .elo-progress-track {
    display: block;
    width: 100%;
    height: 4px;
    background: #1e293b;
    border-radius: 9999px;
    overflow: hidden;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .elo-progress-fill {
    display: block;
    height: 100%;
    border-radius: 9999px;
    transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .elo-progress-fill.learning {
    background: linear-gradient(90deg, #facc15, #fef08a);
  }
  .elo-progress-fill.known {
    background: linear-gradient(90deg, #34d399, #6ee7b7);
  }
  .elo-progress-fill.mastered {
    background: linear-gradient(90deg, #10b981, #059669);
  }

  /* Grammar Web */
  .grammar-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .grammar-header-row h2 { margin-bottom: 0; }
  .grammar-header-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .view-toggle {
    display: flex;
    border: 2px solid #334155;
    border-radius: 0.6rem;
    overflow: hidden;
  }
  .view-toggle-btn {
    background: none;
    border: none;
    padding: 0.35rem 0.6rem;
    cursor: pointer;
    color: #64748b;
    display: flex;
    align-items: center;
    transition: background 0.15s, color 0.15s;
    line-height: 0;
  }
  .view-toggle-btn:first-child { border-right: 1px solid #334155; }
  .view-toggle-btn.active { background: #334155; color: #f1f5f9; }
  .view-toggle-btn:hover:not(.active) { background: #1e293b; color: #94a3b8; }
  .grammar-expand-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 0.5rem;
    color: #64748b;
    border: 1px solid #e2e8f0;
    background: transparent;
    text-decoration: none;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }
  .grammar-expand-btn:hover {
    color: #3b82f6;
    border-color: #93c5fd;
    background: #eff6ff;
  }
  :global(html[data-theme='dark']) .grammar-expand-btn {
    border-color: #334155;
    color: #94a3b8;
  }
  :global(html[data-theme='dark']) .grammar-expand-btn:hover {
    color: #60a5fa;
    border-color: #3b82f6;
    background: #1e3a5f;
  }
  .sort-control {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }
  .sort-control select {
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    border: 1px solid #cbd5e1;
    background-color: #ffffff;
    font-size: 0.9rem;
    cursor: pointer;
  }
  :global(html[data-theme='dark']) .sort-control select {
    background-color: #1e293b;
    border-color: #475569;
    color: #f1f5f9;
  }
  .grammar-list {
    background: #1e293b;
    border: 2px solid #334155;
    border-radius: 1rem;
    overflow: hidden;
  }
  .grammar-list-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.85rem 1rem;
    background: none;
    border: none;
    border-bottom: 1px solid #334155;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
    font-family: inherit;
  }
  .grammar-list-row:last-child { border-bottom: none; }
  .grammar-list-row:hover { background: rgba(255, 255, 255, 0.04); }
  .grammar-list-row.locked { opacity: 0.5; cursor: not-allowed; }
  .grammar-list-dot {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .grammar-list-info { flex: 1; display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
  .grammar-list-title {
    font-size: 0.9rem;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #e2e8f0;
  }
  .grammar-list-level {
    font-size: 0.65rem;
    font-weight: 800;
    background: #334155;
    color: #94a3b8;
    padding: 0.15rem 0.45rem;
    border-radius: 0.35rem;
    flex-shrink: 0;
  }
  .grammar-list-state {
    font-size: 0.65rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    flex-shrink: 0;
  }
  .grammar-list-chevron { flex-shrink: 0; color: #475569; }
  .grammar-web-container {
    position: relative;
    background: var(--card-bg, #ffffff);
    border-radius: 1rem;
    height: 500px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -4px rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.05);
    overflow-y: auto;
    overflow-x: hidden;
  }
  .grammar-web-scroll-content {
    position: relative;
    padding: 2rem;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .web-svg-lines {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    z-index: 0;
    pointer-events: none;
  }
  .web-connection-line { stroke: #cbd5e1; stroke-width: 2px; stroke-dasharray: 4 4; }
  :global(html[data-theme='dark']) .web-connection-line { stroke: #475569; }
  .web-tree-layout {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 3rem;
    align-items: center;
    width: 100%;
    padding: 2rem 0;
  }
  .web-node-pill {
    position: relative;
    display: flex;
    align-items: center;
    background: #ffffff;
    border: 2px solid var(--node-color);
    border-radius: 9999px;
    padding: 0.5rem 1.25rem 0.5rem 0.5rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
  }
  :global(html[data-theme='dark']) .web-node-pill { background: #1e293b; }
  .web-node-pill:hover { transform: translateY(-2px) scale(1.05); z-index: 10; }
  .web-node-pill.locked { opacity: 0.7; border-style: dashed; background-color: #f1f5f9; }
  :global(html[data-theme='dark']) .web-node-pill.locked { background-color: #0f172a; }
  .node-pill-content { display: flex; align-items: center; gap: 0.75rem; }
  .node-icon { width: 1.5rem; height: 1.5rem; border-radius: 50%; box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2); }
  .node-title { font-weight: 600; font-size: 0.95rem; color: #334155; }
  :global(html[data-theme='dark']) .node-title { color: #f8fafc; }
  .node-desc { margin-top: 0.5rem; color: #94a3b8; }
  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    background: #f8fafc;
    border-radius: 1rem;
    border: 2px dashed #cbd5e1;
    color: #64748b;
    font-size: 1.1rem;
    font-weight: 500;
  }
  :global(html[data-theme='dark']) .empty-state { background: #1e293b; border-color: #475569; }

  .empty-state-vocab {
    text-align: center;
    padding: 3rem 2rem;
    background: #f8fafc;
    border-radius: 1rem;
    border: 2px dashed #cbd5e1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  :global(html[data-theme='dark']) .empty-state-vocab {
    background: #1e293b;
    border-color: #475569;
  }

  .empty-state-vocab-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-color, #0f172a);
    margin: 0;
  }

  .empty-state-vocab-desc {
    color: #64748b;
    font-size: 0.95rem;
    margin: 0;
  }

  .empty-state-vocab-btn {
    margin-top: 0.75rem;
    display: inline-block;
    background: #1cb0f6;
    color: #fff;
    font-weight: 700;
    padding: 0.6rem 1.5rem;
    border-radius: 0.75rem;
    text-decoration: none;
    font-size: 0.95rem;
    transition: background 0.15s;
  }

  .empty-state-vocab-btn:hover {
    background: #0ea5e9;
  }

  @media (max-width: 768px) {
    .dashboard-container {
      padding: 0.5rem;
    }

    h2 {
      font-size: 1.4rem;
      margin-bottom: 1rem;
    }

    .dashboard-header {
      padding: 1.25rem 0.75rem;
      margin-bottom: 1rem;
    }

    .dashboard-header h1 {
      font-size: 1.5rem;
    }

    .dashboard-header p {
      font-size: 0.85rem;
      margin-bottom: 1rem;
    }

    .dashboard-header .btn-duo {
      width: 100%;
      box-sizing: border-box;
      padding: 0.75rem 1rem;
      font-size: 0.9rem;
    }

    .cefr-progress-container {
      max-width: 100%;
      padding: 0;
      margin-bottom: 1.5rem;
    }

    .cefr-labels {
      font-size: 1rem;
    }

    .cefr-bar-track {
      height: 1rem;
    }

    .detail-bar-label {
      width: 75px;
      font-size: 0.55rem;
    }

    .detail-bar-value {
      width: 45px;
      font-size: 0.55rem;
    }

    .summary-card {
      padding: 1rem;
    }

    .dashboard-content {
      gap: 1.5rem;
    }

    .heatmap-legend {
      gap: 0.5rem;
      padding: 0.5rem;
      margin-bottom: 1rem;
      justify-content: flex-start;
    }

    .legend-item {
      font-size: 0.7rem;
      gap: 0.25rem;
    }

    .color-box {
      width: 0.75rem;
      height: 0.75rem;
    }

    .heatmap-grid {
      padding: 0.75rem;
      gap: 6px;
      justify-content: center;
    }

    .heatmap-cell {
      width: 16px;
      height: 16px;
      border-radius: 4px;
    }

    .insights-grid {
      grid-template-columns: 1fr;
    }

    .retention-kpi-row {
      grid-template-columns: repeat(2, 1fr);
      gap: 0.5rem;
    }

    .retention-kpi {
      padding: 0.75rem;
    }

    .retention-kpi-value {
      font-size: 1.25rem;
    }

    .grammar-header-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
    }
    .grammar-web-container { height: 350px; }

    .quick-stats-row {
      gap: 0.5rem;
    }

    .qstat {
      flex: 1 1 100px;
      padding: 0.75rem;
    }

    .qstat-value {
      font-size: 1.25rem;
    }

    .qstat-label {
      font-size: 0.65rem;
    }
  }

  /* Modal CSS */
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(2px);
  }

  .modal-content {
    position: relative;
    background: #ffffff;
    padding: 2.5rem 2rem 2rem;
    border-radius: 1rem;
    max-width: 90%;
    width: 500px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }

  :global(html[data-theme='dark']) .modal-content {
    background: #1e293b;
    color: #f1f5f9;
  }

  .modal-close {
    position: absolute;
    top: 0.75rem;
    right: 1rem;
    background: transparent;
    border: none;
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.5rem;
    transition: all 0.2s;
  }

  .modal-close:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  :global(html[data-theme='dark']) .modal-close:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .modal-title {
    font-size: 1.5rem;
    font-weight: 800;
    margin-bottom: 1rem;
    margin-top: 0;
    padding-right: 1rem;
  }

  .modal-body {
    font-size: 1rem;
    color: #475569;
    overflow-y: auto;
    flex-grow: 1;
  }

  :global(html[data-theme='dark']) .modal-body {
    color: #94a3b8;
  }

  .modal-elo-section {
    margin-bottom: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  }

  :global(html[data-theme='dark']) .modal-elo-section {
    border-bottom-color: rgba(255, 255, 255, 0.1);
  }

  .modal-elo-header {
    display: flex;
    justify-content: space-between;
    font-weight: 700;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .modal-elo-score {
    font-weight: 800;
  }

  .prereq-section {
    margin-bottom: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  }

  :global(html[data-theme='dark']) .prereq-section {
    border-bottom-color: rgba(255, 255, 255, 0.1);
  }

  .prereq-heading {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
    margin: 0 0 0.75rem 0;
  }

  .prereq-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .prereq-item-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.35rem;
    width: 100%;
  }

  .prereq-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .prereq-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: #334155;
    flex: 1;
  }

  :global(html[data-theme='dark']) .prereq-title {
    color: #cbd5e1;
  }

  .prereq-status {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .prereq-bar-track {
    width: 100%;
    height: 6px;
    background: #e2e8f0;
    border-radius: 9999px;
    overflow: hidden;
  }

  :global(html[data-theme='dark']) .prereq-bar-track {
    background: #0f172a;
  }

  .prereq-bar-fill {
    height: 100%;
    border-radius: 9999px;
    transition: width 0.5s ease;
  }

  .modal-details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .modal-detail-row {
    display: flex;
    gap: 0.5rem;
  }

  .detail-label {
    font-weight: 600;
    color: #64748b;
    width: 70px;
    flex-shrink: 0;
  }

  .modal-desc {
    line-height: 1.5;
    margin-bottom: 0.5rem;
  }

  .grammar-guide {
    padding: 1.25rem;
    border-radius: 0.75rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    font-size: 1rem;
    line-height: 1.6;
    max-height: 400px;
    overflow-y: auto;
    color: #334155;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.02);
  }

  :global(html[data-theme='dark']) .grammar-guide {
    background: #0f172a;
    border-color: #1e293b;
    color: #cbd5e1;
  }

  .grammar-guide :global(h1),
  .grammar-guide :global(h2),
  .grammar-guide :global(h3),
  .grammar-guide :global(h4) {
    color: #0f172a;
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
    font-weight: 700;
    line-height: 1.3;
  }

  :global(html[data-theme='dark']) .grammar-guide :global(h1),
  :global(html[data-theme='dark']) .grammar-guide :global(h2),
  :global(html[data-theme='dark']) .grammar-guide :global(h3),
  :global(html[data-theme='dark']) .grammar-guide :global(h4) {
    color: #f8fafc;
  }

  .grammar-guide :global(h1:first-child),
  .grammar-guide :global(h2:first-child),
  .grammar-guide :global(h3:first-child) {
    margin-top: 0;
  }

  .grammar-guide :global(h1) {
    font-size: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }
  .grammar-guide :global(h2) {
    font-size: 1.25rem;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 0.3rem;
  }
  .grammar-guide :global(h3) {
    font-size: 1.1rem;
  }

  :global(html[data-theme='dark']) .grammar-guide :global(h1),
  :global(html[data-theme='dark']) .grammar-guide :global(h2) {
    border-color: #1e293b;
  }

  .grammar-guide :global(p) {
    margin-top: 0;
    margin-bottom: 1rem;
  }

  .grammar-guide :global(p:last-child) {
    margin-bottom: 0;
  }

  .grammar-guide :global(ul),
  .grammar-guide :global(ol) {
    margin-top: 0;
    margin-bottom: 1rem;
    padding-left: 1.5rem;
  }

  .grammar-guide :global(li) {
    margin-bottom: 0.25rem;
  }

  .grammar-guide :global(strong),
  .grammar-guide :global(b) {
    font-weight: 700;
    color: #0f172a;
  }

  :global(html[data-theme='dark']) .grammar-guide :global(strong),
  :global(html[data-theme='dark']) .grammar-guide :global(b) {
    color: #f8fafc;
  }

  .grammar-guide :global(em),
  .grammar-guide :global(i) {
    color: #475569;
  }

  :global(html[data-theme='dark']) .grammar-guide :global(em),
  :global(html[data-theme='dark']) .grammar-guide :global(i) {
    color: #94a3b8;
  }

  .grammar-guide :global(code) {
    background: #e2e8f0;
    padding: 0.1rem 0.3rem;
    border-radius: 0.25rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.85em;
    color: #db2777;
  }

  :global(html[data-theme='dark']) .grammar-guide :global(code) {
    background: #1e293b;
    color: #f472b6;
  }

  .grammar-guide :global(pre) {
    background: #1e293b;
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin-bottom: 1rem;
  }

  .grammar-guide :global(pre code) {
    background: transparent;
    color: #e2e8f0;
    padding: 0;
    font-size: 0.9em;
  }

  .grammar-guide :global(blockquote) {
    border-left: 4px solid #3b82f6;
    padding-left: 1rem;
    margin-left: 0;
    margin-right: 0;
    background: #f1f5f9;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
    border-radius: 0 0.25rem 0.25rem 0;
    font-style: italic;
  }

  :global(html[data-theme='dark']) .grammar-guide :global(blockquote) {
    background: #1e293b;
    border-left-color: #60a5fa;
  }

  .grammar-guide :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1rem;
  }

  .grammar-guide :global(th),
  .grammar-guide :global(td) {
    border: 1px solid #e2e8f0;
    padding: 0.5rem;
    text-align: left;
  }

  :global(html[data-theme='dark']) .grammar-guide :global(th),
  :global(html[data-theme='dark']) .grammar-guide :global(td) {
    border-color: #334155;
  }

  .grammar-guide :global(th) {
    background: #f1f5f9;
    font-weight: 600;
  }

  :global(html[data-theme='dark']) .grammar-guide :global(th) {
    background: #1e293b;
  }

  /* Modal back button */
  .modal-back-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: none;
    border: none;
    font-size: 0.85rem;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
    padding: 0;
    margin-top: -0.5rem;
    margin-bottom: 0.5rem;
    transition: color 0.2s;
  }

  .modal-back-btn:hover {
    color: #334155;
  }

  /* Prerequisite items as clickable buttons */
  .prereq-item-clickable {
    display: block;
    width: 100%;
    box-sizing: border-box;
    background: none;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 0.6rem 0.75rem;
    cursor: pointer;
    text-align: left;
    transition:
      background 0.15s,
      border-color 0.15s;
  }

  .prereq-item-clickable:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
  }

  .prereq-arrow {
    font-size: 1.1rem;
    color: #94a3b8;
    margin-left: auto;
  }

  /* Test-out section in detail view */
  .test-out-divider {
    height: 1px;
    background: rgba(0, 0, 0, 0.07);
    margin: 1.5rem 0 1rem;
  }

  .test-out-hint {
    font-size: 0.85rem;
    color: #64748b;
    margin: 0 0 0.75rem;
    line-height: 1.4;
  }

  .test-out-btn {
    width: 100%;
    padding: 0.75rem 1.25rem;
    background: linear-gradient(135deg, #7c3aed, #4f46e5);
    color: #ffffff;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    transition:
      opacity 0.2s,
      transform 0.15s;
    letter-spacing: 0.01em;
  }

  .test-out-btn:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .test-out-error {
    margin-top: 0.75rem;
    color: #dc2626;
    font-size: 0.85rem;
  }

  /* Testing phase */
  .test-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem;
    color: #64748b;
  }

  .test-loading-spinner {
    width: 2rem;
    height: 2rem;
    border: 3px solid #e2e8f0;
    border-top-color: #7c3aed;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .test-error-state {
    text-align: center;
    padding: 2rem;
    color: #dc2626;
  }

  .test-retry-btn {
    margin-top: 1rem;
    padding: 0.5rem 1.25rem;
    background: #7c3aed;
    color: #fff;
    border: none;
    border-radius: 0.375rem;
    font-weight: 600;
    cursor: pointer;
  }

  .test-progress-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
  }

  .test-progress-bar-track {
    width: 100%;
    height: 6px;
    background: #e2e8f0;
    border-radius: 9999px;
    overflow: hidden;
    margin-bottom: 1.25rem;
  }

  .test-progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #7c3aed, #4f46e5);
    border-radius: 9999px;
    transition: width 0.4s ease;
  }

  .test-question-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.75rem;
    padding: 1.25rem;
    margin-bottom: 1rem;
  }

  :global(html[data-theme='dark']) .test-question-card {
    background: #0f172a;
    border-color: #334155;
  }

  .test-sentence {
    font-size: 1.2rem;
    font-weight: 700;
    color: #0f172a;
    margin: 0 0 0.4rem;
    line-height: 1.4;
  }

  :global(html[data-theme='dark']) .test-sentence {
    color: #f1f5f9;
  }

  .test-context {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0;
    font-style: italic;
  }

  .test-options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .test-option {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 1rem;
    background: #ffffff;
    border: 2px solid #e2e8f0;
    border-radius: 0.5rem;
    font-size: 0.95rem;
    cursor: pointer;
    text-align: left;
    transition:
      border-color 0.15s,
      background 0.15s;
    color: #334155;
  }

  :global(html[data-theme='dark']) .test-option {
    background: #1e293b;
    border-color: #334155;
    color: #cbd5e1;
  }

  .test-option:hover:not(:disabled) {
    border-color: #7c3aed;
    background: #faf5ff;
  }

  :global(html[data-theme='dark']) .test-option:hover:not(:disabled) {
    background: #2d1b69;
    border-color: #7c3aed;
  }

  .test-option:disabled {
    cursor: default;
  }

  .test-option.option-correct {
    border-color: #10b981;
    background: #d1fae5;
    color: #065f46;
  }

  :global(html[data-theme='dark']) .test-option.option-correct {
    background: #052e16;
    color: #86efac;
  }

  .test-option.option-incorrect {
    border-color: #ef4444;
    background: #fee2e2;
    color: #7f1d1d;
  }

  :global(html[data-theme='dark']) .test-option.option-incorrect {
    background: #450a0a;
    color: #fca5a5;
  }

  .test-option.option-disabled {
    opacity: 0.45;
  }

  .option-letter {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    background: #e2e8f0;
    font-size: 0.75rem;
    font-weight: 800;
    flex-shrink: 0;
    color: #475569;
  }

  .option-text {
    flex: 1;
    font-weight: 600;
  }

  .test-feedback {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
    border: 1px solid transparent;
  }

  .test-feedback.feedback-correct {
    background: #d1fae5;
    border-color: #6ee7b7;
  }

  :global(html[data-theme='dark']) .test-feedback.feedback-correct {
    background: #052e16;
    border-color: #166534;
  }

  .test-feedback.feedback-incorrect {
    background: #fee2e2;
    border-color: #fca5a5;
  }

  :global(html[data-theme='dark']) .test-feedback.feedback-incorrect {
    background: #450a0a;
    border-color: #7f1d1d;
  }

  .feedback-icon {
    font-size: 1.1rem;
    font-weight: 800;
    flex-shrink: 0;
    margin-top: 0.05rem;
  }

  .feedback-content {
    flex: 1;
  }

  .feedback-label {
    display: block;
    font-weight: 700;
    font-size: 0.9rem;
    margin-bottom: 0.25rem;
  }

  .feedback-explanation {
    font-size: 0.8rem;
    color: #475569;
    margin: 0;
    line-height: 1.4;
  }

  .test-next-btn {
    width: 100%;
    padding: 0.7rem 1.25rem;
    background: #1e293b;
    color: #ffffff;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s;
  }

  .test-next-btn:hover {
    background: #0f172a;
  }

  /* Results phase */
  .results-score-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 6rem;
    height: 6rem;
    border-radius: 50%;
    margin: 0 auto 1.25rem;
    border: 4px solid;
  }

  .results-score-display.results-pass {
    border-color: #10b981;
    background: #d1fae5;
    color: #065f46;
  }

  :global(html[data-theme='dark']) .results-score-display.results-pass {
    background: #052e16;
    color: #86efac;
  }

  .results-score-display.results-fail {
    border-color: #f59e0b;
    background: #fef3c7;
    color: #78350f;
  }

  :global(html[data-theme='dark']) .results-score-display.results-fail {
    background: #1c1400;
    color: #fde68a;
  }

  .results-number {
    font-size: 1.5rem;
    font-weight: 900;
    line-height: 1;
  }

  .results-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .score-dots {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    justify-content: center;
    margin-bottom: 1.25rem;
  }

  .score-dot {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 800;
  }

  .score-dot.dot-correct {
    background: #d1fae5;
    color: #065f46;
  }

  :global(html[data-theme='dark']) .score-dot.dot-correct {
    background: #052e16;
    color: #86efac;
  }

  .score-dot.dot-incorrect {
    background: #fee2e2;
    color: #7f1d1d;
  }

  :global(html[data-theme='dark']) .score-dot.dot-incorrect {
    background: #450a0a;
    color: #fca5a5;
  }

  .results-message {
    text-align: center;
    font-size: 0.95rem;
    line-height: 1.5;
    margin: 0 0 1.25rem;
  }

  .results-pass-msg {
    color: #065f46;
    font-weight: 600;
  }

  .results-fail-msg {
    color: #64748b;
  }

  .master-confirm-btn {
    width: 100%;
    padding: 0.75rem 1.25rem;
    background: linear-gradient(135deg, #10b981, #059669);
    color: #ffffff;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    transition:
      opacity 0.2s,
      transform 0.15s;
  }

  .master-confirm-btn:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .master-confirm-btn:disabled {
    opacity: 0.7;
    cursor: default;
  }

  .mastery-confirmed {
    padding: 0.875rem 1rem;
    background: #d1fae5;
    border: 1px solid #6ee7b7;
    border-radius: 0.5rem;
    text-align: center;
    font-weight: 700;
    color: #065f46;
  }

  :global(html[data-theme='dark']) .mastery-confirmed {
    background: #052e16;
    border-color: #166534;
    color: #86efac;
  }

  .results-actions {
    display: flex;
    gap: 0.75rem;
  }

  .results-retry-btn {
    flex: 1;
    padding: 0.7rem 1rem;
    background: linear-gradient(135deg, #7c3aed, #4f46e5);
    color: #ffffff;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .results-retry-btn:hover {
    opacity: 0.9;
  }

  .results-back-btn {
    flex: 1;
    padding: 0.7rem 1rem;
    background: transparent;
    color: #475569;
    border: 1px solid #cbd5e1;
    border-radius: 0.5rem;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }

  .results-back-btn:hover {
    background: #f1f5f9;
  }

  :global(html[data-theme='dark']) .results-back-btn {
    color: #94a3b8;
    border-color: #475569;
  }

  :global(html[data-theme='dark']) .results-back-btn:hover {
    background: #1e293b;
  }

  .test-out-section {
    margin-top: 1.5rem;
  }

  /* ── Retention Analytics ─────────────────────────────────────────────── */
  .retention-section {
    margin-bottom: 3rem;
  }

  .retention-kpi-row {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  @media (min-width: 640px) {
    .retention-kpi-row {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  .retention-kpi {
    background: var(--card-bg, #fff);
    border-radius: 0.75rem;
    padding: 1.25rem 1rem;
    text-align: center;
    border: 1px solid var(--card-border, #e2e8f0);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  }

  :global(html[data-theme='dark']) .retention-kpi {
    box-shadow: none;
  }

  .retention-kpi-value {
    display: block;
    font-size: 1.75rem;
    font-weight: 800;
    color: var(--primary, #4f46e5);
    line-height: 1;
    margin-bottom: 0.35rem;
  }

  .retention-kpi-label {
    font-size: 0.78rem;
    color: var(--text-muted, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .retention-charts-row {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.25rem;
    margin-bottom: 1.5rem;
  }

  @media (min-width: 768px) {
    .retention-charts-row {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .retention-chart-card {
    background: var(--card-bg, #fff);
    border-radius: 0.75rem;
    padding: 1.25rem;
    border: 1px solid var(--card-border, #e2e8f0);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  }

  :global(html[data-theme='dark']) .retention-chart-card {
    box-shadow: none;
  }

  .retention-chart-card h3 {
    margin: 0 0 1rem;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-color, #0f172a);
  }

  .chart-subtitle {
    font-weight: 400;
    font-size: 0.8rem;
    color: var(--text-muted, #64748b);
  }

  .bar-chart {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .bar-row {
    display: grid;
    grid-template-columns: 4.5rem 1fr 2.5rem;
    align-items: center;
    gap: 0.5rem;
  }

  .bar-label {
    font-size: 0.75rem;
    color: var(--text-muted, #64748b);
    text-align: right;
    white-space: nowrap;
  }

  .bar-track {
    background: var(--card-border, #f1f5f9);
    border-radius: 99px;
    height: 0.6rem;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: 99px;
    transition: width 0.4s ease;
    min-width: 2px;
  }

  .retention-fill {
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
  }
  .stability-fill {
    background: linear-gradient(90deg, #10b981, #34d399);
  }
  .forgetting-fill {
    background: linear-gradient(90deg, #f59e0b, #fbbf24);
  }

  .bar-count {
    font-size: 0.75rem;
    color: var(--text-muted, #64748b);
    text-align: left;
  }

  .upcoming-reviews {
    background: var(--card-bg, #fff);
    border-radius: 0.75rem;
    padding: 1.25rem;
    border: 1px solid var(--card-border, #e2e8f0);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  }

  :global(html[data-theme='dark']) .upcoming-reviews {
    box-shadow: none;
  }

  .upcoming-reviews h3 {
    margin: 0 0 1rem;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-color, #0f172a);
  }

  .upcoming-row {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .upcoming-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--card-border, #f1f5f9);
    border-radius: 0.5rem;
    padding: 0.75rem 1.5rem;
    min-width: 6rem;
  }

  .upcoming-count {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--primary, #4f46e5);
    line-height: 1;
  }

  .upcoming-label {
    font-size: 0.75rem;
    color: var(--text-muted, #64748b);
    margin-top: 0.25rem;
  }

  /* ---- Learning Insights ---- */
  .insights-section {
    margin-bottom: 2.5rem;
  }
  .insights-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }
  .insight-card {
    background: var(--card-bg, #ffffff);
    border: 2px solid var(--card-border, #e2e8f0);
    border-radius: 1rem;
    box-shadow: 0 3px 0 var(--card-border, #e2e8f0);
    padding: 1.25rem;
  }
  :global(html[data-theme='dark']) .insight-card {
    box-shadow: 0 3px 0 var(--card-border, #374151);
  }
  .insight-card h3 {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.95rem;
    font-weight: 800;
    color: var(--text-color, #1e293b);
    margin: 0 0 0.35rem;
  }
  .insight-desc {
    font-size: 0.8rem;
    color: #64748b;
    margin: 0 0 0.85rem;
  }

  /* Urgent fading words */
  .urgent-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .urgent-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
  }
  .urgent-lemma {
    font-weight: 700;
    color: var(--text-color, #1e293b);
    min-width: 80px;
  }
  .urgent-meaning {
    color: #64748b;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 0.8rem;
  }
  .urgent-ret {
    font-family: ui-monospace, monospace;
    font-size: 0.8rem;
    font-weight: 700;
    white-space: nowrap;
  }
  .urgent-lapses {
    font-size: 0.75rem;
    color: #ef4444;
    white-space: nowrap;
  }

  /* Error bars */
  .error-bars {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }
  .error-bar-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
  }
  .error-label {
    width: 110px;
    color: var(--text-color, #475569);
    flex-shrink: 0;
  }
  .error-track {
    flex: 1;
    height: 0.5rem;
    background: var(--card-border, #e2e8f0);
    border-radius: 9999px;
    overflow: hidden;
  }
  .error-fill {
    height: 100%;
    background: #f97316;
    border-radius: 9999px;
    transition: width 0.3s;
  }
  .error-count {
    font-family: ui-monospace, monospace;
    font-size: 0.8rem;
    color: #64748b;
    width: 24px;
    text-align: right;
  }
  .override-note {
    margin: 0.75rem 0 0;
    font-size: 0.78rem;
    color: #64748b;
    font-style: italic;
  }

  /* Grammar coverage */
  .coverage-rows {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-bottom: 0.85rem;
  }
  .coverage-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.82rem;
  }
  .coverage-dot {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .coverage-label {
    flex: 1;
    color: var(--text-color, #475569);
  }
  .coverage-val {
    font-family: ui-monospace, monospace;
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--text-color, #1e293b);
  }
  .coverage-bar-track {
    display: flex;
    height: 0.6rem;
    border-radius: 9999px;
    overflow: hidden;
    background: var(--card-border, #e2e8f0);
  }
  .coverage-seg {
    height: 100%;
    transition: width 0.3s;
  }
  .mastered-seg {
    background: #10b981;
  }
  .learning-seg {
    background: #fef08a;
    border-top: 1px solid #ca8a04;
    border-bottom: 1px solid #ca8a04;
  }
  .available-seg {
    background: #cbd5e1;
  }

  /* ── Algorithm Intelligence section ─────────────────────────────────── */
  .algo-section {
    margin: 2rem 0;
    padding: 0 1rem;
  }
  .algo-intro {
    font-size: 0.88rem;
    color: var(--text-muted, #64748b);
    margin: 0.25rem 0 1.25rem;
  }
  .algo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }
  .algo-card {
    background: var(--card-bg, #fff);
    border: 1px solid var(--card-border, #e2e8f0);
    border-radius: 0.75rem;
    padding: 1rem 1.1rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .algo-card-title {
    font-size: 0.92rem;
    font-weight: 700;
    color: var(--text-color, #1e293b);
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0 0 0.15rem;
  }
  .algo-card-desc {
    font-size: 0.8rem;
    color: var(--text-muted, #64748b);
    margin: 0 0 0.5rem;
    line-height: 1.4;
  }
  .algo-stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.82rem;
  }
  .algo-stat-label {
    color: var(--text-muted, #64748b);
  }
  .algo-stat-value {
    font-weight: 700;
    color: var(--text-color, #1e293b);
    font-family: ui-monospace, monospace;
  }
  .algo-cap {
    color: #2563eb;
  }
  .algo-ema-bar {
    height: 6px;
    border-radius: 9999px;
    background: var(--card-border, #e2e8f0);
    overflow: hidden;
    margin: 0.2rem 0;
  }
  .algo-ema-fill {
    height: 100%;
    background: linear-gradient(90deg, #f97316, #22c55e);
    border-radius: 9999px;
    transition: width 0.4s;
  }
  .algo-footnote {
    font-size: 0.73rem;
    color: var(--text-muted, #94a3b8);
    margin-top: 0.35rem;
    font-style: italic;
  }

  /* Bandit arms */
  .bandit-arms {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .bandit-arm-row {
    display: grid;
    grid-template-columns: 5.5rem 1fr 2.5rem 3rem;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    padding: 0.1rem 0.3rem;
    border-radius: 0.3rem;
  }
  .bandit-best {
    background: color-mix(in srgb, #2563eb 8%, transparent);
  }
  .bandit-arm-label {
    font-size: 0.78rem;
    color: var(--text-color, #1e293b);
    font-weight: 600;
  }
  .bandit-arm-track {
    height: 6px;
    border-radius: 9999px;
    background: var(--card-border, #e2e8f0);
    overflow: hidden;
  }
  .bandit-arm-fill {
    height: 100%;
    background: #2563eb;
    border-radius: 9999px;
    transition: width 0.4s;
  }
  .bandit-arm-pct {
    font-family: ui-monospace, monospace;
    font-size: 0.78rem;
    text-align: right;
  }
  .bandit-arm-obs {
    color: var(--text-muted, #94a3b8);
    font-size: 0.7rem;
    text-align: right;
  }

  /* ELO variance list */
  .variance-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .variance-row {
    display: grid;
    grid-template-columns: 1fr 2.5rem 3rem 3rem;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    padding: 0.1rem 0;
    border-bottom: 1px solid var(--card-border, #f1f5f9);
  }
  .variance-lemma {
    font-weight: 600;
    color: var(--text-color, #1e293b);
  }
  .variance-level {
    font-size: 0.7rem;
    color: var(--text-muted, #94a3b8);
    text-align: center;
  }
  .variance-elo {
    font-family: ui-monospace, monospace;
    font-size: 0.78rem;
    text-align: right;
  }
  .variance-sigma {
    font-family: ui-monospace, monospace;
    font-size: 0.78rem;
    color: #f97316;
    text-align: right;
  }

  /* PFA at-risk list */
  .pfa-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .pfa-row {
    display: grid;
    grid-template-columns: 1fr 2.5rem 2.5rem;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    padding: 0.1rem 0;
    border-bottom: 1px solid var(--card-border, #f1f5f9);
  }
  .pfa-title {
    font-weight: 600;
    color: var(--text-color, #1e293b);
  }
  .pfa-level {
    font-size: 0.7rem;
    color: var(--text-muted, #94a3b8);
    text-align: center;
  }
  .pfa-p {
    font-family: ui-monospace, monospace;
    font-size: 0.82rem;
    font-weight: 700;
    text-align: right;
  }

  /* Co-occurrence list */
  .coerr-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .coerr-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr auto;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    padding: 0.15rem 0;
    border-bottom: 1px solid var(--card-border, #f1f5f9);
  }
  .coerr-from,
  .coerr-to {
    color: var(--text-color, #1e293b);
    font-weight: 500;
  }
  .coerr-arrow {
    color: var(--text-muted, #94a3b8);
    font-size: 0.85rem;
  }
  .coerr-strength {
    font-size: 0.68rem;
    font-weight: 700;
    padding: 0.1rem 0.35rem;
    border-radius: 9999px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .coerr-strong {
    background: #fef2f2;
    color: #dc2626;
  }
  .coerr-moderate {
    background: #fff7ed;
    color: #ea580c;
  }
  .coerr-weak {
    background: #f8fafc;
    color: #64748b;
  }

  /* ---- New Word Intake ---- */
  .intake-card {
    background: var(--card-bg, #ffffff);
    border: 1px solid var(--card-border, #e2e8f0);
    border-radius: 0.75rem;
    padding: 1.1rem 1.25rem;
    margin-top: 1rem;
  }
  .intake-card h3 {
    margin: 0 0 0.25rem;
    font-size: 0.88rem;
    font-weight: 700;
    color: var(--text-color, #0f172a);
  }
  .intake-bars {
    display: flex;
    align-items: flex-end;
    gap: 0.4rem;
    height: 7rem;
    margin-top: 0.75rem;
  }
  .intake-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    height: 100%;
  }
  .intake-count {
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--primary, #4f46e5);
    min-height: 1rem;
    line-height: 1;
  }
  .intake-bar-track {
    flex: 1;
    width: 100%;
    background: var(--card-border, #e2e8f0);
    border-radius: 0.25rem 0.25rem 0 0;
    display: flex;
    align-items: flex-end;
    overflow: hidden;
  }
  .intake-bar-fill {
    width: 100%;
    background: var(--primary, #4f46e5);
    border-radius: 0.2rem 0.2rem 0 0;
    transition: height 0.4s ease;
    min-height: 2px;
  }
  .intake-label {
    font-size: 0.6rem;
    color: var(--text-muted, #94a3b8);
    margin-top: 0.25rem;
    text-align: center;
    white-space: nowrap;
  }
  :global(html[data-theme='dark']) .intake-card {
    background: var(--card-bg, #1e293b);
    border-color: var(--card-border, #334155);
  }
  :global(html[data-theme='dark']) .intake-bar-track {
    background: #334155;
  }

  /* ---- Recently Mastered ---- */
  .mastered-card {
    border-left: 3px solid #10b981;
  }
  .mastered-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.6rem;
  }
  .mastered-chip {
    background: #f0fdf4;
    color: #059669;
    border: 1px solid #a7f3d0;
    border-radius: 9999px;
    padding: 0.2rem 0.65rem;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: default;
    transition: background 0.15s;
  }
  :global(html[data-theme='dark']) .mastered-chip {
    background: #064e3b;
    color: #6ee7b7;
    border-color: #065f46;
  }

  /* ---- Most Confused ---- */
  .confused-card {
    border-left: 3px solid #f97316;
  }
  .confused-list {
    list-style: none;
    margin: 0.5rem 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .confused-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.82rem;
  }
  .confused-lemma {
    font-weight: 700;
    color: var(--text-color, #0f172a);
    min-width: 6rem;
  }
  .confused-meaning {
    color: var(--text-muted, #64748b);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .confused-lapses {
    font-size: 0.73rem;
    background: #fff7ed;
    color: #c2410c;
    border-radius: 9999px;
    padding: 0.1rem 0.45rem;
    font-weight: 700;
    flex-shrink: 0;
  }
  :global(html[data-theme='dark']) .confused-lapses {
    background: #431407;
    color: #fb923c;
  }

  /* ---- Parts of Speech ---- */
  .pos-card {
    border-left: 3px solid #8b5cf6;
  }
  .pos-bars {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin-top: 0.6rem;
  }
  .pos-bar-row {
    display: grid;
    grid-template-columns: 5.5rem 1fr 2rem;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
  }
  .pos-label {
    color: var(--text-color, #0f172a);
    font-weight: 500;
  }
  .pos-track {
    height: 0.5rem;
    background: var(--card-border, #e2e8f0);
    border-radius: 9999px;
    overflow: hidden;
  }
  .pos-fill {
    height: 100%;
    background: #8b5cf6;
    border-radius: 9999px;
    transition: width 0.4s ease;
  }
  .pos-count {
    text-align: right;
    color: var(--text-muted, #64748b);
    font-weight: 600;
  }

  /* ---- CEFR Level Breakdown ---- */
  .cefr-card {
    border-left: 3px solid #0ea5e9;
  }
  .cefr-grid {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    margin-top: 0.65rem;
  }
  .cefr-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .cefr-badge {
    font-size: 0.68rem;
    font-weight: 800;
    padding: 0.1rem 0.4rem;
    border-radius: 0.3rem;
    letter-spacing: 0.04em;
    min-width: 2.4rem;
    text-align: center;
    flex-shrink: 0;
  }
  .cefr-a1 {
    background: #dcfce7;
    color: #15803d;
  }
  .cefr-a2 {
    background: #d1fae5;
    color: #059669;
  }
  .cefr-b1 {
    background: #dbeafe;
    color: #1d4ed8;
  }
  .cefr-b2 {
    background: #ede9fe;
    color: #7c3aed;
  }
  .cefr-c1 {
    background: #fce7f3;
    color: #be185d;
  }
  .cefr-c2 {
    background: #fef3c7;
    color: #b45309;
  }
  .cefr-bar-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
  }
  .cefr-bar-track {
    flex: 1;
    height: 0.45rem;
    background: var(--card-border, #e2e8f0);
    border-radius: 9999px;
    overflow: hidden;
  }
  .cefr-bar-fill {
    height: 100%;
    background: #0ea5e9;
    border-radius: 9999px;
    transition: width 0.4s ease;
  }
  .cefr-nums {
    font-size: 0.73rem;
    color: var(--text-muted, #64748b);
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* ---- Next Grammar Unlocks ---- */
  .unlocks-card {
    border-left: 3px solid #f59e0b;
  }
  .unlocks-list {
    list-style: none;
    margin: 0.5rem 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .unlock-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 0.82rem;
    padding: 0.3rem 0.5rem;
    background: var(--card-border, #f8fafc);
    border-radius: 0.4rem;
  }
  .unlock-title {
    font-weight: 600;
    color: var(--text-color, #0f172a);
    flex: 1;
  }
  :global(html[data-theme='dark']) .unlock-row {
    background: #1e293b;
  }

  /* ---- ELO Calibration ---- */
  .calibration-chart {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    height: 7rem;
    margin-top: 0.75rem;
  }
  .cal-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    height: 100%;
  }
  .cal-pct {
    font-size: 0.65rem;
    font-weight: 700;
    color: var(--primary, #4f46e5);
    min-height: 1rem;
  }
  .cal-bar-track {
    flex: 1;
    width: 100%;
    background: var(--card-border, #e2e8f0);
    border-radius: 0.25rem 0.25rem 0 0;
    display: flex;
    align-items: flex-end;
    overflow: hidden;
  }
  .cal-bar-fill {
    width: 100%;
    background: linear-gradient(180deg, #10b981, #059669);
    border-radius: 0.2rem 0.2rem 0 0;
    transition: height 0.4s ease;
    min-height: 2px;
  }
  .cal-elo {
    font-size: 0.6rem;
    color: var(--text-muted, #64748b);
    margin-top: 0.2rem;
  }
  .cal-n {
    font-size: 0.55rem;
    color: var(--text-muted, #94a3b8);
  }
  :global(html[data-theme='dark']) .cal-bar-track {
    background: #334155;
  }

  /* ---- Word Frequency Coverage ---- */
  .freq-coverage-rows {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.6rem;
  }
  .freq-row {
    display: grid;
    grid-template-columns: 3.5rem 1fr 3.5rem 2.5rem;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
  }
  .freq-label {
    font-weight: 700;
    color: var(--text-color, #0f172a);
  }
  .freq-track {
    height: 0.5rem;
    background: var(--card-border, #e2e8f0);
    border-radius: 9999px;
    overflow: hidden;
  }
  .freq-fill {
    height: 100%;
    background: #4f46e5;
    border-radius: 9999px;
    transition: width 0.4s ease;
  }
  .freq-stat {
    text-align: right;
    color: var(--text-muted, #64748b);
    font-size: 0.73rem;
  }
  .freq-pct {
    font-weight: 700;
    color: var(--primary, #4f46e5);
    text-align: right;
  }
  :global(html[data-theme='dark']) .freq-track {
    background: #334155;
  }
</style>

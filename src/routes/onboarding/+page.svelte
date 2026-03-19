<script lang="ts">
  import { fly } from 'svelte/transition';
  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  import { toastError } from '$lib/utils/toast';

  let { data }: { data: any } = $props();

  let activeLanguageName = $derived(data?.user?.activeLanguage?.name ?? '');

  // ── Global state ──────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let loading = $state(false);
  let completed = $state(false);
  let completionData: { level?: string; feedback?: string } = $state({});

  // Flow: language → choose → beginner | quiz → chat → done
  type FlowStep = 'language' | 'choose' | 'beginner' | 'quiz' | 'chat';
  let step: FlowStep = $state('language');
  let isSubmittingBeginner = $state(false);

  $effect(() => {
    const lang = data?.user?.activeLanguage;
    const forceLanguageStep = $page.url.searchParams.get('step') === 'language';
    step = !lang || forceLanguageStep ? 'language' : 'choose';
    completed = false;
    resetQuiz();
    resetChat();
  });

  const restartOnboarding = () => {
    completed = false;
    step = 'choose';
    resetQuiz();
    resetChat();
  };

  // ── Language selection ─────────────────────────────────────────────────────
  const selectLanguage = async (languageId: string) => {
    try {
      const res = await fetch('/api/user/active-language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ languageId })
      });
      if (res.ok) {
        await invalidateAll();
        step = 'choose';
      }
    } catch (_) {
      toastError('Failed to select language');
    }
  };

  // ── Beginner path (unchanged) ─────────────────────────────────────────────
  const handleBeginnerPath = async () => {
    if (completed || isSubmittingBeginner) return;
    isSubmittingBeginner = true;
    step = 'beginner';

    try {
      const res = await fetch('/api/onboarding/beginner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to set up beginner account');
      }
      const result = await res.json();
      if (result.success) {
        completed = true;
        completionData = { level: result.level, feedback: result.message };
      }
    } catch (e) {
      toastError((e as any).message || 'Failed to set up beginner account');
      step = 'choose';
    } finally {
      isSubmittingBeginner = false;
    }
  };

  // ── Adaptive MC Quiz ──────────────────────────────────────────────────────
  const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  type QuizQuestion = {
    type: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
    vocabId?: string;
    grammarRuleId?: string;
    grammarRuleTitle?: string;
    lemma?: string;
  };

  let quizLevel = $state('A1');
  let quizQuestions: QuizQuestion[] = $state([]);
  let quizIndex = $state(0);
  let quizSelected: number | null = $state(null);
  let quizShowResult = $state(false);
  let quizCorrectCount = $state(0);
  let quizLoading = $state(false);
  let immersionData: {
    mediaType: string;
    label: string;
    icon: string;
    templateData: Record<string, unknown>;
  } | null = $state(null);

  // Accumulated results across all levels for SRS seeding + chat context
  let allVocabResults: Array<{ vocabId: string; correct: boolean; lemma: string }> = $state([]);
  let allGrammarResults: Array<{
    grammarRuleId: string;
    correct: boolean;
    grammarRuleTitle: string;
  }> = $state([]);
  let scoresByLevel: Record<string, number> = $state({});
  let levelsAttempted: string[] = $state([]);

  // Current-round tracking
  let roundVocabResults: Array<{ vocabId: string; correct: boolean }> = $state([]);
  let roundGrammarResults: Array<{ grammarRuleId: string; correct: boolean }> = $state([]);
  let roundTotalQuestions = $state(0);

  let currentQuestion = $derived(quizQuestions[quizIndex]);
  let quizProgress = $derived(
    quizQuestions.length > 0 ? `${quizIndex + 1} / ${quizQuestions.length}` : ''
  );

  function resetQuiz() {
    quizLevel = 'A1';
    quizQuestions = [];
    quizIndex = 0;
    quizSelected = null;
    quizShowResult = false;
    quizCorrectCount = 0;
    immersionData = null;
    allVocabResults = [];
    allGrammarResults = [];
    scoresByLevel = {};
    levelsAttempted = [];
    roundVocabResults = [];
    roundGrammarResults = [];
    roundTotalQuestions = 0;
  }

  const startQuiz = () => {
    resetQuiz();
    step = 'quiz';
    fetchQuizRound('A1');
  };

  async function fetchQuizRound(level: string) {
    quizLoading = true;
    quizLevel = level;
    quizIndex = 0;
    quizSelected = null;
    quizShowResult = false;
    quizCorrectCount = 0;
    quizQuestions = [];
    immersionData = null;
    roundVocabResults = [];
    roundGrammarResults = [];

    try {
      const res = await fetch('/api/onboarding/placement/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate quiz');
      }
      const result = await res.json();

      // Combine all question types into one flat array
      const questions: QuizQuestion[] = [
        ...(result.vocabQuestions || []),
        ...(result.grammarQuestions || []),
        ...(result.comprehensionQuestions || [])
      ];
      quizQuestions = questions;
      roundTotalQuestions = questions.length;
      immersionData = result.immersionData || null;
    } catch (e) {
      toastError((e as any).message || 'Failed to generate placement quiz');
      step = 'choose';
    } finally {
      quizLoading = false;
    }
  }

  function selectQuizOption(optionIndex: number) {
    if (quizShowResult || quizSelected !== null) return;
    quizSelected = optionIndex;
    const correct = optionIndex === currentQuestion.correctIndex;
    if (correct) quizCorrectCount++;
    quizShowResult = true;

    // Track for SRS seeding
    if (currentQuestion.type === 'vocab_mc' && currentQuestion.vocabId) {
      roundVocabResults = [...roundVocabResults, { vocabId: currentQuestion.vocabId, correct }];
      allVocabResults = [
        ...allVocabResults,
        {
          vocabId: currentQuestion.vocabId,
          correct,
          lemma: currentQuestion.lemma || ''
        }
      ];
    } else if (currentQuestion.type === 'grammar_mc' && currentQuestion.grammarRuleId) {
      roundGrammarResults = [
        ...roundGrammarResults,
        { grammarRuleId: currentQuestion.grammarRuleId, correct }
      ];
      allGrammarResults = [
        ...allGrammarResults,
        {
          grammarRuleId: currentQuestion.grammarRuleId,
          correct,
          grammarRuleTitle: currentQuestion.grammarRuleTitle || ''
        }
      ];
    }
  }

  async function nextQuizQuestion() {
    if (quizIndex < quizQuestions.length - 1) {
      quizIndex++;
      quizSelected = null;
      quizShowResult = false;
      return;
    }

    // Round complete — grade it
    await gradeRound();
  }

  async function gradeRound() {
    quizLoading = true;
    const roundScore = roundTotalQuestions > 0 ? quizCorrectCount / roundTotalQuestions : 0;
    scoresByLevel = { ...scoresByLevel, [quizLevel]: roundScore };
    levelsAttempted = [...levelsAttempted, quizLevel];

    try {
      const res = await fetch('/api/onboarding/placement/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: quizLevel,
          totalQuestions: roundTotalQuestions,
          correctCount: quizCorrectCount,
          vocabResults: roundVocabResults,
          grammarResults: roundGrammarResults,
          quizSummary: {
            levelsAttempted,
            scoresByLevel,
            wrongVocabLemmas: allVocabResults.filter((r) => !r.correct).map((r) => r.lemma),
            wrongGrammarTitles: allGrammarResults
              .filter((r) => !r.correct)
              .map((r) => r.grammarRuleTitle)
          }
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to grade quiz');
      }

      const result = await res.json();

      if (result.advance && result.nextLevel) {
        // User aced this level — advance to next
        await fetchQuizRound(result.nextLevel);
      } else if (result.readyForChat) {
        // Quiz complete — transition to short targeted chat
        tentativeLevel = result.tentativeLevel || quizLevel;
        step = 'chat';
        startChat();
      }
    } catch (e) {
      toastError((e as any).message || 'Failed to process quiz results');
    } finally {
      quizLoading = false;
    }
  }

  // Keyboard shortcuts for quiz (1-4 / A-D)
  function handleQuizKeydown(e: KeyboardEvent) {
    if (step !== 'quiz' || quizShowResult || quizLoading || !currentQuestion) return;
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    const keyMap: Record<string, number> = {
      '1': 0,
      a: 0,
      '2': 1,
      b: 1,
      '3': 2,
      c: 2,
      '4': 3,
      d: 3
    };
    const idx = keyMap[e.key.toLowerCase()];
    if (idx !== undefined && currentQuestion.options && idx < currentQuestion.options.length) {
      e.preventDefault();
      selectQuizOption(idx);
    }
  }

  // ── Post-quiz targeted chat ───────────────────────────────────────────────
  let tentativeLevel = $state('A1');
  let chatMessages: { role: string; content: string }[] = $state([]);
  let chatInput = $state('');
  let chatLoading = $state(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let lastChatLevelGuess = $state('A1');

  function resetChat() {
    chatMessages = [];
    chatInput = '';
    chatLoading = false;
    tentativeLevel = 'A1';
    lastChatLevelGuess = 'A1';
  }

  async function startChat() {
    chatLoading = true;
    chatMessages = [];
    try {
      const res = await fetch('/api/onboarding/placement/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [],
          tentativeLevel,
          quizSummary: {
            levelsAttempted,
            scoresByLevel,
            wrongVocabLemmas: allVocabResults.filter((r) => !r.correct).map((r) => r.lemma),
            wrongGrammarTitles: allGrammarResults
              .filter((r) => !r.correct)
              .map((r) => r.grammarRuleTitle)
          }
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start chat');
      }

      const result = await res.json();
      chatMessages = [{ role: 'assistant', content: result.message }];
      lastChatLevelGuess = result.currentLevelGuess || tentativeLevel;
    } catch (e) {
      toastError((e as any).message || 'Failed to start placement chat');
      // Fall back: finalize with tentative level
      await finalizePlacement(tentativeLevel, 'Placed based on quiz results.');
    } finally {
      chatLoading = false;
    }
  }

  async function sendChatMessage() {
    if (completed || chatLoading) return;
    if (!chatInput.trim()) return;

    const userMsg = chatInput.trim();
    chatInput = '';
    chatMessages = [...chatMessages, { role: 'user', content: userMsg }];
    chatLoading = true;

    try {
      const apiMessages = chatMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }));

      const res = await fetch('/api/onboarding/placement/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          tentativeLevel,
          quizSummary: {
            levelsAttempted,
            scoresByLevel,
            wrongVocabLemmas: allVocabResults.filter((r) => !r.correct).map((r) => r.lemma),
            wrongGrammarTitles: allGrammarResults
              .filter((r) => !r.correct)
              .map((r) => r.grammarRuleTitle)
          }
        })
      });

      if (!res.ok) {
        throw new Error('Failed to send message');
      }

      // Stream the response
      chatMessages = [...chatMessages, { role: 'assistant', content: '' }];
      const assistantIndex = chatMessages.length - 1;
      chatLoading = false;

      const reader = res.body?.getReader();
      if (!reader) throw new Error('Failed to get stream');

      const decoder = new TextDecoder();
      let responseText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        responseText += decoder.decode(value, { stream: true });

        const match = responseText.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)/);
        if (match && match[1]) {
          try {
            chatMessages[assistantIndex].content = JSON.parse(`"${match[1]}"`);
          } catch (_) {
            chatMessages[assistantIndex].content = match[1]
              .replace(/\\n/g, '\n')
              .replace(/\\"/g, '"');
          }
          chatMessages = [...chatMessages];
        }
      }

      try {
        const parsed = JSON.parse(responseText);
        if (parsed.message) {
          chatMessages[assistantIndex].content = parsed.message;
          chatMessages = [...chatMessages];
        }
        if (parsed.currentLevelGuess) {
          lastChatLevelGuess = parsed.currentLevelGuess;
        }
        if (parsed.completed) {
          completed = true;
          completionData = { level: parsed.level, feedback: parsed.feedback };
        }
      } catch (e) {
        console.error('Failed to parse chat response', e, responseText);
      }
    } catch (e) {
      toastError((e as any).message || 'Failed to send message');
    } finally {
      chatLoading = false;
    }
  }

  async function finalizePlacement(level: string, feedback: string) {
    completed = true;
    completionData = { level, feedback };
  }
</script>

<svelte:head>
  <title>Placement Test | LingoLearn</title>
</svelte:head>

<svelte:window onkeydown={handleQuizKeydown} />

<main class="onboarding-container" class:chat-active={step === 'chat' && !completed}>
  {#if !completed}
    {@const stepNumber =
      step === 'language'
        ? 1
        : step === 'choose'
          ? 2
          : step === 'beginner' || step === 'quiz'
            ? 3
            : 4}
    {@const totalSteps = 4}
    <div class="onboarding-progress">
      <div class="onboarding-progress-bar">
        <div
          class="onboarding-progress-fill"
          style="width: {(stepNumber / totalSteps) * 100}%"
        ></div>
      </div>
      <span class="onboarding-progress-label">Step {stepNumber} of {totalSteps}</span>
    </div>
  {/if}
  {#if step === 'language' && !completed}
    <!-- ── Language Selection ─────────────────────────────────────────────── -->
    <header class="page-header" in:fly={{ y: 20, duration: 400 }}>
      <h1>Choose a Language</h1>
      <p>Pick a language to start or reset your placement test.</p>
    </header>
    <div class="path-selection horizontal" in:fly={{ y: 20, duration: 400, delay: 100 }}>
      {#each data.languages || [] as lang}
        {@const isOnboarded = (data.onboardedLanguages || []).some((l) => l.id === lang.id)}
        <button class="path-card" onclick={() => selectLanguage(lang.id)}>
          <span class="path-icon">{lang.flag || '🌐'}</span>
          <h2>{lang.name}</h2>
          {#if isOnboarded}
            <span class="path-badge reset-badge">Retake placement test</span>
          {:else}
            <span class="path-badge new-lang-badge">Start learning</span>
          {/if}
        </button>
      {/each}
    </div>
  {:else if step === 'choose' && !completed}
    <!-- ── Path Selection ────────────────────────────────────────────────── -->
    <header class="page-header" in:fly={{ y: 20, duration: 400 }}>
      <h1>Welcome to LingoLearn!</h1>
      <p>Let's set up your learning experience. Choose the option that best describes you:</p>
    </header>

    <div class="path-selection" in:fly={{ y: 20, duration: 400, delay: 100 }}>
      <button
        class="path-card beginner-card"
        onclick={handleBeginnerPath}
        disabled={isSubmittingBeginner}
      >
        <span class="path-icon">🌱</span>
        <h2>I'm a Complete Beginner</h2>
        <p>
          I have zero or almost zero language knowledge. Start me from the very basics — greetings,
          pronouns, simple words.
        </p>
        <span class="path-badge beginner-badge">Recommended for new learners</span>
      </button>

      <button class="path-card test-card" onclick={startQuiz}>
        <span class="path-icon">📝</span>
        <h2>I Know Some {activeLanguageName}</h2>
        <p>
          Take a quick placement quiz with vocabulary, grammar, and reading comprehension questions
          to find your exact level.
        </p>
        <span class="path-badge test-badge">Takes 3-8 minutes</span>
      </button>
    </div>
  {:else if step === 'quiz' && !completed}
    <!-- ── Adaptive MC Quiz ──────────────────────────────────────────────── -->
    <header class="page-header" in:fly={{ y: 20, duration: 400 }}>
      <h1>Placement Quiz — Level {quizLevel}</h1>
      <p>
        {#if quizLoading}
          Generating questions...
        {:else}
          Question {quizProgress}
        {/if}
      </p>
    </header>

    <!-- Level progress bar -->
    <div class="level-progress-bar" in:fly={{ y: 20, duration: 400 }}>
      {#each CEFR_LEVELS as lvl}
        <div
          class="level-pip"
          class:active={lvl === quizLevel}
          class:completed-level={levelsAttempted.includes(lvl)}
          class:future={!levelsAttempted.includes(lvl) && lvl !== quizLevel}
        >
          {lvl}
        </div>
      {/each}
    </div>

    {#if quizLoading}
      <div class="quiz-loading" in:fly={{ y: 20, duration: 400 }}>
        <div class="spinner"></div>
        <p>Preparing {quizLevel} questions...</p>
      </div>
    {:else if currentQuestion}
      <div class="quiz-card" in:fly={{ y: 20, duration: 300 }}>
        <!-- Immersion content (shown for comprehension questions) -->
        {#if currentQuestion.type === 'comprehension_mc' && immersionData}
          {@const td = immersionData.templateData}
          <div class="immersion-passage">
            <p class="passage-label">
              <span class="media-icon">{immersionData.icon}</span>
              {immersionData.label} — Read and answer
            </p>

            {#if immersionData.mediaType === 'news_article'}
              <div class="media-content news">
                {#if td.source}<span class="news-source">{td.source}</span>{/if}
                {#if td.date}<span class="news-date">{td.date}</span>{/if}
                {#if td.headline}<h3 class="news-headline">{td.headline}</h3>{/if}
                {#if td.byline}<p class="news-byline">{td.byline}</p>{/if}
                {#if td.body}<p class="media-body">{td.body}</p>{/if}
              </div>
            {:else if immersionData.mediaType === 'advertisement'}
              <div class="media-content ad">
                {#if td.brand}<p class="ad-brand">{td.brand}</p>{/if}
                {#if td.product}<h3 class="ad-product">{td.product}</h3>{/if}
                {#if td.slogan}<p class="ad-slogan">"{td.slogan}"</p>{/if}
                {#if Array.isArray(td.features)}
                  <ul class="ad-features">
                    {#each td.features as feat}<li>{feat}</li>{/each}
                  </ul>
                {/if}
                {#if td.price}<p class="ad-price">{td.price}</p>{/if}
                {#if td.callToAction}<p class="ad-cta">{td.callToAction}</p>{/if}
              </div>
            {:else if immersionData.mediaType === 'restaurant_menu'}
              <div class="media-content menu">
                {#if td.restaurantName}<h3 class="menu-name">{td.restaurantName}</h3>{/if}
                {#if td.tagline}<p class="menu-tagline">{td.tagline}</p>{/if}
                {#if Array.isArray(td.sections)}
                  {#each td.sections as section}
                    <h4 class="menu-section">{section.name}</h4>
                    {#if Array.isArray(section.items)}
                      {#each section.items as item}
                        <div class="menu-item">
                          <span class="menu-item-name">{item.name}</span>
                          <span class="menu-item-price">{item.price}</span>
                          {#if item.description}<p class="menu-item-desc">
                              {item.description}
                            </p>{/if}
                        </div>
                      {/each}
                    {/if}
                  {/each}
                {/if}
              </div>
            {:else if immersionData.mediaType === 'social_post'}
              <div class="media-content social">
                <div class="social-header">
                  {#if td.username}<strong>{td.username}</strong>{/if}
                  {#if td.handle}<span class="social-handle">{td.handle}</span>{/if}
                </div>
                {#if td.content}<p class="social-content">{td.content}</p>{/if}
                {#if Array.isArray(td.hashtags)}
                  <p class="social-hashtags">{td.hashtags.join(' ')}</p>
                {/if}
                <div class="social-meta">
                  {#if td.likes}<span>{td.likes} likes</span>{/if}
                  {#if td.timestamp}<span>{td.timestamp}</span>{/if}
                </div>
              </div>
            {:else if immersionData.mediaType === 'recipe'}
              <div class="media-content recipe">
                {#if td.title}<h3>{td.title}</h3>{/if}
                <div class="recipe-meta">
                  {#if td.servings}<span>{td.servings} servings</span>{/if}
                  {#if td.prepTime}<span>{td.prepTime}</span>{/if}
                </div>
                {#if Array.isArray(td.ingredients)}
                  <ul class="recipe-ingredients">
                    {#each td.ingredients as ing}<li>{ing}</li>{/each}
                  </ul>
                {/if}
                {#if Array.isArray(td.steps)}
                  <ol class="recipe-steps">
                    {#each td.steps as s}<li>{s}</li>{/each}
                  </ol>
                {/if}
              </div>
            {:else if immersionData.mediaType === 'review'}
              <div class="media-content review">
                {#if td.subject}<h3>{td.subject}</h3>{/if}
                {#if typeof td.rating === 'number'}
                  <p class="review-stars">{'★'.repeat(td.rating)}{'☆'.repeat(5 - td.rating)}</p>
                {/if}
                {#if td.author}<p class="review-author">{td.author}</p>{/if}
                {#if td.body}<p class="media-body">{td.body}</p>{/if}
                {#if td.verdict}<p class="review-verdict"><em>{td.verdict}</em></p>{/if}
              </div>
            {:else if immersionData.mediaType === 'letter'}
              <div class="media-content letter">
                <div class="letter-header">
                  {#if td.location}<span>{td.location}</span>{/if}
                  {#if td.date}<span>{td.date}</span>{/if}
                </div>
                {#if td.salutation}<p class="letter-salutation">{td.salutation}</p>{/if}
                {#if td.body}<p class="media-body">{td.body}</p>{/if}
                {#if td.closing}<p class="letter-closing">{td.closing}</p>{/if}
                {#if td.signature}<p class="letter-sig">{td.signature}</p>{/if}
              </div>
            {:else if immersionData.mediaType === 'email'}
              <div class="media-content email-content">
                <div class="email-header">
                  {#if td.from}<p><strong>From:</strong> {td.from}</p>{/if}
                  {#if td.to}<p><strong>To:</strong> {td.to}</p>{/if}
                  {#if td.subject}<p><strong>Subject:</strong> {td.subject}</p>{/if}
                </div>
                {#if td.body}<p class="media-body">{td.body}</p>{/if}
                {#if td.signature}<p class="email-sig">{td.signature}</p>{/if}
              </div>
            {:else if immersionData.mediaType === 'text_messages'}
              <div class="media-content texts">
                {#if Array.isArray(td.messages)}
                  {#each td.messages as msg}
                    <div
                      class="text-msg"
                      class:text-right={td.participants &&
                        Array.isArray(td.participants) &&
                        msg.sender === td.participants[1]}
                    >
                      <span class="text-sender">{msg.sender}</span>
                      <span class="text-bubble">{msg.text}</span>
                      <span class="text-time">{msg.time}</span>
                    </div>
                  {/each}
                {/if}
              </div>
            {:else if immersionData.mediaType === 'train_announcement'}
              <div class="media-content train">
                {#if td.station}<h3 class="train-station">{td.station}</h3>{/if}
                {#if Array.isArray(td.announcements)}
                  <table class="train-board">
                    <thead>
                      <tr>
                        <th>Line</th>
                        <th>Destination</th>
                        <th>Plat.</th>
                        <th>Dep.</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each td.announcements as a}
                        <tr>
                          <td>{a.line}</td>
                          <td>{a.destination}</td>
                          <td>{a.platform}</td>
                          <td>{a.departure}</td>
                          <td class="train-status">{a.status}</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                {/if}
                {#if td.spokenAnnouncement}
                  <p class="train-spoken">🔊 {td.spokenAnnouncement}</p>
                {/if}
              </div>
            {:else if immersionData.mediaType === 'weather_forecast'}
              <div class="media-content weather">
                <div class="weather-header">
                  {#if td.location}<h3>{td.location}</h3>{/if}
                  {#if td.date}<span>{td.date}</span>{/if}
                </div>
                {#if td.conditions}<p class="weather-conditions">{td.conditions}</p>{/if}
                <div class="weather-temps">
                  {#if td.high}<span class="temp-high">{td.high}</span>{/if}
                  {#if td.low}<span class="temp-low">{td.low}</span>{/if}
                </div>
                {#if td.summary}<p>{td.summary}</p>{/if}
                {#if td.details}<p class="media-body">{td.details}</p>{/if}
              </div>
            {:else if immersionData.mediaType === 'job_listing'}
              <div class="media-content job">
                {#if td.company}<p class="job-company">{td.company}</p>{/if}
                {#if td.position}<h3>{td.position}</h3>{/if}
                <div class="job-meta">
                  {#if td.location}<span>{td.location}</span>{/if}
                  {#if td.type}<span>{td.type}</span>{/if}
                </div>
                {#if td.description}<p class="media-body">{td.description}</p>{/if}
                {#if Array.isArray(td.requirements)}
                  <ul>
                    {#each td.requirements as req}<li>{req}</li>{/each}
                  </ul>
                {/if}
                {#if td.contact}<p class="job-contact">{td.contact}</p>{/if}
              </div>
            {:else if immersionData.mediaType === 'event_flyer'}
              <div class="media-content event">
                {#if td.eventName}<h3>{td.eventName}</h3>{/if}
                <div class="event-meta">
                  {#if td.type}<span class="event-type">{td.type}</span>{/if}
                  {#if td.date}<span>{td.date}</span>{/if}
                  {#if td.time}<span>{td.time}</span>{/if}
                </div>
                {#if td.location}<p class="event-location">{td.location}</p>{/if}
                {#if td.description}<p class="media-body">{td.description}</p>{/if}
                {#if td.price}<p class="event-price">{td.price}</p>{/if}
                {#if td.extras}<p class="event-extras">{td.extras}</p>{/if}
              </div>
            {:else if immersionData.mediaType === 'diary_entry'}
              <div class="media-content diary">
                <div class="diary-header">
                  {#if td.date}<span class="diary-date">{td.date}</span>{/if}
                  {#if td.mood}<span class="diary-mood">{td.mood}</span>{/if}
                </div>
                {#if td.entry}<p class="media-body diary-text">{td.entry}</p>{/if}
              </div>
            {:else}
              <!-- Fallback: render all text values -->
              <div class="media-content">
                {#each Object.values(td) as val}
                  {#if typeof val === 'string'}
                    <p>{val}</p>
                  {/if}
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        <p class="quiz-question">{currentQuestion.question}</p>

        <div class="quiz-options">
          {#each currentQuestion.options as option, i}
            {@const isCorrect = i === currentQuestion.correctIndex}
            {@const isSelected = quizSelected === i}
            <button
              class="quiz-option"
              class:correct={quizShowResult && isCorrect}
              class:wrong={quizShowResult && isSelected && !isCorrect}
              class:dimmed={quizShowResult && !isSelected && !isCorrect}
              disabled={quizShowResult}
              onclick={() => selectQuizOption(i)}
            >
              <span class="option-letter">{String.fromCharCode(65 + i)}</span>
              <span class="option-text">{option}</span>
            </button>
          {/each}
        </div>

        {#if quizShowResult}
          <div class="quiz-feedback" in:fly={{ y: 10, duration: 200 }}>
            {#if quizSelected === currentQuestion.correctIndex}
              <p class="feedback-correct">Correct!</p>
            {:else}
              <p class="feedback-wrong">
                Incorrect — the answer is
                <strong>{currentQuestion.options[currentQuestion.correctIndex]}</strong>
              </p>
            {/if}
            {#if currentQuestion.explanation}
              <p class="feedback-explanation">{currentQuestion.explanation}</p>
            {/if}
            <button class="btn btn-primary" onclick={nextQuizQuestion}>
              {#if quizIndex < quizQuestions.length - 1}
                Next Question
              {:else}
                Finish Level {quizLevel}
              {/if}
            </button>
          </div>
        {/if}
      </div>
    {/if}
  {:else if step === 'chat' && !completed}
    <!-- ── Post-quiz targeted chat ───────────────────────────────────────── -->
    <header class="page-header" in:fly={{ y: 20, duration: 400 }}>
      <h1>Almost Done!</h1>
      <p>Let's have a quick conversation to fine-tune your placement.</p>
    </header>

    <div class="content-layout" in:fly={{ y: 20, duration: 400, delay: 100 }}>
      <div class="chat-panel">
        {#if chatMessages.length > 0 || chatLoading}
          <div class="chat-messages">
            {#each chatMessages as msg}
              <div class="message-wrapper {msg.role === 'user' ? 'user' : 'assistant'}">
                <span class="message-sender">{msg.role === 'user' ? 'You' : 'Teacher'}</span>
                <div class="message-bubble {msg.role === 'user' ? 'user' : 'assistant'}">
                  {msg.content}
                </div>
              </div>
            {/each}

            {#if chatLoading}
              <div class="message-wrapper assistant">
                <span class="message-sender">Teacher</span>
                <div class="message-bubble assistant">Thinking...</div>
              </div>
            {/if}
          </div>
        {/if}

        <form
          class="chat-input-form"
          onsubmit={(e) => {
            e.preventDefault();
            sendChatMessage();
          }}
        >
          <input
            type="text"
            bind:value={chatInput}
            disabled={chatLoading || completed}
            placeholder="Type your reply here..."
            class="chat-input"
          />
          <button
            type="submit"
            disabled={chatLoading || completed || !chatInput.trim()}
            class="send-btn"
            aria-label="Send message"
          >
            <svg
              class="icon"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </form>
      </div>
    </div>
  {:else if completed}
    <!-- ── Completion ────────────────────────────────────────────────────── -->
    <header class="page-header" in:fly={{ y: 20, duration: 400 }}>
      <h1>You're All Set!</h1>
      <p>We've prepared a personalized curriculum for you.</p>
    </header>

    <div class="content-layout" in:fly={{ y: 20, duration: 400, delay: 100 }}>
      <div class="chat-panel">
        {#if chatMessages.length > 0}
          <div class="chat-messages">
            {#each chatMessages as msg}
              <div class="message-wrapper {msg.role === 'user' ? 'user' : 'assistant'}">
                <span class="message-sender">{msg.role === 'user' ? 'You' : 'Teacher'}</span>
                <div class="message-bubble {msg.role === 'user' ? 'user' : 'assistant'}">
                  {msg.content}
                </div>
              </div>
            {/each}
          </div>
        {/if}

        <div class="completion-card" class:no-messages={chatMessages.length === 0}>
          <h2>Onboarding Complete!</h2>
          <div class="level-result">
            <span>Your assessed level:</span>
            <strong class="level-badge">{completionData.level}</strong>
          </div>
          {#if completionData.feedback}
            <p class="feedback-text">
              <strong>Feedback:</strong>
              {completionData.feedback}
            </p>
          {/if}
          <div class="completion-actions">
            {#if step === 'beginner'}
              <p class="action-note">
                We've loaded essential starter vocabulary and grammar for you. Your lessons will
                begin with the very basics — no prior language knowledge needed!
              </p>
            {:else}
              <p class="action-note">
                Your personalized curriculum has been generated. We've marked the basics you already
                know as Mastered and queued up words you need to practice!
              </p>
            {/if}
            <div class="completion-buttons">
              <button
                class="btn btn-primary btn-large"
                onclick={() => (window.location.href = '/play')}
              >
                Start Learning
              </button>
              <button
                class="btn btn-outlined"
                onclick={() => (window.location.href = '/dashboard')}
              >
                Go to Dashboard
              </button>
              <button class="btn-text-link" onclick={restartOnboarding}>
                Restart Onboarding
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    font-family:
      'Inter',
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      Roboto,
      Helvetica,
      Arial,
      sans-serif;
    background-color: var(--bg-color, #f8fafc);
    color: var(--text-color, #334155);
  }

  .onboarding-progress {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .onboarding-progress-bar {
    flex: 1;
    height: 6px;
    background: var(--card-border, #e2e8f0);
    border-radius: 999px;
    overflow: hidden;
  }

  .onboarding-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #60a5fa);
    border-radius: 999px;
    transition: width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    position: relative;
    overflow: hidden;
  }

  .onboarding-progress-fill::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.4) 50%,
      transparent 100%
    );
    animation: progress-shimmer 1.6s ease-in-out infinite;
    transform: translateX(-100%);
  }

  @keyframes progress-shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(200%);
    }
  }

  .onboarding-progress-label {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-color, #64748b);
    white-space: nowrap;
  }

  .onboarding-container {
    display: flex;
    flex-direction: column;
    max-width: 1000px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  .onboarding-container.chat-active {
    height: 85vh;
    min-height: 500px;
  }

  .page-header {
    margin-bottom: 1.5rem;
  }

  .page-header h1 {
    font-size: 2rem;
    color: #0f172a;
    margin: 0 0 0.5rem 0;
  }

  .page-header p {
    color: #64748b;
    font-size: 1.1rem;
    margin: 0;
  }

  .content-layout {
    display: flex;
    gap: 1.5rem;
    flex: 1;
    min-height: 0;
  }

  @media (max-width: 768px) {
    .content-layout {
      flex-direction: column;
    }
  }

  /* ── Level progress bar ──────────────────────────────────────────────── */
  .level-progress-bar {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    margin-bottom: 1.5rem;
  }

  .level-pip {
    padding: 0.35rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.8rem;
    font-weight: 700;
    background-color: #e2e8f0;
    color: #64748b;
    transition: all 0.3s;
  }

  .level-pip.active {
    background-color: #22c55e;
    color: white;
    transform: scale(1.1);
  }

  .level-pip.completed-level {
    background-color: #bbf7d0;
    color: #166534;
  }

  .level-pip.future {
    opacity: 0.5;
  }

  :global(html[data-theme='dark']) .level-pip {
    background-color: #2a303c;
    color: #94a3b8;
  }

  :global(html[data-theme='dark']) .level-pip.active {
    background-color: #16a34a;
    color: white;
  }

  :global(html[data-theme='dark']) .level-pip.completed-level {
    background-color: #166534;
    color: #bbf7d0;
  }

  /* ── Quiz card ───────────────────────────────────────────────────────── */
  .quiz-card {
    max-width: 700px;
    margin: 0 auto;
    background: var(--card-bg, #ffffff);
    border: 1px solid var(--card-border, #e2e8f0);
    border-radius: 16px;
    padding: 2rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  .quiz-question {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-color, #0f172a);
    margin: 0 0 1.5rem 0;
    line-height: 1.5;
  }

  .quiz-options {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .quiz-option {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.85rem 1rem;
    border: 2px solid var(--card-border, #e2e8f0);
    border-radius: 12px;
    background: var(--card-bg, #ffffff);
    cursor: pointer;
    transition: all 0.2s;
    font-size: 1rem;
    text-align: left;
    color: var(--text-color, #334155);
  }

  .quiz-option:hover:not(:disabled) {
    border-color: #22c55e;
    background: #f0fdf4;
  }

  .quiz-option.correct {
    border-color: #22c55e;
    background: #dcfce7;
    color: #166534;
  }

  .quiz-option.wrong {
    border-color: #ef4444;
    background: #fef2f2;
    color: #991b1b;
  }

  .quiz-option.dimmed {
    opacity: 0.5;
  }

  .quiz-option:disabled {
    cursor: default;
  }

  :global(html[data-theme='dark']) .quiz-option {
    background: var(--card-bg, #21252e);
    border-color: #3a4150;
    color: var(--text-color, #e2e8f0);
  }

  :global(html[data-theme='dark']) .quiz-option:hover:not(:disabled) {
    border-color: #4ade80;
    background: rgba(20, 83, 45, 0.2);
  }

  :global(html[data-theme='dark']) .quiz-option.correct {
    border-color: #4ade80;
    background: rgba(20, 83, 45, 0.35);
    color: #86efac;
  }

  :global(html[data-theme='dark']) .quiz-option.wrong {
    border-color: #f87171;
    background: rgba(153, 27, 27, 0.25);
    color: #fca5a5;
  }

  .option-letter {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #e2e8f0;
    font-weight: 700;
    font-size: 0.85rem;
    flex-shrink: 0;
    color: #334155;
  }

  .correct .option-letter {
    background: #22c55e;
    color: white;
  }

  .wrong .option-letter {
    background: #ef4444;
    color: white;
  }

  :global(html[data-theme='dark']) .option-letter {
    background: #3a4150;
    color: #cbd5e1;
  }

  .option-text {
    flex: 1;
  }

  /* ── Immersion content ───────────────────────────────────────────────── */
  .immersion-passage {
    margin-bottom: 1.5rem;
    padding: 1.25rem;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 12px;
    /* Prevent hover/selection cheating */
    user-select: none;
    -webkit-user-select: none;
  }

  .immersion-passage .passage-label {
    margin: 0 0 0.75rem 0;
    font-size: 0.85rem;
    font-weight: 600;
    color: #166534;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .media-icon {
    font-size: 1.2rem;
  }

  .media-content {
    font-size: 1rem;
    line-height: 1.7;
    color: #0f172a;
  }

  .media-content h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.15rem;
    color: #0f172a;
  }

  .media-content h4 {
    margin: 0.75rem 0 0.25rem 0;
    font-size: 0.95rem;
    color: #334155;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 0.25rem;
  }

  .media-body {
    margin: 0.5rem 0;
    white-space: pre-wrap;
  }

  .media-content ul,
  .media-content ol {
    margin: 0.5rem 0;
    padding-left: 1.25rem;
  }

  .media-content li {
    margin-bottom: 0.25rem;
  }

  /* News */
  .news-source {
    font-weight: 700;
    font-size: 0.8rem;
    text-transform: uppercase;
    color: #64748b;
    margin-right: 0.5rem;
  }

  .news-date {
    font-size: 0.8rem;
    color: #94a3b8;
  }

  .news-headline {
    font-size: 1.3rem !important;
    margin-top: 0.5rem !important;
  }

  .news-byline {
    font-size: 0.85rem;
    color: #64748b;
    font-style: italic;
    margin: 0 0 0.5rem 0;
  }

  /* Advertisement */
  .ad-brand {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    color: #64748b;
    margin: 0;
  }

  .ad-product {
    font-size: 1.3rem !important;
  }

  .ad-slogan {
    font-style: italic;
    color: #334155;
    font-size: 1.1rem;
    margin: 0.25rem 0;
  }

  .ad-features {
    list-style: none !important;
    padding-left: 0 !important;
  }

  .ad-features li::before {
    content: '✓ ';
    color: #22c55e;
    font-weight: 700;
  }

  .ad-price {
    font-weight: 700;
    font-size: 1.2rem;
    color: #dc2626;
    margin: 0.5rem 0;
  }

  .ad-cta {
    font-weight: 700;
    color: #166534;
    margin: 0.25rem 0 0 0;
  }

  /* Menu */
  .menu-name {
    font-size: 1.3rem !important;
    text-align: center;
  }

  .menu-tagline {
    text-align: center;
    font-style: italic;
    color: #64748b;
    margin: 0 0 0.75rem 0;
    font-size: 0.9rem;
  }

  .menu-item {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: baseline;
    padding: 0.25rem 0;
  }

  .menu-item-name {
    font-weight: 600;
  }

  .menu-item-price {
    font-weight: 600;
    color: #64748b;
  }

  .menu-item-desc {
    width: 100%;
    font-size: 0.85rem;
    color: #64748b;
    margin: 0;
  }

  /* Social post */
  .social-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .social-handle {
    color: #64748b;
    font-size: 0.9rem;
  }

  .social-content {
    margin: 0 0 0.5rem 0;
    white-space: pre-wrap;
  }

  .social-hashtags {
    color: #2563eb;
    font-size: 0.9rem;
    margin: 0 0 0.25rem 0;
  }

  .social-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.8rem;
    color: #94a3b8;
  }

  /* Recipe */
  .recipe-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.85rem;
    color: #64748b;
    margin-bottom: 0.5rem;
  }

  /* Review */
  .review-stars {
    color: #eab308;
    font-size: 1.2rem;
    margin: 0.25rem 0;
    letter-spacing: 0.1em;
  }

  .review-author {
    font-size: 0.85rem;
    color: #64748b;
    margin: 0 0 0.5rem 0;
  }

  .review-verdict {
    margin: 0.5rem 0 0 0;
    font-weight: 600;
  }

  /* Letter / Email */
  .letter-header,
  .email-header {
    margin-bottom: 0.75rem;
    font-size: 0.9rem;
    color: #64748b;
    display: flex;
    justify-content: space-between;
  }

  .email-header {
    flex-direction: column;
    gap: 0.15rem;
  }

  .email-header p {
    margin: 0;
  }

  .letter-salutation {
    margin: 0 0 0.5rem 0;
  }

  .letter-closing {
    margin: 0.75rem 0 0.25rem 0;
  }

  .letter-sig,
  .email-sig {
    font-style: italic;
    margin: 0;
  }

  /* Text messages */
  .texts {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .text-msg {
    display: flex;
    flex-direction: column;
    max-width: 75%;
  }

  .text-msg.text-right {
    align-self: flex-end;
    align-items: flex-end;
  }

  .text-sender {
    font-size: 0.7rem;
    color: #94a3b8;
    margin-bottom: 0.15rem;
  }

  .text-bubble {
    padding: 0.5rem 0.75rem;
    border-radius: 1rem;
    background: #e2e8f0;
    font-size: 0.95rem;
    line-height: 1.4;
  }

  .text-right .text-bubble {
    background: #dcfce7;
  }

  .text-time {
    font-size: 0.65rem;
    color: #94a3b8;
    margin-top: 0.1rem;
  }

  /* Train */
  .train-station {
    text-align: center;
    margin-bottom: 0.5rem !important;
  }

  .train-board {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
    margin-bottom: 0.75rem;
  }

  .train-board th {
    background: #334155;
    color: #e2e8f0;
    padding: 0.35rem 0.5rem;
    text-align: left;
    font-weight: 600;
  }

  .train-board td {
    padding: 0.35rem 0.5rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .train-spoken {
    font-style: italic;
    color: #334155;
    background: #f1f5f9;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    margin: 0;
    font-size: 0.95rem;
  }

  /* Weather */
  .weather-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .weather-conditions {
    text-transform: capitalize;
    font-weight: 600;
    margin: 0.25rem 0;
  }

  .weather-temps {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .temp-high {
    color: #dc2626;
    font-weight: 700;
  }

  .temp-low {
    color: #2563eb;
    font-weight: 700;
  }

  /* Job listing */
  .job-company {
    font-size: 0.85rem;
    font-weight: 700;
    text-transform: uppercase;
    color: #64748b;
    margin: 0 0 0.25rem 0;
  }

  .job-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.85rem;
    color: #64748b;
    margin-bottom: 0.5rem;
  }

  .job-contact {
    font-size: 0.85rem;
    color: #2563eb;
    margin: 0.5rem 0 0 0;
  }

  /* Event flyer */
  .event-meta {
    display: flex;
    gap: 0.75rem;
    font-size: 0.85rem;
    color: #64748b;
    margin-bottom: 0.5rem;
    flex-wrap: wrap;
  }

  .event-type {
    background: #e2e8f0;
    padding: 0.15rem 0.5rem;
    border-radius: 9999px;
    font-weight: 600;
    font-size: 0.8rem;
  }

  .event-location {
    font-weight: 600;
    margin: 0 0 0.25rem 0;
  }

  .event-price {
    font-weight: 700;
    color: #166534;
    margin: 0.25rem 0;
  }

  .event-extras {
    font-size: 0.85rem;
    color: #64748b;
    font-style: italic;
    margin: 0;
  }

  /* Diary */
  .diary-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .diary-date {
    font-weight: 600;
    color: #334155;
  }

  .diary-mood {
    font-style: italic;
    color: #64748b;
  }

  .diary-text {
    font-style: italic;
  }

  /* Dark mode for all media types */
  :global(html[data-theme='dark']) .immersion-passage {
    background: rgba(20, 83, 45, 0.15);
    border-color: #166534;
  }

  :global(html[data-theme='dark']) .immersion-passage .passage-label {
    color: #4ade80;
  }

  :global(html[data-theme='dark']) .media-content,
  :global(html[data-theme='dark']) .media-content h3,
  :global(html[data-theme='dark']) .media-body {
    color: #e2e8f0;
  }

  :global(html[data-theme='dark']) .media-content h4 {
    color: #cbd5e1;
    border-bottom-color: #3a4150;
  }

  :global(html[data-theme='dark']) .text-bubble {
    background: #3a4150;
  }

  :global(html[data-theme='dark']) .text-right .text-bubble {
    background: rgba(20, 83, 45, 0.4);
  }

  :global(html[data-theme='dark']) .train-board th {
    background: #1e293b;
  }

  :global(html[data-theme='dark']) .train-board td {
    border-bottom-color: #3a4150;
  }

  :global(html[data-theme='dark']) .train-spoken {
    background: #2a303c;
    color: #cbd5e1;
  }

  :global(html[data-theme='dark']) .event-type {
    background: #3a4150;
    color: #cbd5e1;
  }

  :global(html[data-theme='dark']) .social-hashtags {
    color: #60a5fa;
  }

  /* ── Quiz feedback ───────────────────────────────────────────────────── */
  .quiz-feedback {
    margin-top: 1.25rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--card-border, #e2e8f0);
    text-align: center;
  }

  .feedback-correct {
    color: #16a34a;
    font-weight: 700;
    font-size: 1.1rem;
    margin: 0 0 0.5rem 0;
  }

  .feedback-wrong {
    color: #dc2626;
    font-weight: 600;
    font-size: 1rem;
    margin: 0 0 0.5rem 0;
  }

  .feedback-explanation {
    color: #64748b;
    font-size: 0.9rem;
    margin: 0 0 1rem 0;
    font-style: italic;
  }

  :global(html[data-theme='dark']) .feedback-correct {
    color: #4ade80;
  }

  :global(html[data-theme='dark']) .feedback-wrong {
    color: #f87171;
  }

  :global(html[data-theme='dark']) .feedback-explanation {
    color: #94a3b8;
  }

  /* ── Quiz loading ────────────────────────────────────────────────────── */
  .quiz-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 3rem;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e2e8f0;
    border-top-color: #22c55e;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .quiz-loading p {
    color: #64748b;
    font-size: 1rem;
  }

  /* ── Chat styles (reused from original) ──────────────────────────────── */
  .chat-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .chat-messages {
    flex: 1;
    padding: 1.5rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    background-color: var(--bg-color, #f8fafc);
  }

  .message-wrapper {
    display: flex;
    flex-direction: column;
    max-width: 80%;
  }

  .message-wrapper.user {
    align-self: flex-end;
    align-items: flex-end;
  }

  .message-wrapper.assistant {
    align-self: flex-start;
    align-items: flex-start;
  }

  .message-sender {
    font-size: 0.75rem;
    color: #64748b;
    margin-bottom: 0.25rem;
    font-weight: 500;
  }

  .message-bubble {
    padding: 0.75rem 1rem;
    border-radius: 1rem;
    font-size: 1rem;
    line-height: 1.5;
    word-break: break-word;
    white-space: pre-wrap;
  }

  .message-bubble.user {
    background-color: #22c55e;
    color: #ffffff;
    border-bottom-right-radius: 0.25rem;
  }

  .message-bubble.assistant {
    background-color: var(--card-bg, #ffffff);
    color: var(--text-color, #1e293b);
    border: 1px solid var(--card-border, #e2e8f0);
    border-bottom-left-radius: 0.25rem;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .chat-input-form {
    display: flex;
    gap: 0.75rem;
    padding: 1rem;
    background-color: var(--card-bg, #ffffff);
    border-top: 1px solid var(--card-border, #e2e8f0);
  }

  .chat-input {
    flex: 1;
    padding: 0.75rem 1rem;
    border: 1px solid var(--input-border, #cbd5e1);
    border-radius: 0.5rem;
    font-size: 1rem;
    font-family: inherit;
    color: var(--input-text, #111827);
    background-color: var(--input-bg, #ffffff);
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }

  .chat-input:focus {
    outline: none;
    border-color: #22c55e;
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
  }

  .chat-input:disabled {
    background-color: #f1f5f9;
    color: #94a3b8;
    cursor: not-allowed;
  }

  .send-btn {
    display: flex;
    height: 52px;
    width: 52px;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border-radius: 0.75rem;
    background-color: #22c55e;
    color: white;
    box-shadow: 0 4px 0 #16a34a;
    transition:
      transform 0.1s,
      box-shadow 0.1s,
      background-color 0.2s;
    border: none;
    cursor: pointer;
  }

  .send-btn:hover:not(:disabled) {
    background-color: #4ade80;
  }

  .send-btn:active:not(:disabled) {
    transform: translateY(4px);
    box-shadow: 0 0 0 #16a34a;
  }

  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  .send-btn .icon {
    height: 1.5rem;
    width: 1.5rem;
  }

  /* ── Buttons ─────────────────────────────────────────────────────────── */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 600;
    border-radius: 0.5rem;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background-color: #22c55e;
    color: #ffffff;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: #16a34a;
  }

  .completion-buttons {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .btn-large {
    width: 100%;
    padding: 1rem 2rem;
    font-size: 1.15rem;
  }

  .btn-outlined {
    background-color: transparent;
    color: #16a34a;
    border: 2px solid #16a34a;
    padding: 0.6rem 1.5rem;
    font-size: 0.95rem;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-outlined:hover {
    background-color: #f0fdf4;
    color: #15803d;
    border-color: #15803d;
  }

  :global(html[data-theme='dark']) .btn-outlined {
    color: #4ade80;
    border-color: #4ade80;
  }

  :global(html[data-theme='dark']) .btn-outlined:hover {
    background-color: #0d1f14;
    color: #86efac;
    border-color: #86efac;
  }

  .btn-text-link {
    background: none;
    border: none;
    color: #64748b;
    font-size: 0.85rem;
    cursor: pointer;
    text-decoration: underline;
    padding: 0.25rem 0.5rem;
    font-weight: 400;
    transition: color 0.2s;
  }

  .btn-text-link:hover {
    color: #334155;
  }

  :global(html[data-theme='dark']) .btn-text-link {
    color: #94a3b8;
  }

  :global(html[data-theme='dark']) .btn-text-link:hover {
    color: #cbd5e1;
  }

  /* ── Completion card ─────────────────────────────────────────────────── */
  .completion-card {
    padding: 1.5rem;
    background-color: #f0fdf4;
    border-top: 1px solid #bbf7d0;
  }

  :global(html[data-theme='dark']) .completion-card {
    background-color: #0d1f14;
    border-top-color: #166534;
  }

  .completion-card.no-messages {
    display: flex;
    flex-direction: column;
    justify-content: center;
    border-top: none;
    border-radius: 16px;
    border: 1px solid #bbf7d0;
  }

  :global(html[data-theme='dark']) .completion-card.no-messages {
    border-color: #166534;
  }

  .completion-card h2 {
    margin: 0 0 1rem 0;
    color: #166534;
    font-size: 1.5rem;
  }

  .level-result {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
    font-size: 1.1rem;
    color: #15803d;
  }

  .level-badge {
    background-color: #bbf7d0;
    color: #166534;
    padding: 0.25rem 0.75rem;
    border-radius: 0.25rem;
    font-weight: 700;
  }

  .feedback-text {
    color: #166534;
    margin-bottom: 1.5rem;
    line-height: 1.5;
  }

  .completion-actions {
    border-top: 1px solid #bbf7d0;
    padding-top: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .action-note {
    color: #15803d;
    font-style: italic;
    font-size: 0.95rem;
    margin: 0;
  }

  :global(html[data-theme='dark']) .completion-card h2 {
    color: #4ade80;
  }

  :global(html[data-theme='dark']) .level-result {
    color: #86efac;
  }

  :global(html[data-theme='dark']) .level-badge {
    background-color: #166534;
    color: #bbf7d0;
  }

  :global(html[data-theme='dark']) .feedback-text {
    color: #86efac;
  }

  :global(html[data-theme='dark']) .completion-actions {
    border-top-color: #166534;
  }

  :global(html[data-theme='dark']) .action-note {
    color: #86efac;
  }

  /* ── Path Selection Styles ───────────────────────────────────────────── */
  .path-selection {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    max-width: 700px;
    margin: 0 auto;
  }

  .path-selection.horizontal {
    flex-direction: row;
    justify-content: center;
    gap: 1.25rem;
    flex-wrap: wrap;
    max-width: none;
  }

  .path-selection.horizontal .path-card {
    width: 200px;
    min-height: 180px;
    justify-content: center;
  }

  @media (max-width: 600px) {
    .path-selection.horizontal {
      gap: 0.75rem;
    }

    .path-selection.horizontal .path-card {
      width: calc(50% - 0.375rem);
      min-height: 150px;
    }
  }

  @media (max-width: 360px) {
    .path-selection.horizontal .path-card {
      width: 100%;
      min-height: 120px;
    }
  }

  .path-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 2rem 1.5rem;
    border-radius: 16px;
    border: 2px solid var(--card-border, #e2e8f0);
    background: var(--card-bg, #ffffff);
    cursor: pointer;
    transition: all 0.25s;
    text-align: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .path-card:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
  }

  .path-card:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .path-card h2 {
    margin: 0;
    font-size: 1.35rem;
    color: #0f172a;
  }

  .path-card p {
    margin: 0;
    color: #64748b;
    line-height: 1.5;
    font-size: 0.95rem;
  }

  .path-icon {
    font-size: 2.5rem;
  }

  .path-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.8rem;
    font-weight: 600;
  }

  .reset-badge {
    background-color: #fef3c7;
    color: #92400e;
  }

  .new-lang-badge {
    background-color: #dbeafe;
    color: #1e40af;
  }

  :global(html[data-theme='dark']) .reset-badge {
    background-color: #451a03;
    color: #fcd34d;
  }

  :global(html[data-theme='dark']) .new-lang-badge {
    background-color: #1e3a5f;
    color: #93c5fd;
  }

  .beginner-card {
    border-color: #e5e7eb;
    background: linear-gradient(135deg, #f8fafc 0%, var(--card-bg, #ffffff) 100%);
  }

  .beginner-card:hover:not(:disabled) {
    border-color: #94a3b8;
  }

  .beginner-card .path-badge {
    background-color: #dcfce7;
    color: #166534;
  }

  .test-card {
    border-color: #86efac;
    background: linear-gradient(135deg, #f0fdf4 0%, var(--card-bg, #ffffff) 100%);
  }

  .test-card:hover:not(:disabled) {
    border-color: #22c55e;
  }

  .test-card .path-badge {
    background-color: #dcfce7;
    color: #166534;
  }

  /* ── Dark mode path cards ────────────────────────────────────────────── */
  :global(html[data-theme='dark']) .page-header h1 {
    color: var(--text-color, #e2e8f0);
  }

  :global(html[data-theme='dark']) .page-header p {
    color: #94a3b8;
  }

  :global(html[data-theme='dark']) .message-sender {
    color: #94a3b8;
  }

  :global(html[data-theme='dark']) .chat-input:disabled {
    background-color: #2a303c;
    color: #64748b;
  }

  :global(html[data-theme='dark']) .path-card h2 {
    color: var(--text-color, #e2e8f0);
  }

  :global(html[data-theme='dark']) .path-card p {
    color: #94a3b8;
  }

  :global(html[data-theme='dark']) .beginner-card {
    border-color: #3a4150;
    background: linear-gradient(135deg, #2a303c 0%, var(--card-bg, #21252e) 100%);
  }

  :global(html[data-theme='dark']) .beginner-card:hover:not(:disabled) {
    border-color: #64748b;
  }

  :global(html[data-theme='dark']) .beginner-card .path-badge {
    background-color: rgba(20, 83, 45, 0.35);
    color: #4ade80;
  }

  :global(html[data-theme='dark']) .test-card {
    border-color: rgba(74, 222, 128, 0.3);
    background: linear-gradient(135deg, rgba(20, 83, 45, 0.2) 0%, var(--card-bg, #21252e) 100%);
  }

  :global(html[data-theme='dark']) .test-card:hover:not(:disabled) {
    border-color: #4ade80;
  }

  :global(html[data-theme='dark']) .test-card .path-badge {
    background-color: rgba(20, 83, 45, 0.35);
    color: #4ade80;
  }
</style>

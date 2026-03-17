<script lang="ts">
  import { onMount } from 'svelte';

  const translations = [
    { word: 'Learn', lang: 'English', flag: '🇺🇸' },
    { word: 'Lernen', lang: 'Deutsch', flag: '🇩🇪' },
    { word: 'Aprender', lang: 'Español', flag: '🇪🇸' },
    { word: 'Apprendre', lang: 'Français', flag: '🇫🇷' },
    { word: '学ぶ', lang: '日本語', flag: '🇯🇵' },
    { word: 'Учить', lang: 'Русский', flag: '🇷🇺' },
    { word: 'Impara', lang: 'Italiano', flag: '🇮🇹' },
    { word: '배우다', lang: '한국어', flag: '🇰🇷' }
  ];

  let currentIndex = $state(0);
  let isAnimating = $state(false);

  onMount(() => {
    const interval = setInterval(() => {
      isAnimating = true;
      setTimeout(() => {
        currentIndex = (currentIndex + 1) % translations.length;
        isAnimating = false;
      }, 400);
    }, 2500);

    return () => clearInterval(interval);
  });
</script>

<svelte:head>
  <title>LingoLearn - Master Languages with AI</title>
  <meta
    name="description"
    content="AI-powered language learning platform. Learn German, Spanish, French, and more."
  />
</svelte:head>

<section class="hero">
  <div class="animated-title">
    <h1>
      <span class="title-static">Ready to</span>
      <span class="title-word" class:slide-out={isAnimating}>
        <span class="word-flag">{translations[currentIndex].flag}</span>
        {translations[currentIndex].word}
      </span>
      <span class="title-static">?</span>
    </h1>
    <p class="lang-label" class:fade-out={isAnimating}>
      {translations[currentIndex].lang}
    </p>
  </div>
  <p class="subtitle">
    Your AI-powered platform to master new languages. Start with
    <strong>German</strong>, <strong>Spanish</strong>, or <strong>French</strong> — personalized lessons,
    instant feedback, and progress tracking.
  </p>
  <div class="actions">
    <a href="/signup" class="btn btn-primary">Start Learning</a>
    <a href="/login" class="btn btn-secondary">Login</a>
  </div>

  <div class="supported-languages">
    <span class="supported-label">Available now</span>
    <div class="lang-badges">
      <span class="lang-badge">🇩🇪 German</span>
      <span class="lang-badge">🇪🇸 Spanish</span>
      <span class="lang-badge">🇫🇷 French</span>
    </div>
  </div>
</section>

<section class="features">
  <div class="feature-card">
    <h3>🤖 AI-Powered Lessons</h3>
    <p>Dynamically generated lessons tailored to your skill level and learning pace.</p>
  </div>
  <div class="feature-card">
    <h3>🌍 Multiple Languages</h3>
    <p>
      Learn German, Spanish, and French with dedicated vocabulary, grammar, and exercises for each.
    </p>
  </div>
  <div class="feature-card">
    <h3>⚡ Instant Feedback</h3>
    <p>Get real-time corrections and explanations from our intelligent grader.</p>
  </div>
  <div class="feature-card">
    <h3>📈 Track Progress</h3>
    <p>Monitor your vocabulary and grammar improvements over time across all languages.</p>
  </div>
</section>

<section class="how-it-works">
  <h2 class="section-title">How LingoLearn Works</h2>
  <div class="steps-container">
    <div class="step-item">
      <div class="step-number">1</div>
      <div class="step-content">
        <h4>Choose Your Language</h4>
        <p>
          Select German, Spanish, or French to start your journey. We'll assess your current level
          to personalize your path.
        </p>
      </div>
    </div>
    <div class="step-item">
      <div class="step-number">2</div>
      <div class="step-content">
        <h4>Practice Daily</h4>
        <p>
          Engage in short, bite-sized lessons that fit your schedule, covering grammar, vocabulary,
          and reading.
        </p>
      </div>
    </div>
    <div class="step-item">
      <div class="step-number">3</div>
      <div class="step-content">
        <h4>AI-Powered Feedback</h4>
        <p>
          Our advanced AI grades your answers instantly and provides detailed explanations to help
          you improve faster.
        </p>
      </div>
    </div>
    <div class="step-item">
      <div class="step-number">4</div>
      <div class="step-content">
        <h4>Achieve Fluency</h4>
        <p>
          Watch your skills grow as you unlock new achievements and tackle more complex
          conversations.
        </p>
      </div>
    </div>
  </div>
</section>

<section class="cta-section">
  <div class="cta-content">
    <h2>Ready to start your language journey?</h2>
    <p>Join LingoLearn today and master your next language with AI-guided lessons.</p>
    <a href="/signup" class="btn btn-primary cta-btn">Create Free Account</a>
  </div>
</section>

<style>
  .hero {
    text-align: center;
    padding: 4rem 1rem 2rem;
    max-width: 800px;
    margin: 0 auto;
  }

  .animated-title {
    margin-bottom: 1.5rem;
    min-height: 120px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  h1 {
    font-size: 3.25rem;
    font-weight: 800;
    color: #111827;
    margin-bottom: 0.25rem;
    line-height: 1.2;
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 0.3em;
    flex-wrap: wrap;
  }

  .title-word {
    display: inline-flex;
    align-items: baseline;
    gap: 0.15em;
    color: #2563eb;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    transform: translateY(0);
    opacity: 1;
  }

  .title-word.slide-out {
    transform: translateY(-20px);
    opacity: 0;
  }

  .word-flag {
    font-size: 0.75em;
  }

  .lang-label {
    font-size: 0.9rem;
    color: #6b7280;
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    transition: opacity 0.3s ease;
    height: 1.4em;
  }

  .lang-label.fade-out {
    opacity: 0;
  }

  .subtitle {
    font-size: 1.2rem;
    color: #4b5563;
    line-height: 1.7;
    margin-bottom: 2rem;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
  }

  :global(html[data-theme='dark']) .subtitle {
    color: #94a3b8;
  }

  .subtitle strong {
    color: #2563eb;
    font-weight: 700;
  }

  .actions {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-bottom: 2.5rem;
  }

  .btn {
    display: inline-block;
    padding: 0.85rem 2rem;
    font-size: 1.05rem;
    font-weight: 600;
    border-radius: 0.6rem;
    text-decoration: none;
    transition: all 0.2s;
  }

  .btn:active {
    transform: scale(0.95);
  }

  .btn-primary {
    background-color: #22c55e;
    color: #ffffff;
    border: 1px solid transparent;
    box-shadow: 0 4px 14px 0 rgba(34, 197, 94, 0.35);
  }

  .btn-primary:hover {
    background-color: #16a34a;
    border-color: transparent;
    box-shadow: 0 6px 20px 0 rgba(22, 163, 74, 0.45);
    transform: scale(1.05) translateY(-2px);
  }

  .btn-secondary {
    background-color: var(--card-bg, #ffffff);
    color: var(--text-color, #374151);
    border: 1px solid var(--card-border, #d1d5db);
  }

  .btn-secondary:hover {
    background-color: #f3f4f6;
    border-color: #9ca3af;
    transform: scale(1.05) translateY(-2px);
  }

  .supported-languages {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .supported-label {
    font-size: 0.8rem;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 600;
  }

  .lang-badges {
    display: flex;
    gap: 0.75rem;
  }

  .lang-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.4rem 1rem;
    background: #eff6ff;
    color: #1e40af;
    border-radius: 2rem;
    font-size: 0.9rem;
    font-weight: 600;
    border: 1px solid #bfdbfe;
  }

  :global(html[data-theme='dark']) .lang-badge {
    background: #1e3a5f;
    color: #93c5fd;
    border-color: #1e40af;
  }

  .features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1.5rem;
    padding: 2rem 1rem;
    margin-top: 1rem;
    max-width: 960px;
    margin-left: auto;
    margin-right: auto;
  }

  .feature-card {
    background: var(--card-bg, #ffffff);
    border: 1px solid var(--card-border, #e5e7eb);
    padding: 2rem;
    border-radius: 0.75rem;
    box-shadow:
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06);
    text-align: center;
    transition:
      transform 0.2s,
      box-shadow 0.2s;
  }

  .feature-card:hover {
    transform: translateY(-4px);
    box-shadow:
      0 12px 24px -4px rgba(0, 0, 0, 0.12),
      0 4px 8px -2px rgba(0, 0, 0, 0.06);
  }

  .feature-card h3 {
    font-size: 1.2rem;
    color: var(--text-color, #111827);
    margin-bottom: 0.75rem;
  }

  .feature-card p {
    color: #6b7280;
    line-height: 1.5;
    font-size: 0.95rem;
  }

  :global(html[data-theme='dark']) .feature-card p {
    color: #94a3b8;
  }

  .how-it-works {
    padding: 4rem 1rem;
    max-width: 800px;
    margin: 2rem auto;
    text-align: center;
  }

  .section-title {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-color, #111827);
    margin-bottom: 2.5rem;
  }

  .steps-container {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .step-item {
    display: flex;
    align-items: flex-start;
    gap: 1.5rem;
    text-align: left;
    background: var(--card-bg, #ffffff);
    border: 1px solid var(--card-border, #e5e7eb);
    padding: 1.5rem;
    border-radius: 0.75rem;
    box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.05);
  }

  :global(html[data-theme='dark']) .step-item {
    background: var(--card-bg, #1e293b);
    border-color: var(--card-border, #334155);
  }

  .step-number {
    background: #2563eb;
    color: white;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .step-content h4 {
    font-size: 1.25rem;
    color: var(--text-color, #111827);
    margin-bottom: 0.5rem;
    margin-top: 0;
  }

  .step-content p {
    color: #4b5563;
    line-height: 1.6;
    margin: 0;
  }

  :global(html[data-theme='dark']) .step-content p {
    color: #94a3b8;
  }

  .cta-section {
    background-color: var(--card-bg, #f3f4f6);
    border-top: 2px solid var(--card-border, #e5e7eb);
    padding: 5rem 1rem;
    text-align: center;
    margin-top: 4rem;
  }

  .cta-content {
    max-width: 600px;
    margin: 0 auto;
  }

  .cta-content h2 {
    font-size: 2.25rem;
    font-weight: 800;
    color: var(--text-color, #111827);
    margin-bottom: 1rem;
  }

  .cta-content p {
    font-size: 1.15rem;
    color: #4b5563;
    margin-bottom: 2rem;
  }

  :global(html[data-theme='dark']) .cta-content p {
    color: #94a3b8;
  }

  .cta-btn {
    font-size: 1.15rem;
    padding: 1rem 2.5rem;
  }

  @media (max-width: 640px) {
    h1 {
      font-size: 2.25rem;
    }

    .animated-title {
      min-height: 100px;
    }
  }
</style>

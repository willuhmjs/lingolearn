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
  <title>LingoLearn — Master Languages with AI</title>
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
    <a href="/signup" class="btn-duo btn-primary">Start Learning</a>
    <a href="/login" class="btn-duo btn-secondary">Log in</a>
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
    <a href="/signup" class="btn-duo btn-primary cta-btn">Create Free Account</a>
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
    color: var(--text-color);
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
    color: var(--brand-color-alt);
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
    color: var(--text-muted);
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
    color: var(--text-muted);
    line-height: 1.7;
    margin-bottom: 2rem;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
  }

  .subtitle strong {
    color: var(--brand-color);
    font-weight: 700;
  }

  .actions {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-bottom: 2.5rem;
    flex-wrap: wrap;
  }

  .supported-languages {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .supported-label {
    font-size: 0.8rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 600;
  }

  .lang-badges {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .lang-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.4rem 1rem;
    background: color-mix(in srgb, var(--brand-color) 10%, transparent);
    color: var(--brand-color);
    border-radius: var(--radius-full);
    font-size: 0.9rem;
    font-weight: 600;
    border: 1px solid color-mix(in srgb, var(--brand-color) 25%, transparent);
  }

  .features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
    padding: 2rem 1rem;
    margin-top: 1rem;
    max-width: 960px;
    margin-left: auto;
    margin-right: auto;
  }

  .feature-card {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    padding: 2rem;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    text-align: center;
    transition:
      transform 0.2s,
      box-shadow 0.2s;
  }

  .feature-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
  }

  .feature-card h3 {
    font-size: 1.2rem;
    color: var(--text-color);
    margin-bottom: 0.75rem;
  }

  .feature-card p {
    color: var(--text-muted);
    line-height: 1.5;
    font-size: 0.95rem;
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
    color: var(--text-color);
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
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    padding: 1.5rem;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
  }

  .step-number {
    background: var(--brand-color);
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
    color: var(--text-color);
    margin-bottom: 0.5rem;
    margin-top: 0;
  }

  .step-content p {
    color: var(--text-muted);
    line-height: 1.6;
    margin: 0;
  }

  .cta-section {
    background-color: var(--card-bg);
    border-top: 2px solid var(--card-border);
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
    color: var(--text-color);
    margin-bottom: 1rem;
  }

  .cta-content p {
    font-size: 1.15rem;
    color: var(--text-muted);
    margin-bottom: 2rem;
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

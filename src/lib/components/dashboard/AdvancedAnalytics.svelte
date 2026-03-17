<script lang="ts">
  interface BanditArm {
    interleaveCount: number;
    mean: number;
    observations: number;
  }

  interface HighVarianceVocab {
    lemma: string;
    level: string;
    elo: number;
    sigma: number;
  }

  interface PfaAtRisk {
    title: string;
    level: string;
    pCorrect: number | null;
  }

  interface CoOccurrencePair {
    from: string;
    to: string;
    strength: string;
  }

  interface Props {
    sessionEma: number;
    adaptiveCap: number;
    banditArmMeans: BanditArm[] | null;
    bestBanditArm: BanditArm;
    highVarianceVocab: HighVarianceVocab[];
    pfaAtRisk: PfaAtRisk[];
    coOccurrencePairs: CoOccurrencePair[];
    hasPersonalizedWeights: boolean;
    fsrsRetention: number;
  }

  // eslint-disable-next-line svelte/no-unused-props
  let {
    sessionEma,
    adaptiveCap,
    banditArmMeans,
    bestBanditArm,
    highVarianceVocab,
    pfaAtRisk,
    coOccurrencePairs,
    hasPersonalizedWeights,
    fsrsRetention
  }: Props = $props();

  let isOpen = $state(false);

  const errorLabels: Record<string, string> = {
    wrong_case: 'Wrong Case',
    wrong_tense: 'Wrong Tense',
    wrong_gender: 'Wrong Gender',
    spelling: 'Spelling',
    word_order: 'Word Order',
    vocabulary_gap: 'Vocab Gap'
  };
</script>

<section class="algo-section">
  <button class="algo-toggle" onclick={() => (isOpen = !isOpen)} aria-expanded={isOpen}>
    <h2>
      <svg
        class="algo-toggle-icon"
        class:algo-toggle-open={isOpen}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        width="18"
        height="18"
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 18l6-6-6-6" />
      </svg>
      Advanced Analytics
    </h2>
  </button>

  {#if isOpen}
    <p class="algo-intro">
      Live signals from the scheduling algorithms personalised to your session history.
    </p>
    <div class="algo-grid">
      <!-- Adaptive pace card -->
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
          <span class="algo-stat-value">{sessionEma}%</span>
        </div>
        <div class="algo-ema-bar">
          <div class="algo-ema-fill" style="width:{sessionEma}%"></div>
        </div>
        <div class="algo-stat-row" style="margin-top:0.5rem">
          <span class="algo-stat-label">Today's new-word cap</span>
          <span class="algo-stat-value algo-cap">{adaptiveCap} words</span>
        </div>
        <p class="algo-footnote">Range 5-20. Higher accuracy → more new words introduced.</p>
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
            aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M8 12h8M12 8v8" /></svg
          >
          Review Mix (Bandit)
        </h3>
        <p class="algo-card-desc">
          A Thompson-sampling bandit learns how many mastered items to interleave per lesson for
          best retention.
        </p>
        {#if banditArmMeans}
          <div class="bandit-arms">
            {#each banditArmMeans as arm}
              <div
                class="bandit-arm-row"
                class:bandit-best={arm.interleaveCount === bestBanditArm.interleaveCount}
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
            Best arm: {bestBanditArm.interleaveCount} interleaved items ({bestBanditArm.mean}%
            success rate)
          </p>
        {/if}
      </div>

      <!-- ELO confidence card -->
      {#if highVarianceVocab.length > 0}
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
            Words where the algorithm is least certain of your true proficiency — expect them to
            appear more often.
          </p>
          <ul class="variance-list">
            {#each highVarianceVocab as v}
              <li class="variance-row">
                <span class="variance-lemma">{v.lemma}</span>
                <span class="variance-level">{v.level}</span>
                <span class="variance-elo">{v.elo}</span>
                <span class="variance-sigma" title="ELO uncertainty (+/-sigma)">+/-{v.sigma}</span>
              </li>
            {/each}
          </ul>
          <p class="algo-footnote">sigma shrinks with each review. New items start at sigma~20.</p>
        </div>
      {/if}

      <!-- PFA at-risk grammar card -->
      {#if pfaAtRisk.length > 0}
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
            Rules the Performance Factor model predicts you're likely to get wrong — they'll be
            prioritised in lessons.
          </p>
          <ul class="pfa-list">
            {#each pfaAtRisk as g}
              <li class="pfa-row">
                <span class="pfa-title">{g.title}</span>
                <span class="pfa-level">{g.level}</span>
                <span class="pfa-p" style="color:{(g.pCorrect ?? 0) < 0.4 ? '#ef4444' : '#f97316'}"
                  >{Math.round((g.pCorrect ?? 0) * 100)}%</span
                >
              </li>
            {/each}
          </ul>
          <p class="algo-footnote">P(correct) from PFA model — below 60% means at-risk.</p>
        </div>
      {/if}

      <!-- Error co-occurrence card -->
      {#if coOccurrencePairs.length > 0}
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
            Error types that tend to appear together across learners — fixing one often helps the
            other.
          </p>
          <ul class="coerr-list">
            {#each coOccurrencePairs as pair}
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
            style="color:{hasPersonalizedWeights ? '#10b981' : '#94a3b8'}"
            >{hasPersonalizedWeights ? 'Active' : 'Building (need 50 reviews)'}</span
          >
        </div>
        <div class="algo-stat-row">
          <span class="algo-stat-label">Target retention</span>
          <span class="algo-stat-value">{fsrsRetention}%</span>
        </div>
        <div class="algo-stat-row">
          <span class="algo-stat-label">Algorithm version</span>
          <span class="algo-stat-value">FSRS-5</span>
        </div>
      </div>
    </div>
  {/if}
</section>

<style>
  .algo-section {
    margin: 2rem 0;
    padding: 0 1rem;
  }

  .algo-toggle {
    display: flex;
    align-items: center;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    margin: 0;
    text-align: left;
    width: 100%;
  }

  .algo-toggle h2 {
    font-size: 1.75rem;
    color: var(--text-color, #0f172a);
    margin-bottom: 0.5rem;
    font-weight: 800;
    letter-spacing: -0.025em;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .algo-toggle-icon {
    transition: transform 0.2s ease;
    flex-shrink: 0;
  }

  .algo-toggle-icon.algo-toggle-open {
    transform: rotate(90deg);
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
</style>

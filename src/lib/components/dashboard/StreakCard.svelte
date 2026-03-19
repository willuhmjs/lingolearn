<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { toastSuccess, toastError } from '$lib/utils/toast';

  interface Props {
    currentStreak: number;
    longestStreak: number;
    streakFreezes: number;
    totalXp: number;
  }

  let { currentStreak, longestStreak, streakFreezes, totalXp }: Props = $props();

  const FREEZE_COST = 500;
  const MAX_FREEZES = 5;

  let isBuying = $state(false);
  let localFreezes = $state(streakFreezes);
  let localXp = $state(totalXp);

  $effect(() => {
    localFreezes = streakFreezes;
    localXp = totalXp;
  });

  async function buyFreeze() {
    if (isBuying || localFreezes >= MAX_FREEZES || localXp < FREEZE_COST) return;
    isBuying = true;
    try {
      const res = await fetch('/api/user/streak-freeze', { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        localFreezes = json.streakFreezes;
        localXp = json.totalXp;
        toastSuccess('Streak freeze purchased!');
        invalidateAll();
      } else {
        toastError(json.error || 'Failed to buy streak freeze');
      }
    } catch {
      toastError('An error occurred');
    } finally {
      isBuying = false;
    }
  }

  let canBuy = $derived(!isBuying && localFreezes < MAX_FREEZES && localXp >= FREEZE_COST);
</script>

<div class="streak-card">
  <!-- Flame + streak count -->
  <div class="streak-hero">
    <div class="flame-wrap" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="currentColor" class="flame-icon">
        <path
          d="M12 2C9.5 5 7 7.5 7 11a5 5 0 0 0 10 0c0-1.5-.5-3-1.5-4.5C14.5 8 14 9 13 10c0-2.5-1-5-1-8z"
        />
      </svg>
    </div>
    <div class="streak-numbers">
      <span class="streak-count">{currentStreak}</span>
      <span class="streak-unit">day streak</span>
    </div>
  </div>

  <!-- Longest streak -->
  {#if longestStreak > 0}
    <p class="streak-best">Best: {longestStreak} days</p>
  {/if}

  <div class="divider" aria-hidden="true"></div>

  <!-- Freeze shields -->
  <div class="freeze-section">
    <div class="freeze-label-row">
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        width="14"
        height="14"
        aria-hidden="true"
        class="shield-icon-small"
      >
        <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7L12 2z" />
      </svg>
      <span class="freeze-label">Streak Freezes</span>
      <span class="freeze-count-badge">{localFreezes}/{MAX_FREEZES}</span>
    </div>

    <div class="freeze-shields" aria-label="{localFreezes} of {MAX_FREEZES} freezes active">
      {#each Array(MAX_FREEZES) as _, i}
        <span
          class="freeze-shield"
          class:active={i < localFreezes}
          aria-label={i < localFreezes ? 'Active freeze' : 'Empty slot'}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7L12 2z" />
          </svg>
        </span>
      {/each}
    </div>

    <div class="freeze-buy-row">
      <span class="xp-cost">
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          width="12"
          height="12"
          aria-hidden="true"
          class="xp-bolt"
        >
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
        {FREEZE_COST} XP
      </span>
      <button
        type="button"
        class="btn-buy"
        onclick={buyFreeze}
        disabled={!canBuy}
        title={localFreezes >= MAX_FREEZES
          ? 'Maximum freezes reached'
          : localXp < FREEZE_COST
            ? `Need ${FREEZE_COST} XP (you have ${localXp})`
            : 'Buy a streak freeze'}
      >
        {isBuying ? 'Buying…' : localFreezes >= MAX_FREEZES ? 'Full' : 'Buy Freeze'}
      </button>
    </div>
    <p class="xp-balance">You have {localXp.toLocaleString()} XP</p>
  </div>
</div>

<style>
  .streak-card {
    background: var(--card-bg, #ffffff);
    border: 2px solid var(--card-border, #e5e7eb);
    border-radius: var(--radius-xl, 1rem);
    padding: 1.5rem;
    box-shadow: var(--shadow-duo);
    display: flex;
    flex-direction: column;
    gap: 0;
    position: relative;
    overflow: hidden;
  }

  /* Top accent bar — orange/amber for fire */
  .streak-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 4px;
    background: linear-gradient(90deg, #f97316, #fbbf24);
  }

  /* Hero area */
  .streak-hero {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 0.25rem;
    margin-bottom: 0.5rem;
  }

  .flame-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 3rem;
    background: linear-gradient(135deg, #fff7ed, #ffedd5);
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(249, 115, 22, 0.25);
  }

  :global(html[data-theme='dark']) .flame-wrap {
    background: linear-gradient(135deg, #431407, #7c2d12);
    box-shadow: 0 2px 8px rgba(249, 115, 22, 0.4);
  }

  .flame-icon {
    width: 1.75rem;
    height: 1.75rem;
    color: #f97316;
  }

  .streak-numbers {
    display: flex;
    flex-direction: column;
    line-height: 1.1;
  }

  .streak-count {
    font-size: 2.5rem;
    font-weight: 900;
    color: #f97316;
    letter-spacing: -0.04em;
    line-height: 1;
  }

  .streak-unit {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-top: 0.1rem;
  }

  .streak-best {
    font-size: 0.72rem;
    color: var(--text-muted);
    margin: 0 0 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    background: var(--link-hover-bg);
    padding: 0.2rem 0.6rem;
    border-radius: var(--radius-full);
  }

  .divider {
    height: 1px;
    background: var(--card-border, #e5e7eb);
    margin-bottom: 1rem;
  }

  /* Freeze section */
  .freeze-section {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .freeze-label-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .shield-icon-small {
    color: #3b82f6;
    flex-shrink: 0;
  }

  .freeze-label {
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--text-color, #374151);
    flex: 1;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .freeze-count-badge {
    font-size: 0.75rem;
    font-weight: 800;
    color: #64748b;
    background: var(--link-hover-bg, #f3f4f6);
    padding: 0.1rem 0.45rem;
    border-radius: var(--radius-full, 9999px);
  }

  :global(html[data-theme='dark']) .freeze-count-badge {
    background: #2d3340;
    color: #94a3b8;
  }

  .freeze-shields {
    display: flex;
    gap: 0.35rem;
  }

  .freeze-shield {
    width: 1.75rem;
    height: 1.75rem;
    color: #cbd5e1;
    transition:
      color 0.2s,
      transform 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .freeze-shield svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .freeze-shield.active {
    color: #3b82f6;
    transform: scale(1.1);
    filter: drop-shadow(0 1px 3px rgba(59, 130, 246, 0.4));
  }

  :global(html[data-theme='dark']) .freeze-shield {
    color: #374151;
  }

  :global(html[data-theme='dark']) .freeze-shield.active {
    color: #60a5fa;
    filter: drop-shadow(0 1px 3px rgba(96, 165, 250, 0.5));
  }

  .freeze-buy-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.15rem;
  }

  .xp-cost {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.82rem;
    font-weight: 800;
    color: var(--color-warning, #f59e0b);
  }

  .xp-bolt {
    color: var(--color-warning, #f59e0b);
  }

  .btn-buy {
    background: var(--color-primary, #3b82f6);
    color: #ffffff;
    border: none;
    border-radius: var(--radius-lg, 0.75rem);
    padding: 0.4rem 1rem;
    font-size: 0.8rem;
    font-weight: 800;
    font-family: inherit;
    cursor: pointer;
    box-shadow: 0 3px 0 var(--color-primary-hover, #2563eb);
    transition:
      background-color 0.15s,
      transform 0.1s,
      box-shadow 0.1s;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .btn-buy:hover:not(:disabled) {
    background: var(--color-primary-hover, #2563eb);
    transform: translateY(-1px);
    box-shadow: 0 4px 0 #1d4ed8;
  }

  .btn-buy:active:not(:disabled) {
    transform: translateY(1px);
    box-shadow: 0 1px 0 var(--color-primary-hover, #2563eb);
  }

  .btn-buy:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    box-shadow: none;
  }

  .xp-balance {
    font-size: 0.72rem;
    color: var(--text-muted);
    margin: 0;
    font-weight: 500;
  }
</style>

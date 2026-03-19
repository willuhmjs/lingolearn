<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { toastSuccess, toastError } from '$lib/utils/toast';
  import Button from '../Button.svelte';

  interface Props {
    currentStreak: number;
    longestStreak: number;
    streakFreezes: number;
    totalXp: number;
    studiedToday?: boolean;
  }

  let {
    currentStreak,
    longestStreak,
    streakFreezes,
    totalXp,
    studiedToday = false
  }: Props = $props();

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

<!-- Hidden SVG sprite: define reusable symbols here -->
<svg aria-hidden="true" style="display:none">
  <symbol
    id="icon-freeze"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  >
    <line x1="12" y1="2" x2="12" y2="22" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
    <polyline points="9,3 12,6 15,3" />
    <polyline points="3,9 6,12 3,15" />
    <polyline points="15,21 12,18 9,21" />
    <polyline points="21,15 18,12 21,9" />
  </symbol>
</svg>

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

  <!-- Studied-today status pill -->
  {#if studiedToday}
    <p class="streak-status streak-status--done" aria-live="polite">&#10003; Done for today</p>
  {:else if currentStreak > 0}
    <p class="streak-status streak-status--warn" aria-live="polite">Keep your streak alive!</p>
  {:else}
    <p class="streak-status streak-status--muted" aria-live="polite">Start your streak!</p>
  {/if}

  <!-- Longest streak -->
  {#if longestStreak > 0}
    <p class="streak-best" title="Personal best: {longestStreak} days">
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="best-icon">
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
      </svg>
      {longestStreak}
    </p>
  {/if}

  <div class="divider" aria-hidden="true"></div>

  <!-- Freeze shields -->
  <div class="freeze-section">
    <div class="freeze-label-row">
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" class="freeze-icon-small">
        <use href="#icon-freeze" />
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
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <use href="#icon-freeze" />
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
      <Button
        variant="primary"
        onclick={buyFreeze}
        disabled={!canBuy}
        loading={isBuying}
        title={localFreezes >= MAX_FREEZES
          ? 'Maximum freezes reached'
          : localXp < FREEZE_COST
            ? `Need ${FREEZE_COST} XP (you have ${localXp})`
            : 'Buy a streak freeze'}
      >
        {localFreezes >= MAX_FREEZES ? 'Full' : 'Buy Freeze'}
      </Button>
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

  /* Studied-today status pill */
  .streak-status {
    display: inline-block;
    margin: 0 0 0.5rem;
    padding: 0.2rem 0.65rem;
    border-radius: var(--radius-full, 9999px);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    line-height: 1.4;
    align-self: flex-start;
  }

  .streak-status--done {
    background: #dcfce7;
    color: #15803d;
  }

  :global(html[data-theme='dark']) .streak-status--done {
    background: #14532d;
    color: #4ade80;
  }

  .streak-status--warn {
    background: #fff7ed;
    color: #c2410c;
  }

  :global(html[data-theme='dark']) .streak-status--warn {
    background: #431407;
    color: #fb923c;
  }

  .streak-status--muted {
    background: var(--link-hover-bg, #f3f4f6);
    color: var(--text-muted, #6b7280);
  }

  :global(html[data-theme='dark']) .streak-status--muted {
    background: #1e2433;
    color: #94a3b8;
  }

  .streak-best {
    font-size: 0.8rem;
    color: var(--color-warning);
    margin: 0 0 0.75rem;
    font-weight: 800;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: var(--link-hover-bg);
    padding: 0.2rem 0.6rem;
    border-radius: var(--radius-full);
  }

  .best-icon {
    width: 0.85rem;
    height: 0.85rem;
    flex-shrink: 0;
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
    gap: 1rem;
  }

  .freeze-label-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .freeze-icon-small {
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

  .xp-balance {
    font-size: 0.72rem;
    color: var(--text-muted);
    margin: 0;
    font-weight: 500;
  }
</style>

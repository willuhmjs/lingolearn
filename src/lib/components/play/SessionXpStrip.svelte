<script lang="ts">
  import { fly } from 'svelte/transition';
  import { spring } from 'svelte/motion';
  import { untrack } from 'svelte';

  let {
    sessionXp,
    sessionChallenges
  }: {
    sessionXp: number;
    sessionChallenges: number;
  } = $props();

  const xpDisplay = spring(
    untrack(() => sessionXp),
    {
      stiffness: 0.1,
      damping: 0.25
    }
  );

  $effect(() => {
    xpDisplay.set(sessionXp);
  });
</script>

{#if sessionChallenges > 0}
  <div class="session-xp-strip" in:fly={{ y: -10, duration: 300 }}>
    <span class="session-xp-stat">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        style="width:0.875rem;height:0.875rem;"
        ><polygon
          points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
        /></svg
      >
      +{Math.round($xpDisplay)} XP
    </span>
    <span class="session-xp-divider"></span>
    <span class="session-xp-stat">
      {sessionChallenges}
      {sessionChallenges === 1 ? 'challenge' : 'challenges'} this session
    </span>
  </div>
{/if}

<style>
  .session-xp-strip {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
    border: 1px solid #bbf7d0;
    border-radius: 0.75rem;
    margin-bottom: 0.75rem;
  }

  :global(html[data-theme='dark']) .session-xp-strip {
    background: linear-gradient(135deg, rgba(20, 83, 45, 0.2) 0%, rgba(21, 128, 61, 0.2) 100%);
    border-color: rgba(74, 222, 128, 0.25);
  }

  .session-xp-stat {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.8125rem;
    font-weight: 700;
    color: #15803d;
  }

  :global(html[data-theme='dark']) .session-xp-stat {
    color: #4ade80;
  }

  .session-xp-divider {
    width: 1px;
    height: 1rem;
    background-color: #86efac;
    flex-shrink: 0;
  }

  :global(html[data-theme='dark']) .session-xp-divider {
    background-color: rgba(74, 222, 128, 0.3);
  }
</style>

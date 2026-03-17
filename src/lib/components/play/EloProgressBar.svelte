<script lang="ts">
  import { untrack } from 'svelte';
  import { spring } from 'svelte/motion';
  import { getEloLevelClass } from '$lib/utils/playTypes';

  let { eloValue }: { eloValue: number } = $props();

  const calculateEloProgress = (elo: number) => {
    // Basic ELO progress calculation for visualization
    const min = 800;
    const max = 2500;
    return Math.max(0, Math.min(100, ((elo - min) / (max - min)) * 100));
  };

  const progress = spring(
    untrack(() => calculateEloProgress(eloValue)),
    {
      stiffness: 0.1,
      damping: 0.25
    }
  );

  $effect(() => {
    progress.set(calculateEloProgress(eloValue));
  });
</script>

<div class="progress-bar-">
  <div class="progress-bar-fill {getEloLevelClass(eloValue)}" style="width: {$progress}%"></div>
</div>

<style>
  .progress-bar- {
    height: 0.5rem;
    background-color: #e2e8f0;
    border-radius: 9999px;
    overflow: hidden;
    width: 100%;
  }

  :global(html[data-theme='dark']) .progress-bar- {
    background-color: #334155;
  }

  .progress-bar-fill {
    height: 100%;
    border-radius: 9999px;
    background-image: linear-gradient(
      45deg,
      rgba(255, 255, 255, 0.15) 25%,
      transparent 25%,
      transparent 50%,
      rgba(255, 255, 255, 0.15) 50%,
      rgba(255, 255, 255, 0.15) 75%,
      transparent 75%,
      transparent
    );
    background-size: 1rem 1rem;
    animation: progress-stripes 1s linear infinite;
  }

  @keyframes progress-stripes {
    from {
      background-position: 1rem 0;
    }
    to {
      background-position: 0 0;
    }
  }

  .progress-bar-fill.learning {
    background-color: #facc15;
  }

  .progress-bar-fill.known {
    background-color: #34d399;
  }

  .progress-bar-fill.mastered {
    background-color: #10b981;
  }
</style>

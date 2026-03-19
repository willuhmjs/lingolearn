<script lang="ts">
  import { fade } from 'svelte/transition';

  let {
    loadProgressPct,
    isLocalMode,
    loadingTips,
    loadTipIndex
  }: {
    loadProgressPct: number;
    isLocalMode: boolean;
    loadingTips: string[];
    loadTipIndex: number;
  } = $props();
</script>

<div class="card card-duo loading-state" in:fade={{ duration: 300 }}>
  <div class="spinner"></div>
  <div class="load-progress-track">
    <div
      class="load-progress-fill {isLocalMode ? 'local-mode-fill' : ''}"
      style="width: {loadProgressPct}%"
    ></div>
  </div>
  <div class="load-tip-container">
    {#key loadTipIndex}
      <p class="load-tip" in:fade={{ duration: 350, delay: 50 }} out:fade={{ duration: 300 }}>
        {loadingTips[loadTipIndex]}
      </p>
    {/key}
  </div>
</div>

<style>
  .loading-state {
    text-align: center;
    padding: 4rem 2rem;
  }

  .spinner {
    display: inline-block;
    width: 2rem;
    height: 2rem;
    border: 4px solid var(--card-border, #e2e8f0);
    border-top-color: var(--color-primary, #7c3aed);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .load-progress-track {
    width: 80%;
    max-width: 320px;
    height: 5px;
    background: var(--card-border, #e2e8f0);
    border-radius: 999px;
    margin: 1.25rem auto 0;
    overflow: hidden;
  }

  .load-progress-fill {
    height: 100%;
    background: linear-gradient(to right, var(--color-primary), var(--color-primary-hover));
    border-radius: 999px;
    transition: width 0.12s linear;
    position: relative;
    overflow: hidden;
  }

  .load-progress-fill::after {
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

  .load-progress-fill.local-mode-fill {
    background: linear-gradient(to right, var(--color-warning), var(--color-warning-hover));
  }

  .load-tip-container {
    min-height: 3.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    margin-top: 1rem;
    width: 100%;
  }

  .load-tip {
    color: var(--text-muted, #64748b);
    font-size: 0.85rem;
    margin: 0;
    max-width: 380px;
    text-align: center;
    line-height: 1.5;
    position: absolute;
    padding: 0 1rem;
  }
</style>

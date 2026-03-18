<script lang="ts">
  import { fly } from 'svelte/transition';
</script>

<div class="card-duo finished-card" in:fly={{ y: 20, duration: 400, delay: 100 }}>
  <div class="success-icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  </div>
  <h2>All caught up!</h2>
  <p>No reviews due right now. Great job keeping your streak alive!</p>
  <p class="empty-cta-desc">Want to keep practicing? Head over to Play to learn new words.</p>
  <div class="empty-cta-row">
    <a href="/play" class="btn-duo btn-primary">Go to Play</a>
    <a href="/dashboard" class="btn-duo btn-secondary">Dashboard</a>
  </div>
</div>

<style>
  .finished-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
    background-color: var(--card-bg, #ffffff);
    border-color: var(--card-border, #e2e8f0);
    box-shadow: 0 4px 0 var(--card-border, #e2e8f0);
  }

  :global(html[data-theme='dark']) .finished-card {
    box-shadow: 0 4px 0 var(--card-border, #374151);
  }

  .success-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 7rem;
    height: 7rem;
    background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
    color: #16a34a;
    border-radius: 50%;
    margin-bottom: 2rem;
    box-shadow: 0 4px 0 #16a34a33;
    animation:
      bounce-subtle 2s infinite ease-in-out,
      pulse-glow 2s infinite;
  }

  @keyframes pulse-glow {
    0%,
    100% {
      box-shadow:
        0 4px 0 #16a34a33,
        0 0 0 0 rgba(16, 185, 129, 0.4);
    }
    50% {
      box-shadow:
        0 4px 0 #16a34a33,
        0 0 0 12px rgba(16, 185, 129, 0);
    }
  }

  @keyframes bounce-subtle {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-8px);
    }
  }

  .success-icon svg {
    width: 3.5rem;
    height: 3.5rem;
  }

  :global(html[data-theme='dark']) .success-icon {
    background: linear-gradient(135deg, rgba(20, 83, 45, 0.4) 0%, rgba(21, 128, 61, 0.4) 100%);
    color: #4ade80;
    box-shadow: 0 4px 0 rgba(0, 0, 0, 0.2);
  }

  .finished-card h2 {
    font-size: 2rem;
    margin: 0 0 1rem 0;
    color: var(--text-color, #0f172a);
  }

  .finished-card p {
    font-size: 1.125rem;
    color: #64748b;
    margin: 0 0 2.5rem 0;
    max-width: 400px;
    line-height: 1.5;
  }

  :global(html[data-theme='dark']) .finished-card p {
    color: #94a3b8;
  }

  .empty-cta-desc {
    color: #64748b;
    font-size: 0.9rem;
    margin-top: 0.25rem !important;
  }

  .empty-cta-row {
    display: flex;
    gap: 0.75rem;
    margin-top: 0.5rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .btn-secondary {
    background: transparent;
    border: 2px solid var(--card-border, #e2e8f0);
    color: var(--text-color, #0f172a);
  }

  .btn-secondary:hover {
    background: var(--card-border, #e2e8f0);
  }
</style>

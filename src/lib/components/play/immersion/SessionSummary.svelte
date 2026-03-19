<script lang="ts">
  import { fly } from 'svelte/transition';

  let {
    totalXpEarned,
    onGenerate
  }: {
    totalXpEarned: number;
    onGenerate: () => void;
  } = $props();
</script>

<div class="summary-card" in:fly={{ y: 16, duration: 400 }}>
  <div class="summary-icon">🎉</div>
  <h3>Session Complete!</h3>
  <p class="summary-xp">You earned <strong>{totalXpEarned} XP</strong> this session.</p>
  <button class="generate-btn" onclick={onGenerate}>
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      style="width:1.1rem;height:1.1rem;flex-shrink:0;"
    >
      <path
        d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
      />
    </svg>
    Read Another
  </button>
</div>

<style>
  .summary-card {
    background: var(--card-bg, #fff);
    border: 1.5px solid #a3e635;
    border-radius: 1.25rem;
    padding: 2rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }

  :global(html[data-theme='dark']) .summary-card {
    background: #1e293b;
    border-color: #65a30d;
  }

  .summary-icon {
    font-size: 2.5rem;
  }

  .summary-card h3 {
    font-size: 1.3rem;
    font-weight: 800;
    margin: 0;
    color: #1e293b;
  }

  :global(html[data-theme='dark']) .summary-card h3 {
    color: #f1f5f9;
  }

  .summary-xp {
    font-size: 1rem;
    color: #475569;
    margin: 0;
  }

  :global(html[data-theme='dark']) .summary-xp {
    color: #94a3b8;
  }

  .summary-xp strong {
    color: #16a34a;
  }

  .generate-btn {
    padding: 0.8rem 1.5rem;
    background: #7c3aed;
    color: #fff;
    border: none;
    border-radius: 0.75rem;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.625rem;
    justify-content: center;
    transition: all 0.15s;
    box-shadow: 0 4px 0 #5b21b6;
  }

  .generate-btn:hover {
    background: #6d28d9;
    transform: translateY(-1px);
  }
</style>

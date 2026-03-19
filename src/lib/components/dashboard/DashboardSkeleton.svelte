<script lang="ts">
  import Skeleton from '$lib/components/Skeleton.svelte';
  import { fly } from 'svelte/transition';
</script>

<div class="dashboard-skeleton" in:fly={{ y: 20, duration: 400 }}>
  <header class="mb-5">
    <Skeleton width="40%" height="2.5rem" className="mb-2" />
    <Skeleton width="60%" height="1.25rem" />
  </header>

  <div class="skeleton-grid mb-5">
    <div class="skeleton-card p-4">
      <Skeleton width="50%" height="1.5rem" className="mb-4" />
      <div class="heatmap-skeleton">
        {#each Array(100) as _}
          <Skeleton width="1.25rem" height="1.25rem" borderRadius="4px" />
        {/each}
      </div>
    </div>
    <div class="skeleton-card p-4">
      <Skeleton width="50%" height="1.5rem" className="mb-4" />
      <div class="list-skeleton">
        {#each Array(5) as _}
          <Skeleton width="100%" height="2rem" className="mb-2" />
        {/each}
      </div>
    </div>
  </div>

  <div class="stats-skeleton">
    {#each Array(4) as _}
      <div class="skeleton-card p-4">
        <Skeleton width="80%" height="2rem" className="mb-2" />
        <Skeleton width="40%" height="1rem" />
      </div>
    {/each}
  </div>
</div>

<style>
  .skeleton-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 2rem;
  }

  .skeleton-card {
    background: var(--card-bg, #ffffff);
    border: 2px solid var(--card-border, #e5e7eb);
    border-radius: var(--radius-xl, 1rem);
  }

  .heatmap-skeleton {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .stats-skeleton {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
  }

  .p-4 {
    padding: 1rem;
  }
</style>

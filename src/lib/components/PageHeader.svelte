<script lang="ts">
  import { fly } from 'svelte/transition';

  let { title, subtitle = '' }: { title: string; subtitle?: string } = $props();
</script>

<header class="page-header" in:fly={{ y: 20, duration: 400 }}>
  <h1>{title}</h1>
  {#if subtitle}
    <p class="page-subtitle">{subtitle}</p>
  {/if}
</header>

<style>
  .page-header {
    margin-bottom: 2rem;
  }

  .page-header h1 {
    font-size: 2rem;
    font-weight: 800;
    color: var(--text-color, #111827);
    margin: 0 0 0.25rem;
  }

  .page-subtitle {
    margin: 0;
    font-size: 0.925rem;
    color: var(--text-muted, #64748b);
  }

  @media (max-width: 640px) {
    .page-header h1 {
      font-size: 1.625rem;
    }
  }
</style>

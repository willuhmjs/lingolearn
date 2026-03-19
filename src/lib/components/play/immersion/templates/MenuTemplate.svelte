<script lang="ts">
  import TokenizedText from '../TokenizedText.svelte';

  let {
    data,
    onWordClick
  }: {
    data: any;
    onWordClick: (e: MouseEvent | KeyboardEvent, rawWord: string) => void;
  } = $props();
</script>

<div class="template menu-template">
  <div class="menu-header">
    <h1 class="menu-name">{data.restaurantName}</h1>
    <p class="menu-tagline">{data.tagline}</p>
  </div>
  {#each data.sections || [] as section}
    <div class="menu-section">
      <h3 class="menu-section-title">{section.name}</h3>
      {#each section.items || [] as item}
        <div class="menu-item">
          <div class="menu-item-info">
            <span class="menu-item-name">
              <TokenizedText text={item.name || ''} {onWordClick} />
            </span>
            <span class="menu-item-desc">
              <TokenizedText text={item.description || ''} {onWordClick} />
            </span>
          </div>
          <span class="menu-item-price">{item.price}</span>
        </div>
      {/each}
    </div>
  {/each}
</div>

<style>
  .template {
    padding: 1.5rem;
  }

  .menu-template {
    font-family: Georgia, serif;
  }

  .menu-header {
    text-align: center;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 1rem;
    margin-bottom: 1rem;
  }

  :global(html[data-theme='dark']) .menu-header {
    border-color: #334155;
  }

  .menu-name {
    font-size: 1.8rem;
    font-weight: 900;
    margin: 0 0 0.25rem;
    color: #0f172a;
  }

  :global(html[data-theme='dark']) .menu-name {
    color: #f1f5f9;
  }

  .menu-tagline {
    font-style: italic;
    color: #64748b;
    margin: 0;
  }

  .menu-section {
    margin-bottom: 1.25rem;
  }

  .menu-section-title {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 700;
    color: #64748b;
    margin: 0 0 0.75rem;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 0.25rem;
  }

  :global(html[data-theme='dark']) .menu-section-title {
    border-color: #334155;
    color: #94a3b8;
  }

  .menu-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .menu-item-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .menu-item-name {
    font-weight: 700;
    color: #1e293b;
    font-size: 0.97rem;
  }

  :global(html[data-theme='dark']) .menu-item-name {
    color: #e2e8f0;
  }

  .menu-item-desc {
    font-size: 0.85rem;
    color: #64748b;
    font-style: italic;
  }

  .menu-item-price {
    font-weight: 700;
    font-size: 0.95rem;
    color: #1e293b;
    white-space: nowrap;
    flex-shrink: 0;
  }

  :global(html[data-theme='dark']) .menu-item-price {
    color: #e2e8f0;
  }
</style>

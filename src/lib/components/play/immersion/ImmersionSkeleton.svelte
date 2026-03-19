<script lang="ts">
  import { fade } from 'svelte/transition';
  import Skeleton from '$lib/components/Skeleton.svelte';

  type MediaType =
    | 'news_article'
    | 'advertisement'
    | 'restaurant_menu'
    | 'social_post'
    | 'recipe'
    | 'review'
    | 'letter';

  let {
    skeletonType,
    selectedMediaType,
    loadingDestination
  }: {
    skeletonType: MediaType;
    selectedMediaType: MediaType | 'random';
    loadingDestination: any | null;
  } = $props();
</script>

{#if loadingDestination}
  <div class="loading-destination">
    <span class="loading-destination-emoji">{loadingDestination.emoji}</span>
    <div class="loading-destination-info">
      <div class="loading-destination-name">
        {loadingDestination.city}, {loadingDestination.country}
      </div>
      <div class="loading-destination-desc">{loadingDestination.description}</div>
    </div>
  </div>
{/if}

<div
  class="loading-card skeleton-card"
  in:fade={{ duration: 200 }}
  aria-busy="true"
  aria-label="Generating content"
>
  <!-- Shared: media type badge -->
  <Skeleton height="1.5rem" width="8rem" borderRadius="var(--radius-full)" className="mb-3" />

  {#if skeletonType === 'news_article'}
    <!-- Source bar: two short pills side by side -->
    <div class="skeleton-row mb-2">
      <Skeleton width="5rem" height="1.25rem" borderRadius="var(--radius-full)" />
      <Skeleton width="4rem" height="1.25rem" borderRadius="var(--radius-full)" />
    </div>
    <Skeleton height="1.75rem" width="80%" className="mb-2" />
    <Skeleton height="0.85rem" width="45%" className="mb-3" />
    <div class="skeleton-rule mb-2"></div>
    <Skeleton height="0.9rem" width="100%" className="mb-1" />
    <Skeleton height="0.9rem" width="65%" className="mb-1" />
    <Skeleton height="0.9rem" width="100%" className="mb-1" />
    <Skeleton height="0.9rem" width="85%" className="mb-1" />
    <Skeleton height="0.9rem" width="65%" />
  {:else if skeletonType === 'advertisement'}
    <!-- Brand + product + slogan + feature bullets + price + CTA -->
    <Skeleton width="6rem" height="1.25rem" borderRadius="var(--radius-full)" className="mb-2" />
    <Skeleton height="1.75rem" width="70%" className="mb-2" />
    <Skeleton height="0.9rem" width="55%" className="mb-3" />
    <div class="skeleton-bullet-list">
      <div class="skeleton-bullet-container">
        <div class="bullet-dot"></div>
        <Skeleton height="0.85rem" width="75%" />
      </div>
      <div class="skeleton-bullet-container">
        <div class="bullet-dot"></div>
        <Skeleton height="0.85rem" width="75%" />
      </div>
      <div class="skeleton-bullet-container">
        <div class="bullet-dot"></div>
        <Skeleton height="0.85rem" width="75%" />
      </div>
    </div>
    <Skeleton
      width="4rem"
      height="1.25rem"
      borderRadius="var(--radius-full)"
      className="mt-2 mb-3"
    />
    <Skeleton height="2.25rem" width="60%" borderRadius="var(--radius-md)" className="mx-auto" />
  {:else if skeletonType === 'restaurant_menu'}
    <!-- Restaurant name + tagline + 2 sections with items -->
    <Skeleton height="1.75rem" width="60%" className="mx-auto mb-2" />
    <Skeleton height="0.9rem" width="45%" className="mx-auto mb-5" />

    <Skeleton height="1.1rem" width="40%" className="mb-2" />
    {#each Array(2) as _}
      <div class="skeleton-menu-item">
        <div style="flex:1">
          <Skeleton height="0.9rem" width="65%" className="mb-1" />
          <Skeleton height="0.9rem" width="45%" />
        </div>
        <Skeleton width="2.5rem" height="1.25rem" borderRadius="var(--radius-full)" />
      </div>
    {/each}

    <Skeleton height="1.1rem" width="40%" className="mt-4 mb-2" />
    <div class="skeleton-menu-item">
      <div style="flex:1">
        <Skeleton height="0.9rem" width="50%" className="mb-1" />
        <Skeleton height="0.9rem" width="40%" />
      </div>
      <Skeleton width="2.5rem" height="1.25rem" borderRadius="var(--radius-full)" />
    </div>
  {:else if skeletonType === 'social_post'}
    <!-- Avatar + username/handle + timestamp + content + hashtags + stats -->
    <div class="skeleton-social-header">
      <Skeleton width="2.5rem" height="2.5rem" borderRadius="50%" />
      <div class="skeleton-social-meta">
        <Skeleton width="7rem" height="0.85rem" />
        <Skeleton width="5rem" height="0.75rem" className="mt-1" />
      </div>
      <Skeleton
        width="3rem"
        height="1.25rem"
        borderRadius="var(--radius-full)"
        className="ml-auto"
      />
    </div>
    <Skeleton height="0.9rem" width="100%" className="mt-3" />
    <Skeleton height="0.9rem" width="100%" className="mt-1" />
    <Skeleton height="0.9rem" width="65%" className="mt-1" />

    <div class="skeleton-row mt-2" style="gap:0.5rem">
      <Skeleton width="4rem" height="1.25rem" borderRadius="var(--radius-full)" />
      <Skeleton width="4rem" height="1.25rem" borderRadius="var(--radius-full)" />
      <Skeleton width="4rem" height="1.25rem" borderRadius="var(--radius-full)" />
    </div>
    <div class="skeleton-row mt-3">
      <Skeleton width="3.5rem" height="1.25rem" borderRadius="var(--radius-full)" />
      <Skeleton width="3.5rem" height="1.25rem" borderRadius="var(--radius-full)" />
    </div>
  {:else if skeletonType === 'recipe'}
    <!-- Title + meta chips + two-column: ingredients / steps -->
    <Skeleton height="1.75rem" width="70%" className="mb-2" />
    <div class="skeleton-row mb-4" style="flex-wrap:wrap;gap:0.5rem">
      <Skeleton width="6rem" height="1.25rem" borderRadius="var(--radius-full)" />
      <Skeleton width="7rem" height="1.25rem" borderRadius="var(--radius-full)" />
      <Skeleton width="5rem" height="1.25rem" borderRadius="var(--radius-full)" />
    </div>
    <div class="skeleton-recipe-cols">
      <div class="skeleton-col">
        <Skeleton height="1.1rem" width="60%" className="mb-2" />
        {#each Array(4) as _, i}
          <div class="skeleton-bullet-container">
            <div class="bullet-dot"></div>
            <Skeleton height="0.85rem" width={i === 3 ? '55%' : '75%'} />
          </div>
        {/each}
      </div>
      <div class="skeleton-col">
        <Skeleton height="1.1rem" width="70%" className="mb-2" />
        <Skeleton height="0.9rem" width="100%" className="mb-1" />
        <Skeleton height="0.9rem" width="65%" className="mb-2" />
        <Skeleton height="0.9rem" width="100%" className="mb-1" />
        <Skeleton height="0.9rem" width="80%" />
      </div>
    </div>
  {:else if skeletonType === 'review'}
    <!-- Subject + stars + author/date + body + verdict -->
    <div class="skeleton-row" style="align-items:flex-start;justify-content:space-between">
      <div>
        <Skeleton height="1.75rem" width="12rem" className="mb-2" />
        <Skeleton width="5rem" height="1.25rem" borderRadius="var(--radius-full)" />
      </div>
      <div style="text-align:right">
        <Skeleton width="6rem" height="0.8rem" className="ml-auto" />
        <Skeleton width="4rem" height="0.75rem" className="mt-1 ml-auto" />
      </div>
    </div>
    <Skeleton height="0.9rem" width="100%" className="mt-3" />
    <Skeleton height="0.9rem" width="100%" className="mt-1" />
    <Skeleton height="0.9rem" width="65%" className="mt-1" />
    <Skeleton height="2.5rem" width="100%" borderRadius="var(--radius-md)" className="mt-3" />
  {:else if skeletonType === 'letter'}
    <!-- Location/date, salutation, body paragraphs, closing, signature -->
    <Skeleton height="0.9rem" width="10rem" className="mb-4" />
    <Skeleton height="0.9rem" width="8rem" className="mb-3" />
    <Skeleton height="0.9rem" width="100%" className="mb-1" />
    <Skeleton height="0.9rem" width="100%" className="mb-1" />
    <Skeleton height="0.9rem" width="65%" className="mb-3" />
    <Skeleton height="0.9rem" width="100%" className="mb-1" />
    <Skeleton height="0.9rem" width="80%" className="mb-4" />
    <Skeleton height="0.9rem" width="6rem" className="mb-1" />
    <Skeleton height="0.9rem" width="8rem" />
  {/if}

  <div class="skeleton-hint">
    Generating your {selectedMediaType === 'random'
      ? 'content'
      : selectedMediaType.replace(/_/g, ' ')}...
  </div>
</div>

<style>
  /* Loading */
  .loading-card {
    background: var(--card-bg, #fff);
    border: 1.5px solid var(--card-border, #e2e8f0);
    border-radius: 1.25rem;
    padding: 3rem;
  }

  .skeleton-card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* Horizontal rule (news) */
  .skeleton-rule {
    height: 1px;
    width: 100%;
    background: var(--card-border, #e2e8f0);
    opacity: 0.5;
  }

  :global(html[data-theme='dark']) .skeleton-rule {
    background: #334155;
  }

  /* Bullet-list items */
  .skeleton-bullet-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding-left: 1rem;
    margin: 0.25rem 0;
  }

  .skeleton-bullet-container {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .bullet-dot {
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 50%;
    background: var(--card-border, #e2e8f0);
    flex-shrink: 0;
  }

  :global(html[data-theme='dark']) .bullet-dot {
    background: #334155;
  }

  /* Social post header row */
  .skeleton-social-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .skeleton-social-meta {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  /* Horizontal flex row helper */
  .skeleton-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  /* Menu row: name+desc left, price right */
  .skeleton-menu-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.4rem 0;
    border-bottom: 1px solid var(--card-border, #e2e8f0);
  }

  :global(html[data-theme='dark']) .skeleton-menu-item {
    border-color: #334155;
  }

  /* Recipe two-column layout */
  .skeleton-recipe-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    margin-top: 0.5rem;
  }

  .skeleton-col {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .skeleton-hint {
    margin-top: 1.25rem;
    color: #94a3b8;
    font-size: 0.875rem;
    text-align: center;
  }

  .loading-destination {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    margin-top: 0.5rem;
    padding: 0.875rem 1rem;
    background: #eff6ff;
    border: 1px solid #3b82f6;
    border-radius: 0.875rem;
  }

  :global(html[data-theme='dark']) .loading-destination {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.4);
  }

  .loading-destination-emoji {
    font-size: 2.25rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .loading-destination-info {
    flex: 1;
    min-width: 0;
  }

  .loading-destination-name {
    font-weight: 600;
    font-size: 1rem;
    color: #1e293b;
  }

  :global(html[data-theme='dark']) .loading-destination-name {
    color: #e2e8f0;
  }

  .loading-destination-desc {
    font-size: 0.8125rem;
    color: #64748b;
    margin-top: 0.2rem;
  }
</style>

<script lang="ts">
  import { fly } from 'svelte/transition';
  import NewsTemplate from './templates/NewsTemplate.svelte';
  import AdTemplate from './templates/AdTemplate.svelte';
  import MenuTemplate from './templates/MenuTemplate.svelte';
  import SocialTemplate from './templates/SocialTemplate.svelte';
  import RecipeTemplate from './templates/RecipeTemplate.svelte';
  import ReviewTemplate from './templates/ReviewTemplate.svelte';
  import LetterTemplate from './templates/LetterTemplate.svelte';

  type MediaType =
    | 'news_article'
    | 'advertisement'
    | 'restaurant_menu'
    | 'social_post'
    | 'recipe'
    | 'review'
    | 'letter';

  type ImmersionSession = {
    mediaType: MediaType;
    templateData: Record<string, any>;
    questions: any[];
    vocabIds: string[];
    destination: any | null;
  };

  /* eslint-disable svelte/no-unused-props */
  let {
    session,
    language,
    disableHoverTranslation,
    MEDIA_LABELS
  }: {
    session: ImmersionSession;
    language: any;
    disableHoverTranslation: boolean;
    MEDIA_LABELS: Record<MediaType, { label: string; icon: string }>;
  } = $props();

  const components = {
    news_article: NewsTemplate,
    advertisement: AdTemplate,
    restaurant_menu: MenuTemplate,
    social_post: SocialTemplate,
    recipe: RecipeTemplate,
    review: ReviewTemplate,
    letter: LetterTemplate
  };
</script>

<div class="session-wrapper" in:fly={{ y: 20, duration: 400 }}>
  <div
    class="media-card"
    class:no-word-hover={disableHoverTranslation}
    aria-label="Reading content"
  >
    <div class="media-type-badge">
      {MEDIA_LABELS[session.mediaType].icon}
      {MEDIA_LABELS[session.mediaType].label}
      {#if language?.id}
        <span class="word-click-hint">· tap a word to look it up</span>
      {/if}
    </div>

    {#if session.destination}
      <div class="destination-banner">
        <span class="destination-flag">{session.destination.emoji}</span>
        <div class="destination-text">
          <span class="destination-name"
            >✈️ {session.destination.city}, {session.destination.country}</span
          >
          <span class="destination-desc">{session.destination.description}</span>
        </div>
      </div>
    {/if}

    <div class="template-container">
      {#if components[session.mediaType]}
        {@const Template = components[session.mediaType]}
        <Template data={session.templateData} />
      {/if}
    </div>
  </div>
</div>

<style>
  .session-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .media-card {
    background: var(--card-bg, #fff);
    border: 1.5px solid var(--card-border, #e2e8f0);
    border-radius: 1.25rem;
    overflow: hidden;
    cursor: text;
  }

  :global(html[data-theme='dark']) .media-card {
    background: #1e293b;
    border-color: #334155;
  }

  .media-type-badge {
    background: #f8fafc;
    border-bottom: 1px solid var(--card-border, #e2e8f0);
    padding: 0.6rem 1.25rem;
    font-size: 0.8rem;
    font-weight: 700;
    color: #64748b;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  :global(html[data-theme='dark']) .media-type-badge {
    background: #0f172a;
    border-color: #334155;
    color: #94a3b8;
  }

  .word-click-hint {
    font-size: 0.72rem;
    font-weight: 500;
    color: #94a3b8;
    margin-left: 0.4rem;
    letter-spacing: 0;
    text-transform: none;
  }

  .destination-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 1.25rem;
    background: linear-gradient(90deg, #f0fdf4 0%, #f8fafc 100%);
    border-bottom: 1px solid #bbf7d0;
  }

  :global(html[data-theme='dark']) .destination-banner {
    background: linear-gradient(90deg, #064e3b 0%, #1e293b 100%);
    border-bottom-color: #065f46;
  }

  .destination-flag {
    font-size: 1.75rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .destination-text {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .destination-name {
    font-size: 0.85rem;
    font-weight: 700;
    color: #065f46;
  }

  :global(html[data-theme='dark']) .destination-name {
    color: #6ee7b7;
  }

  .destination-desc {
    font-size: 0.75rem;
    color: #059669;
  }

  :global(html[data-theme='dark']) .destination-desc {
    color: #34d399;
  }

  .template-container {
    /* Container for templates */
  }
</style>

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

<div class="template recipe-template">
  <h1 class="recipe-title">{data.title}</h1>
  <div class="recipe-meta">
    <span>🍽️ {data.servings} Portionen</span>
    <span>⏱ Zubereitung: {data.prepTime}</span>
    <span>🔥 Kochzeit: {data.cookTime}</span>
    <span>📊 {data.difficulty}</span>
  </div>
  <div class="recipe-cols">
    <div class="recipe-ingredients">
      <h3>Zutaten</h3>
      <ul>
        {#each data.ingredients || [] as ing}
          <li>
            <TokenizedText text={ing || ''} {onWordClick} />
          </li>
        {/each}
      </ul>
    </div>
    <div class="recipe-steps">
      <h3>Zubereitung</h3>
      <ol>
        {#each data.steps || [] as step}
          <li>
            <TokenizedText text={step || ''} {onWordClick} />
          </li>
        {/each}
      </ol>
    </div>
  </div>
  {#if data.tips}
    <div class="recipe-tip">
      <strong>Tipp:</strong>
      {data.tips}
    </div>
  {/if}
</div>

<style>
  .template {
    padding: 1.5rem;
  }

  .recipe-title {
    font-size: 1.6rem;
    font-weight: 900;
    margin: 0 0 0.75rem;
    color: #0f172a;
  }

  :global(html[data-theme='dark']) .recipe-title {
    color: #f1f5f9;
  }

  .recipe-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
  }

  .recipe-meta span {
    background: #f1f5f9;
    border-radius: 0.5rem;
    padding: 0.25rem 0.6rem;
    font-size: 0.82rem;
    font-weight: 600;
    color: #475569;
  }

  :global(html[data-theme='dark']) .recipe-meta span {
    background: #0f172a;
    color: #94a3b8;
  }

  .recipe-cols {
    display: grid;
    grid-template-columns: 1fr 1.5fr;
    gap: 1.5rem;
  }

  @media (max-width: 520px) {
    .recipe-cols {
      grid-template-columns: 1fr;
    }
  }

  .recipe-ingredients h3,
  .recipe-steps h3 {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #64748b;
    margin: 0 0 0.5rem;
  }

  .recipe-ingredients ul {
    padding-left: 1.2rem;
    margin: 0;
  }

  .recipe-ingredients li {
    font-size: 0.9rem;
    line-height: 1.8;
    color: #334155;
  }

  :global(html[data-theme='dark']) .recipe-ingredients li {
    color: #cbd5e1;
  }

  .recipe-steps ol {
    padding-left: 1.4rem;
    margin: 0;
  }

  .recipe-steps li {
    font-size: 0.9rem;
    line-height: 1.75;
    color: #334155;
    margin-bottom: 0.4rem;
  }

  :global(html[data-theme='dark']) .recipe-steps li {
    color: #cbd5e1;
  }

  .recipe-tip {
    margin-top: 1rem;
    padding: 0.75rem 1rem;
    background: #fefce8;
    border-left: 3px solid #fbbf24;
    border-radius: 0 0.5rem 0.5rem 0;
    font-size: 0.88rem;
    color: #713f12;
  }

  :global(html[data-theme='dark']) .recipe-tip {
    background: #1c1400;
    color: #fbbf24;
  }
</style>

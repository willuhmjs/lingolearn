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

<div class="template ad-template">
  <div class="ad-brand">{data.brand}</div>
  <h2 class="ad-product">
    <TokenizedText text={data.product || ''} {onWordClick} />
  </h2>
  <p class="ad-slogan">
    "<TokenizedText text={data.slogan || ''} {onWordClick} />"
  </p>
  {#if data.features?.length}
    <ul class="ad-features">
      {#each data.features as feat}
        <li>
          <TokenizedText text={feat || ''} {onWordClick} />
        </li>
      {/each}
    </ul>
  {/if}
  {#if data.price}
    <p class="ad-price">{data.price}</p>
  {/if}
  <button class="ad-cta" disabled>{data.callToAction}</button>
  {#if data.disclaimer}
    <p class="ad-disclaimer">{data.disclaimer}</p>
  {/if}
</div>

<style>
  .ad-template {
    background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%);
    color: #fff;
    text-align: center;
    border-radius: 0 0 1.25rem 1.25rem;
    padding: 2rem 1.5rem;
  }

  .ad-brand {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: rgba(255, 255, 255, 0.6);
    margin-bottom: 0.5rem;
  }

  .ad-product {
    font-size: 2rem;
    font-weight: 900;
    margin: 0 0 0.75rem;
  }

  .ad-slogan {
    font-size: 1.1rem;
    font-style: italic;
    color: rgba(255, 255, 255, 0.85);
    margin: 0 0 1.25rem;
  }

  .ad-features {
    list-style: none;
    padding: 0;
    margin: 0 0 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    text-align: left;
    max-width: 360px;
    margin-left: auto;
    margin-right: auto;
  }

  .ad-features li::before {
    content: '✓ ';
    color: #4ade80;
    font-weight: 700;
  }

  .ad-price {
    font-size: 1.4rem;
    font-weight: 900;
    color: #fbbf24;
    margin: 0 0 1rem;
  }

  .ad-cta {
    background: #fbbf24;
    color: #0f172a;
    border: none;
    border-radius: 0.5rem;
    padding: 0.75rem 2rem;
    font-size: 1rem;
    font-weight: 800;
    cursor: default;
    display: inline-block;
    margin-bottom: 1rem;
  }

  .ad-disclaimer {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.4);
    margin: 0;
  }
</style>

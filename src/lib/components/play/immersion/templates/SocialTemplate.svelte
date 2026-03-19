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

<div class="template social-template">
  <div class="social-header">
    <div class="social-avatar">{data.username?.[0] ?? '?'}</div>
    <div>
      <div class="social-username">{data.username}</div>
      <div class="social-handle">{data.handle}</div>
    </div>
    <span class="social-timestamp">{data.timestamp}</span>
  </div>
  <p class="social-content">
    <TokenizedText text={data.content || ''} {onWordClick} />
  </p>
  {#if data.hashtags?.length}
    <p class="social-hashtags">
      {data.hashtags.join(' ')}
    </p>
  {/if}
  <div class="social-stats">
    <span>❤️ {data.likes}</span>
    <span>💬 {data.comments}</span>
  </div>
</div>

<style>
  .template {
    padding: 1.5rem;
  }

  .social-template {
    max-width: 480px;
  }

  .social-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .social-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #1cb0f6, #7c3aed);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  .social-username {
    font-weight: 700;
    font-size: 0.95rem;
    color: #1e293b;
  }

  :global(html[data-theme='dark']) .social-username {
    color: #f1f5f9;
  }

  .social-handle {
    font-size: 0.82rem;
    color: #64748b;
  }

  .social-timestamp {
    margin-left: auto;
    font-size: 0.78rem;
    color: #94a3b8;
  }

  .social-content {
    font-size: 0.97rem;
    line-height: 1.6;
    color: #1e293b;
    margin: 0 0 0.75rem;
    white-space: pre-line;
  }

  :global(html[data-theme='dark']) .social-content {
    color: #e2e8f0;
  }

  .social-hashtags {
    font-size: 0.9rem;
    color: #1cb0f6;
    margin: 0 0 0.75rem;
  }

  .social-stats {
    display: flex;
    gap: 1rem;
    font-size: 0.85rem;
    color: #64748b;
    border-top: 1px solid #e2e8f0;
    padding-top: 0.75rem;
  }

  :global(html[data-theme='dark']) .social-stats {
    border-color: #334155;
  }
</style>

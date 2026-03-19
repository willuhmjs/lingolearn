<script lang="ts">
  let {
    width = '100%',
    height = '1rem',
    borderRadius = 'var(--radius-md, 0.5rem)',
    className = ''
  } = $props();
</script>

<div class="skeleton {className}" style:width style:height style:border-radius={borderRadius}></div>

<style>
  .skeleton {
    background-color: var(--card-border, #e5e7eb);
    position: relative;
    overflow: hidden;
  }

  :global(html[data-theme='dark']) .skeleton {
    background-color: #334155;
  }

  .skeleton::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);
    animation: shimmer 1.5s infinite;
  }

  :global(html[data-theme='dark']) .skeleton::after {
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.04), transparent);
  }

  @keyframes shimmer {
    100% {
      transform: translateX(100%);
    }
  }
</style>

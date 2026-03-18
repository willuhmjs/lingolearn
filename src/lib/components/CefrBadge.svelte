<script lang="ts">
  let { level }: { level: string } = $props();

  const colors: Record<string, { bg: string; text: string; border: string }> = {
    A1: { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
    A2: { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
    B1: { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
    B2: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
    C1: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
    C2: { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' }
  };

  const style_map = $derived(colors[level] ?? colors['A1']);
</script>

<span
  class="cefr-badge"
  style="background:{style_map.bg};color:{style_map.text};border-color:{style_map.border}"
>
  {level}
</span>

<style>
  .cefr-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    padding: 0.15rem 0.45rem;
    border-radius: 999px;
    border: 1.5px solid;
    line-height: 1;
    white-space: nowrap;
  }

  :global(html[data-theme='dark']) .cefr-badge {
    filter: brightness(0.75) saturate(1.2);
  }
</style>

<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'duo' | 'primary' | 'secondary' | 'danger' | 'ghost' | 'ai';
    type?: 'button' | 'submit' | 'reset';
    loading?: boolean;
    disabled?: boolean;
    class?: string;
    href?: string;
    onclick?: (e: MouseEvent) => void;
    children?: Snippet;
    [key: string]: any;
  }

  let {
    variant = 'duo',
    type = 'button',
    loading = false,
    disabled = false,
    class: className = '',
    href,
    onclick,
    children,
    ...rest
  }: Props = $props();

  const variantClasses = {
    duo: 'btn-duo',
    primary: 'btn-duo btn-primary',
    secondary: 'btn-duo btn-secondary',
    danger: 'btn-duo btn-danger',
    ghost: 'btn-ghost',
    ai: 'btn-duo btn-ai'
  };
</script>

{#if href}
  <a {href} class="btn-unified {variantClasses[variant]} {className}" {onclick} {...rest}>
    <span class="btn-content">
      {@render children?.()}
    </span>
  </a>
{:else}
  <button
    {type}
    class="btn-unified {variantClasses[variant]} {className}"
    disabled={disabled || loading}
    {onclick}
    {...rest}
  >
    {#if loading}
      <div class="loading-overlay">
        <span class="loading-spinner"></span>
      </div>
    {/if}
    <span class="btn-content" class:is-loading={loading}>
      {@render children?.()}
    </span>
  </button>
{/if}

<style>
  .btn-unified {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    user-select: none;
    outline: none;
    border: 2px solid transparent;
    box-sizing: border-box;
  }

  .btn-unified:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  /* Ghost variant: simple and flat */
  .btn-ghost {
    background: transparent;
    color: var(--text-color, #4b5563);
    border: 2px solid transparent;
    border-radius: 0.75rem;
    padding: 0.625rem 1.25rem;
    font-weight: 700;
    font-size: 0.95rem;
  }

  .btn-ghost:hover:not(:disabled) {
    background-color: var(--link-hover-bg, #f3f4f6);
    color: var(--text-color, #111827);
  }

  .btn-ghost:active:not(:disabled) {
    transform: scale(0.98);
  }

  :global(html[data-theme='dark']) .btn-ghost {
    color: #94a3b8;
  }

  :global(html[data-theme='dark']) .btn-ghost:hover:not(:disabled) {
    background-color: #2a303c;
    color: #f1f5f9;
  }

  /* Loading states */
  .loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .loading-spinner {
    width: 1.25rem;
    height: 1.25rem;
    border: 2.5px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: currentColor;
    animation: spin 0.8s linear infinite;
  }

  .btn-content.is-loading {
    visibility: hidden;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Fix for duo buttons active state when they have btn-unified base */
  :global(.btn-duo.btn-unified:active:not(:disabled)) {
    transform: translateY(4px);
  }
</style>

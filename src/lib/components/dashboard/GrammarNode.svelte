<script lang="ts">
  import { Handle, Position, type NodeProps, type Node } from '@xyflow/svelte';

  interface GrammarNodeData extends Record<string, unknown> {
    title: string;
    srsState: string;
    eloRating: number;
    eloPercent: number;
    isLocked: boolean;
    description: string;
    srsColor: string;
    onOpenModal: (rule: any) => void;
    rule: any;
  }

  let { data: rawData }: NodeProps<Node<GrammarNodeData>> = $props();
  let data = $derived(rawData);
</script>

<div
  class="web-node-pill"
  class:locked={data.isLocked}
  style="--node-color: {data.srsColor}"
  onclick={() => data.onOpenModal(data.rule)}
  onkeydown={(e) => e.key === 'Enter' && data.onOpenModal(data.rule)}
  role="button"
  tabindex="0"
  aria-label="View grammar rule: {data.title}"
>
  <Handle type="target" position={Position.Top} />

  <div class="node-pill-content tooltip-trigger">
    <div class="node-icon" style="background-color: {data.srsColor}">
      <span class="sr-only">{data.srsState}</span>
    </div>
    <span class="node-title">{data.title}</span>

    <div class="tooltip-content">
      <div class="tooltip-header">
        {data.title}
      </div>
      <div class="tooltip-body">
        <div class="word-tooltip-elo">
          <div class="elo-header">
            <span>Status: {data.srsState}</span>
            {#if !data.isLocked}
              <span class="elo-score">ELO {Math.ceil(data.eloRating)}</span>
            {/if}
          </div>
          {#if !data.isLocked}
            <div class="elo-progress-track">
              <div
                class="elo-progress-fill {data.srsState.toLowerCase()}"
                style="width: {data.eloPercent}%; background-color: {data.srsColor}"
              ></div>
            </div>
          {/if}
        </div>
        <p class="node-desc">
          {data.description || 'No description available.'}
        </p>
      </div>
    </div>
  </div>

  <Handle type="source" position={Position.Bottom} />
</div>

<style>
  .web-node-pill {
    position: relative;
    display: flex;
    align-items: center;
    background: #ffffff;
    border: 2px solid var(--node-color);
    border-radius: 9999px;
    padding: 0.5rem 1.25rem 0.5rem 0.5rem;
    box-shadow:
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 0 10px var(--node-color) 40;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    min-width: 150px;
    justify-content: center;
  }

  :global(html[data-theme='dark']) .web-node-pill {
    background: #1e293b;
  }

  .web-node-pill:hover {
    transform: translateY(-2px) scale(1.05);
    box-shadow:
      0 10px 15px -3px rgba(0, 0, 0, 0.1),
      0 0 15px var(--node-color) 60;
    z-index: 10;
  }

  .web-node-pill.locked {
    opacity: 0.7;
    border-style: dashed;
    background-color: #f1f5f9;
  }

  :global(html[data-theme='dark']) .web-node-pill.locked {
    background-color: #0f172a;
  }

  .node-pill-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .node-icon {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
    flex-shrink: 0;
  }

  .node-title {
    font-weight: 600;
    font-size: 0.95rem;
    color: #334155;
    white-space: nowrap;
  }

  :global(html[data-theme='dark']) .node-title {
    color: #f8fafc;
  }

  .node-desc {
    margin-top: 0.5rem;
    color: #94a3b8;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  /* Tooltip styles */
  .tooltip-trigger {
    position: relative;
  }

  .tooltip-content {
    visibility: hidden;
    opacity: 0;
    position: absolute;
    bottom: calc(100% + 12px);
    left: 50%;
    transform: translateX(-50%) translateY(5px);
    margin-bottom: 0;
    background-color: #0f172a;
    color: #f8fafc;
    text-align: left;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    width: max-content;
    min-width: 140px;
    max-width: 200px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
    z-index: 100;
    pointer-events: none;
    border: 1px solid rgba(255, 255, 255, 0.1);
    line-height: 1.3;
  }

  .tooltip-content::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -6px;
    border-width: 6px;
    border-style: solid;
    border-color: #0f172a transparent transparent transparent;
  }

  .tooltip-trigger:hover .tooltip-content {
    visibility: visible;
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }

  .tooltip-header {
    font-weight: 700;
    font-size: 0.95rem;
    margin-bottom: 0.25rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 0.25rem;
    color: #ffffff;
  }

  .tooltip-body {
    font-size: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    color: #cbd5e1;
  }

  .word-tooltip-elo {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 0.25rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .elo-header {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 0.7rem;
    color: #94a3b8;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .elo-score {
    color: #3b82f6;
  }

  .elo-progress-track {
    display: block;
    width: 100%;
    height: 4px;
    background: #1e293b;
    border-radius: 9999px;
    overflow: hidden;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .elo-progress-fill {
    display: block;
    height: 100%;
    border-radius: 9999px;
    transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .elo-progress-fill.learning {
    background: linear-gradient(90deg, #facc15, #fef08a);
  }
  .elo-progress-fill.known {
    background: linear-gradient(90deg, #34d399, #6ee7b7);
  }
  .elo-progress-fill.mastered {
    background: linear-gradient(90deg, #10b981, #059669);
  }

  /* Adjust handles to be less visible or styled */
  :global(.svelte-flow__handle) {
    background: var(--node-color);
    border: 2px solid #ffffff;
    width: 8px;
    height: 8px;
  }

  :global(html[data-theme='dark'] .svelte-flow__handle) {
    border-color: #1e293b;
  }
</style>

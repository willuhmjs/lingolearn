<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteFlow, Background, Controls, type Node, type Edge } from '@xyflow/svelte';
  import dagre from 'dagre';
  import GrammarNode from './GrammarNode.svelte';

  import '@xyflow/svelte/dist/style.css';

  const srsColors: Record<string, string> = {
    LOCKED: 'var(--color-locked, #94a3b8)',
    UNSEEN: 'var(--color-unseen, #e2e8f0)',
    LEARNING: 'var(--color-learning, #fef08a)',
    KNOWN: 'var(--color-known, #6ee7b7)',
    MASTERED: 'var(--color-mastered, #10b981)'
  };

  interface Props {
    allGrammarRules: any[];
    grammarRules: any[];
    onOpenModal: (rule: any, color: string, eloPercent: number) => void;
  }

  let { allGrammarRules, grammarRules, onOpenModal }: Props = $props();

  let grammarSortOrder = $state<'easiest' | 'hardest'>('easiest');
  let grammarView = $state<'web' | 'list'>('web');

  const nodeTypes = {
    grammar: GrammarNode
  };

  onMount(() => {
    if (window.innerWidth < 640) grammarView = 'list';
  });

  // Topologically sort grammar rules to ensure prerequisites come first
  let sortedRules = $derived(
    (() => {
      const rules = allGrammarRules || [];
      const sorted: any[] = [];
      const visited = new Set<string>();
      const visiting = new Set<string>();

      function visit(rule: any) {
        if (visited.has(rule.id)) return;
        if (visiting.has(rule.id)) return;
        visiting.add(rule.id);

        for (const dep of rule.dependencies || []) {
          const depRule = rules.find((r: any) => r.id === dep.id);
          if (depRule) {
            visit(depRule);
          }
        }

        visiting.delete(rule.id);
        visited.add(rule.id);
        sorted.push(rule);
      }

      for (const rule of rules) {
        visit(rule);
      }

      if (grammarSortOrder === 'hardest') {
        return sorted.reverse();
      }

      return sorted;
    })()
  );

  // Merge user progress with all possible rules for the grammar web
  let grammarWebNodes = $derived(
    sortedRules.map((rule: any) => {
      const userProgress = grammarRules.find((ur: any) => ur.grammarRuleId === rule.id);
      const prereqsMet =
        (rule.dependencies || []).length === 0 ||
        (rule.dependencies || []).every((dep: any) => {
          const depProgress = grammarRules.find((ur: any) => ur.grammarRuleId === dep.id);
          return depProgress?.srsState === 'MASTERED';
        });
      return {
        ...userProgress,
        grammarRule: rule,
        srsState: userProgress?.srsState || (prereqsMet ? 'UNSEEN' : 'LOCKED'),
        eloRating: userProgress?.eloRating || 1000,
        isLocked: !prereqsMet
      };
    })
  );

  function computeEloPercent(rule: any): number {
    if (rule.isLocked) return 0;
    return Math.max(
      0,
      Math.min(
        100,
        rule.srsState === 'LEARNING'
          ? ((rule.eloRating - 1000) / 50) * 100
          : rule.srsState === 'KNOWN'
            ? ((rule.eloRating - 1050) / 100) * 100
            : rule.srsState === 'MASTERED'
              ? 100
              : 0
      )
    );
  }

  function handleOpenModal(rule: any) {
    const srsColor = srsColors[rule.srsState] || srsColors.LOCKED;
    const eloPercent = computeEloPercent(rule);
    onOpenModal(rule, srsColor, eloPercent);
  }

  // Svelte Flow state
  let nodes = $state<Node[]>([]);
  let edges = $state<Edge[]>([]);

  function getLayoutedElements(nodes: Node[], edges: Edge[]) {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: 'TB', nodesep: 100, ranksep: 100 });

    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, { width: 180, height: 60 });
    });

    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    return nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - 90,
          y: nodeWithPosition.y - 30
        }
      };
    });
  }

  $effect(() => {
    if (grammarView !== 'web') return;

    const flowNodes: Node[] = grammarWebNodes.map((rule: any) => ({
      id: rule.grammarRule.id,
      type: 'grammar',
      data: {
        title: rule.grammarRule.title,
        srsState: rule.srsState,
        eloRating: rule.eloRating,
        eloPercent: computeEloPercent(rule),
        isLocked: rule.isLocked,
        description: rule.grammarRule.description,
        srsColor: srsColors[rule.srsState] || srsColors.LOCKED,
        onOpenModal: () => handleOpenModal(rule),
        rule: rule
      },
      position: { x: 0, y: 0 }
    }));

    const flowEdges: Edge[] = [];
    grammarWebNodes.forEach((rule: any) => {
      (rule.grammarRule.dependencies || []).forEach((dep: any) => {
        flowEdges.push({
          id: `e-${dep.id}-${rule.grammarRule.id}`,
          source: dep.id,
          target: rule.grammarRule.id,
          animated: rule.srsState !== 'LOCKED' && rule.srsState !== 'UNSEEN'
        });
      });
    });

    const layoutedNodes = getLayoutedElements(flowNodes, flowEdges);
    nodes = layoutedNodes;
    edges = flowEdges;
  });
</script>

<section class="grammar-section">
  <div class="grammar-header-row">
    <h2>Grammar Web</h2>
    <div class="grammar-header-controls">
      <div class="sort-control">
        <label for="grammar-sort">Sort by:</label>
        <select id="grammar-sort" bind:value={grammarSortOrder}>
          <option value="easiest">Easiest to Hardest</option>
          <option value="hardest">Hardest to Easiest</option>
        </select>
      </div>
      <!-- View toggle -->
      <div class="view-toggle" role="group" aria-label="Grammar view mode">
        <button
          class="view-toggle-btn"
          class:active={grammarView === 'web'}
          onclick={() => (grammarView = 'web')}
          aria-pressed={grammarView === 'web'}
          title="Web view"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
            width="16"
            height="16"
          >
            <circle cx="12" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle
              cx="19"
              cy="19"
              r="2"
            />
            <line x1="12" y1="7" x2="5" y2="17" /><line x1="12" y1="7" x2="19" y2="17" />
          </svg>
        </button>
        <button
          class="view-toggle-btn"
          class:active={grammarView === 'list'}
          onclick={() => (grammarView = 'list')}
          aria-pressed={grammarView === 'list'}
          title="List view"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
            width="16"
            height="16"
          >
            <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line
              x1="8"
              y1="18"
              x2="21"
              y2="18"
            />
            <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line
              x1="3"
              y1="18"
              x2="3.01"
              y2="18"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>
  {#if grammarWebNodes.length === 0}
    <p class="empty-state">No grammar rules available for this language.</p>
  {:else if grammarView === 'list'}
    <!-- List view fallback -->
    <div class="grammar-list">
      {#each grammarWebNodes as rule}
        {@const srsColor = srsColors[rule.srsState] || srsColors.LOCKED}
        <button
          class="grammar-list-row"
          class:locked={rule.isLocked}
          onclick={() => handleOpenModal(rule)}
          aria-label="View grammar rule: {rule.grammarRule.title}"
        >
          <div class="grammar-list-dot" style="background-color: {srsColor}"></div>
          <div class="grammar-list-info">
            <span class="grammar-list-title">{rule.grammarRule.title}</span>
            {#if rule.grammarRule.level}
              <span class="grammar-list-level">{rule.grammarRule.level}</span>
            {/if}
          </div>
          <span class="grammar-list-state" style="color: {srsColor}">{rule.srsState}</span>
          <svg
            class="grammar-list-chevron"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            aria-hidden="true"
            width="14"
            height="14"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 18l6-6-6-6" />
          </svg>
        </button>
      {/each}
    </div>
  {:else}
    <div class="grammar-web-container">
      <SvelteFlow
        {nodes}
        {edges}
        {nodeTypes}
        fitView
        colorMode="system"
        minZoom={0.2}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: 'bezier',
          style: 'stroke-width: 2px;'
        }}
      >
        <Background />
        <Controls />
      </SvelteFlow>
    </div>
  {/if}
</section>

<style>
  h2 {
    font-size: 1.75rem;
    color: var(--text-color, #0f172a);
    margin-bottom: 1.5rem;
    font-weight: 800;
    letter-spacing: -0.025em;
    position: relative;
    display: inline-block;
  }

  .grammar-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .grammar-header-row h2 {
    margin-bottom: 0;
  }

  .grammar-header-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .view-toggle {
    display: flex;
    border: 2px solid #334155;
    border-radius: 0.6rem;
    overflow: hidden;
  }

  .view-toggle-btn {
    background: none;
    border: none;
    padding: 0.35rem 0.6rem;
    cursor: pointer;
    color: #64748b;
    display: flex;
    align-items: center;
    transition:
      background 0.15s,
      color 0.15s;
    line-height: 0;
  }

  .view-toggle-btn:first-child {
    border-right: 1px solid #334155;
  }

  .view-toggle-btn.active {
    background: #334155;
    color: #f1f5f9;
  }

  .view-toggle-btn:hover:not(.active) {
    background: #1e293b;
    color: #94a3b8;
  }

  /* Grammar list view */
  .grammar-list {
    background: #1e293b;
    border: 2px solid #334155;
    border-radius: 1rem;
    overflow: hidden;
  }

  .grammar-list-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.85rem 1rem;
    background: none;
    border: none;
    border-bottom: 1px solid #334155;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
    font-family: inherit;
  }

  .grammar-list-row:last-child {
    border-bottom: none;
  }

  .grammar-list-row:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .grammar-list-row.locked {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .grammar-list-dot {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .grammar-list-info {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .grammar-list-title {
    font-size: 0.9rem;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #e2e8f0;
  }

  .grammar-list-level {
    font-size: 0.65rem;
    font-weight: 800;
    background: #334155;
    color: #94a3b8;
    padding: 0.15rem 0.45rem;
    border-radius: 0.35rem;
    flex-shrink: 0;
  }

  .grammar-list-state {
    font-size: 0.65rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    flex-shrink: 0;
  }

  .grammar-list-chevron {
    flex-shrink: 0;
    color: #475569;
  }

  .sort-control {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }

  .sort-control select {
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    border: 1px solid #cbd5e1;
    background-color: #ffffff;
    font-size: 0.9rem;
    cursor: pointer;
  }

  :global(html[data-theme='dark']) .sort-control select {
    background-color: #1e293b;
    border-color: #475569;
    color: #f1f5f9;
  }

  .grammar-web-container {
    position: relative;
    background: var(--card-bg, #ffffff);
    border-radius: 1rem;
    height: 600px;
    box-shadow:
      0 10px 15px -3px rgba(0, 0, 0, 0.05),
      0 4px 6px -4px rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.05);
    overflow: hidden;
  }

  :global(.svelte-flow__node-grammar) {
    padding: 0;
    border: none;
    background: transparent;
  }

  :global(.svelte-flow__edge-path) {
    stroke: #cbd5e1;
  }

  :global(html[data-theme='dark'] .svelte-flow__edge-path) {
    stroke: #475569;
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    background: #f8fafc;
    border-radius: 1rem;
    border: 2px dashed #cbd5e1;
    color: #64748b;
    font-size: 1.1rem;
    font-weight: 500;
  }

  :global(html[data-theme='dark']) .empty-state {
    background: #1e293b;
    border-color: #475569;
  }

  @media (max-width: 768px) {
    .grammar-header-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }
  }
</style>

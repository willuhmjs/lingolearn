<script lang="ts">
  interface CefrData {
    currentLevel: string;
    nextLevel: string | null;
    percentComplete: number;
    vocabMastery: number;
    grammarMastery: number;
    vocabExposure: number;
    grammarExposure: number;
    averageElo: number;
    targetElo: number;
  }

  interface Props {
    cefrProgress: CefrData;
  }

  let { cefrProgress }: Props = $props();
</script>

<div class="cefr-progress-container">
  <div class="cefr-labels">
    <span class="current-level">{cefrProgress.currentLevel}</span>
    <span class="next-level">{cefrProgress.nextLevel || 'MAX'}</span>
  </div>
  <div class="cefr-bar-track">
    <div class="cefr-bar-fill" style="width: {cefrProgress.percentComplete}%">
      <span class="cefr-percent">{cefrProgress.percentComplete}%</span>
    </div>
  </div>
  <p class="cefr-subtext">Overall Progress to {cefrProgress.nextLevel || 'Mastery'}</p>
</div>

<style>
  .cefr-progress-container {
    max-width: 400px;
    margin: 0 auto 2.5rem;
    padding: 0 1rem;
  }

  .cefr-labels {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.6rem;
    font-weight: 800;
    font-size: 1.25rem;
    color: #ffffff;
    letter-spacing: 0.05em;
  }

  .cefr-bar-track {
    width: 100%;
    height: 2rem;
    background: #1e293b;
    border-radius: 9999px;
    overflow: hidden;
    border: 1px solid #334155;
    position: relative;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
  }

  .cefr-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #d946ef 100%);
    background-size: 600px 100%;
    background-position: left center;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: width 1.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    min-width: 2.5rem;
    box-shadow:
      0 0 12px rgba(139, 92, 246, 0.6),
      0 0 24px rgba(59, 130, 246, 0.3);
  }

  .cefr-percent {
    font-size: 1rem;
    font-weight: 900;
    color: white;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
  }

  .cefr-subtext {
    font-size: 0.75rem;
    color: #94a3b8;
    margin-top: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 700;
  }

  @media (max-width: 600px) {
    .cefr-progress-container {
      max-width: 100%;
      padding: 0;
      margin-bottom: 1.5rem;
    }

    .cefr-labels {
      font-size: 1rem;
    }

    .cefr-bar-track {
      height: 1.5rem;
    }

  }
</style>

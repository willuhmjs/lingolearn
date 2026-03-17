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

  {#if cefrProgress.nextLevel}
    <div class="cefr-detail-bars">
      <div class="detail-bar-row">
        <span class="detail-bar-label">Vocab Mastery</span>
        <div class="detail-bar-track">
          <div
            class="detail-bar-fill vocab"
            style="width: {Math.min(100, Math.round((cefrProgress.vocabMastery * 100) / 0.8))}%"
          ></div>
        </div>
        <span class="detail-bar-value">{Math.round(cefrProgress.vocabMastery * 100)}%</span>
      </div>
      <div class="detail-bar-row">
        <span class="detail-bar-label">Grammar Mastery</span>
        <div class="detail-bar-track">
          <div
            class="detail-bar-fill grammar"
            style="width: {Math.min(100, Math.round((cefrProgress.grammarMastery * 100) / 0.8))}%"
          ></div>
        </div>
        <span class="detail-bar-value">{Math.round(cefrProgress.grammarMastery * 100)}%</span>
      </div>
      <div class="detail-bar-row">
        <span class="detail-bar-label">Content Explored</span>
        <div class="detail-bar-track">
          <div
            class="detail-bar-fill exposure"
            style="width: {Math.min(
              100,
              Math.round(
                (Math.min(cefrProgress.vocabExposure, cefrProgress.grammarExposure) * 100) / 0.6
              )
            )}%"
          ></div>
        </div>
        <span class="detail-bar-value"
          >{Math.round(
            Math.min(cefrProgress.vocabExposure, cefrProgress.grammarExposure) * 100
          )}%</span
        >
      </div>
      <div class="detail-bar-row">
        <span class="detail-bar-label">Avg ELO</span>
        <div class="detail-bar-track">
          <div
            class="detail-bar-fill elo"
            style="width: {Math.min(
              100,
              Math.round((cefrProgress.averageElo / cefrProgress.targetElo) * 100)
            )}%"
          ></div>
        </div>
        <span class="detail-bar-value">{cefrProgress.averageElo} / {cefrProgress.targetElo}</span>
      </div>
    </div>
  {/if}
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
    height: 1.25rem;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 9999px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.2);
    position: relative;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .cefr-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #8b5cf6, #d946ef);
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: width 1.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    min-width: 2.5rem;
    box-shadow: 0 0 10px rgba(139, 92, 246, 0.5);
  }

  .cefr-percent {
    font-size: 0.7rem;
    font-weight: 900;
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  }

  .cefr-subtext {
    font-size: 0.75rem;
    color: #94a3b8;
    margin-top: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 700;
  }

  .cefr-detail-bars {
    margin-top: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .detail-bar-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .detail-bar-label {
    font-size: 0.65rem;
    color: #94a3b8;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    width: 110px;
    text-align: right;
    flex-shrink: 0;
  }

  .detail-bar-track {
    flex: 1;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 9999px;
    overflow: hidden;
  }

  .detail-bar-fill {
    height: 100%;
    border-radius: 9999px;
    transition: width 1s ease;
  }

  .detail-bar-fill.vocab {
    background: #3b82f6;
  }
  .detail-bar-fill.grammar {
    background: #8b5cf6;
  }
  .detail-bar-fill.exposure {
    background: #f59e0b;
  }
  .detail-bar-fill.elo {
    background: #10b981;
  }

  .detail-bar-value {
    font-size: 0.65rem;
    color: #cbd5e1;
    font-weight: 700;
    width: 70px;
    flex-shrink: 0;
  }
</style>

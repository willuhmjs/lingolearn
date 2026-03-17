<script lang="ts">
  let { data } = $props();
  let languages = $derived(data.languages);
  let isSubmitting = $state(false);

  async function handleSubmit(event: Event) {
    event.preventDefault();
    isSubmitting = true;

    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: formData.get('title'),
          description: formData.get('description'),
          language: formData.get('language')
        })
      });

      if (res.ok) {
        const data = await res.json();
        window.location.href = `/play/games/${data.game.id}/edit`;
      } else {
        console.error('Failed to create quiz');
        isSubmitting = false;
      }
    } catch (error) {
      console.error('Error:', error);
      isSubmitting = false;
    }
  }
</script>

<div class="create-container">
  <div class="header-section">
    <a href="/play?tab=games" class="back-nav">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg
      >
      Back to Quizzes
    </a>
    <h1>Create New Quiz</h1>
    <p>Set up the basic details for your new quiz.</p>
  </div>

  <div class="card-duo form-card">
    <form onsubmit={handleSubmit} class="game-form">
      <div class="field">
        <label for="title">Title <span class="required">*</span></label>
        <input
          type="text"
          id="title"
          name="title"
          required
          placeholder="e.g. Basic French Greetings"
          class="form-input"
        />
      </div>

      <div class="field">
        <label for="description">Description</label>
        <textarea
          id="description"
          name="description"
          rows="3"
          placeholder="Optional context or instructions..."
          class="form-input"
        ></textarea>
      </div>

      <div class="field">
        <label for="language">Language <span class="required">*</span></label>
        <select id="language" name="language" required class="form-input">
          <option value="" disabled selected>Select a language...</option>
          {#each languages as lang}
            <option value={lang.name}>{lang.name}</option>
          {/each}
        </select>
      </div>

      <div class="form-actions">
        <button
          type="submit"
          disabled={isSubmitting}
          class="btn-primary submit-btn {isSubmitting ? 'submitting' : ''}"
        >
          {#if isSubmitting}
            <svg class="spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Creating Quiz...
          {:else}
            Create & Continue to Editor
          {/if}
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  .create-container {
    max-width: 48rem; /* 2xl */
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  .header-section {
    margin-bottom: 2rem;
  }

  .header-section h1 {
    font-size: 2rem;
    font-weight: 800;
    color: var(--text-color, #1e293b);
    margin: 0 0 0.5rem;
  }

  .header-section p {
    color: #64748b;
    margin: 0;
  }

  .form-card {
    padding: 2rem;
  }

  .game-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .field label {
    font-size: 0.875rem;
    font-weight: bold;
    color: var(--text-color, #334155);
  }

  .required {
    color: #ef4444;
  }

  .form-input {
    width: 100%;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    border: 2px solid var(--card-border, #cbd5e1);
    background-color: var(--input-bg, #f8fafc);
    color: var(--text-color, #1e293b);
    font-family: inherit;
    font-size: 1rem;
    font-weight: 600;
    transition: all 0.2s;
    box-sizing: border-box;
    outline: none;
  }

  .form-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
  }

  textarea.form-input {
    resize: vertical;
  }

  .form-actions {
    padding-top: 1.5rem;
    border-top: 1px solid var(--card-border, #f1f5f9);
  }

  .submit-btn {
    width: 100%;
    padding: 1rem;
    border-radius: 0.75rem;
    font-weight: bold;
    font-size: 1.125rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    border: none;
    cursor: pointer;
  }

  .submit-btn.submitting {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .spinner {
    width: 1.25rem;
    height: 1.25rem;
    animation: spin 1s linear infinite;
  }

  .opacity-25 {
    opacity: 0.25;
  }
  .opacity-75 {
    opacity: 0.75;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>

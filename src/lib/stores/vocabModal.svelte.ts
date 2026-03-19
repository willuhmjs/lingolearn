let _vocab = $state<any | null>(null);
let _enriching = $state(false);

export const vocabModal = {
  get vocab() {
    return _vocab;
  },
  get enriching() {
    return _enriching;
  },
  async open(vocabId: string, languageId: string, initialData?: any) {
    _vocab = initialData ?? { id: vocabId, lemma: '...' };
    _enriching = true;
    try {
      const res = await fetch('/api/vocabulary/llm-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: initialData?.lemma, languageId, existingId: vocabId })
      });
      if (res.ok) {
        const data = await res.json();
        _vocab = { ..._vocab, ...(data.data ?? data) };
      }
    } catch {
      /* show partial data */
    } finally {
      _enriching = false;
    }
  },
  close() {
    _vocab = null;
    _enriching = false;
  }
};

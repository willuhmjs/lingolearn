import { getLanguageConfig } from '$lib/languages';

class DictionaryService {
  lookupResult = $state<any>(null);
  isLoading = $state(false);
  isOpen = $state(false);
  word = $state('');
  error = $state('');
  x = $state(0);
  y = $state(0);

  // Context for current lookup (optional, for easier use in components)
  contextLanguage = $state<{ id: string; name: string } | null>(null);
  contextDisabled = $state(false);

  private cache = new Map<string, any>();
  private inflight = new Set<string>();

  setContext(language: { id: string; name: string } | null, disabled = false) {
    this.contextLanguage = language;
    this.contextDisabled = disabled;
  }

  private cleanWord(raw: string): string {
    return raw.replace(/^[«»„""[\]().,!?;:'"–—]+|[«»„""[\]().,!?;:'"–—]+$/g, '').trim();
  }

  private isSparseMeta(vocab: any, languageName: string): boolean {
    if (!vocab?.meanings?.length) return true;
    const langConfig = getLanguageConfig(languageName);
    const isNoun = vocab.partOfSpeech === 'noun';
    if (isNoun && langConfig.hasGender && !vocab.gender) return true;
    const meta = vocab?.metadata;
    if (!meta) return true;
    return !(meta.example || meta.declensions || meta.conjugations);
  }

  async lookup(rawWord: string, language: { id: string; name: string }) {
    const word = this.cleanWord(rawWord);
    if (!word || word.length < 2 || /^\d+$/.test(word)) return;

    this.word = word;
    const wordKey = word.toLowerCase();

    if (this.cache.has(wordKey)) {
      this.lookupResult = this.cache.get(wordKey);
      this.isLoading = false;
      this.error = '';
      return;
    }

    if (this.inflight.has(wordKey)) {
      this.isLoading = true;
      this.lookupResult = null;
      this.error = '';
      return;
    }

    this.isLoading = true;
    this.lookupResult = null;
    this.error = '';

    let dbVocab: any = null;
    try {
      const dbRes = await fetch(`/api/vocabulary/search?q=${encodeURIComponent(word)}`);
      if (dbRes.ok) {
        const dbData = await dbRes.json();
        dbVocab =
          dbData.results?.find((r: any) => r.lemma.toLowerCase() === word.toLowerCase()) ?? null;
      }
    } catch {
      /* non-critical */
    }

    if (dbVocab) {
      this.lookupResult = dbVocab;
      if (!this.isSparseMeta(dbVocab, language.name)) {
        this.isLoading = false;
        this.cache.set(wordKey, dbVocab);
        return;
      }
    }

    const enriching = !!dbVocab;
    this.inflight.add(wordKey);
    try {
      const res = await fetch('/api/vocabulary/llm-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word,
          languageId: language.id,
          ...(dbVocab?.id ? { existingId: dbVocab.id } : {})
        })
      });
      const data = await res.json();
      if (data.success && data.data) {
        this.cache.set(wordKey, data.data);
        if (this.word === word) {
          this.lookupResult = data.data;
          this.isLoading = false;
        }
      } else if (!enriching) {
        if (this.word === word) {
          this.lookupResult = null;
          this.isLoading = false;
          this.error = data.error || 'Word not found.';
        }
      }
    } catch {
      if (!enriching && this.word === word) {
        this.lookupResult = null;
        this.isLoading = false;
        this.error = 'Lookup failed.';
      }
    } finally {
      this.inflight.delete(wordKey);
      if (this.word === word && !this.error) {
        this.isLoading = false;
      }
    }
  }

  open(word: string, language: { id: string; name: string }, options?: { x: number; y: number }) {
    if (options) {
      this.x = options.x;
      this.y = options.y;
    }
    this.isOpen = true;
    this.lookup(word, language);
  }

  handleWordClick(
    e: MouseEvent | KeyboardEvent,
    rawWord: string,
    language?: { id: string; name: string } | null,
    disabled?: boolean
  ) {
    const targetLanguage = language || this.contextLanguage;
    const isDisabled = disabled !== undefined ? disabled : this.contextDisabled;

    if (isDisabled || !targetLanguage?.id) return;

    const word = this.cleanWord(rawWord);
    if (!word || word.length < 2 || /^\d+$/.test(word)) return;
    e.stopPropagation();

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    let x = Math.min(rect.left, window.innerWidth - 260);
    x = Math.max(0, x);
    let y = Math.min(rect.bottom + 6, window.innerHeight - 200);
    y = Math.max(0, y);

    this.open(word, targetLanguage, { x, y });
  }

  close() {
    this.isOpen = false;
    this.word = '';
    this.lookupResult = null;
    this.error = '';
  }
}

export const dictionaryService = new DictionaryService();

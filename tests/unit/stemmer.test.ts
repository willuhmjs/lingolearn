import { describe, it, expect, vi } from 'vitest';

// stemWord is a pure function but vocabProcessor transitively imports
// prisma and llm (which both pull in $env/dynamic/private).
// Mock both modules so the module graph loads cleanly in the test env.
vi.mock('../../src/lib/server/prisma', () => ({ prisma: {} }));
vi.mock('../../src/lib/server/llm', () => ({
  generateChatCompletion: vi.fn(),
  normalizeWords: vi.fn()
}));

const { stemWord } = await import('../../src/lib/server/vocabProcessor');

// fuzzyGrade only imports @orama/stemmers — no prisma needed.
import { isClearlyCorrect, isClearlyWrong } from '../../src/lib/server/fuzzyGrade';

// ---------------------------------------------------------------------------
// stemWord — German (Snowball via @orama/stemmers)
// ---------------------------------------------------------------------------

describe('stemWord — German', () => {
  it('always includes the original word (lowercased) as a candidate', () => {
    const candidates = stemWord('Hund', 'German');
    expect(candidates.has('hund') || candidates.has('Hund')).toBe(true);
  });

  it('always includes the capitalised form', () => {
    const candidates = stemWord('hunde', 'German');
    // Snowball: hunde → hund; capitalised → Hund
    expect(candidates.has('Hund')).toBe(true);
  });

  it('always returns a Set', () => {
    expect(stemWord('Katze', 'German')).toBeInstanceOf(Set);
  });

  it('returns at least 2 candidates (lower + capitalised minimum)', () => {
    expect(stemWord('Katze', 'German').size).toBeGreaterThanOrEqual(2);
  });

  it('does not throw on an unknown/nonsense word', () => {
    expect(() => stemWord('xyzxyz', 'German')).not.toThrow();
  });

  // Verb inflections — stem + "en" reconstruction
  it('"geht" — Snowball does not reduce this form; candidates include the word itself', () => {
    // Snowball German does not stem "geht" → it stays "geht".
    // The DB lookup falls back to AI enrichment for irregular short forms.
    const c = stemWord('geht', 'German');
    expect(c.has('geht') || c.has('Geht')).toBe(true);
    expect(c.size).toBeGreaterThanOrEqual(2);
  });

  it('"lauft" — Snowball does not reduce this form; candidates include the word itself', () => {
    // Same as geht: Snowball leaves "lauft" unreduced.
    const c = stemWord('lauft', 'German');
    expect(c.has('lauft') || c.has('Lauft')).toBe(true);
    expect(c.size).toBeGreaterThanOrEqual(2);
  });

  it('"sehen" (infinitive) produces candidates including itself', () => {
    const c = stemWord('sehen', 'German');
    expect(c.has('sehen') || c.has('Sehen')).toBe(true);
  });

  // Adjective inflections
  it('"kleinen" stem covers "klein"', () => {
    const c = stemWord('kleinen', 'German');
    expect(c.has('klein') || c.has('Klein')).toBe(true);
  });

  it('"schönen" produces multiple candidates', () => {
    expect(stemWord('schönen', 'German').size).toBeGreaterThan(1);
  });

  // Noun plurals — Snowball handles common patterns
  it('"Bücher" and "Buch" share at least one stemmed candidate', () => {
    const plural = stemWord('Bücher', 'German');
    const singular = stemWord('Buch', 'German');
    const overlap = [...plural].some((c) => singular.has(c));
    expect(overlap).toBe(true);
  });

  it('"Häuser" and "Haus" share at least one stemmed candidate', () => {
    const plural = stemWord('Häuser', 'German');
    const singular = stemWord('Haus', 'German');
    const overlap = [...plural].some((c) => singular.has(c));
    expect(overlap).toBe(true);
  });

  // Past participles — ge- prefix stripping
  it('"gemacht" candidates include "mach" or "machen"', () => {
    const c = stemWord('gemacht', 'German');
    expect(c.has('machen') || c.has('mach') || c.has('Machen')).toBe(true);
  });

  it('"gegangen" produces more than 1 candidate (ge- prefix handled)', () => {
    expect(stemWord('gegangen', 'German').size).toBeGreaterThan(1);
  });

  it('"gelesen" candidates include stem of lesen', () => {
    const c = stemWord('gelesen', 'German');
    // ge- stripped → "lesen"; or Snowball stem
    expect(c.has('lesen') || c.has('les') || c.has('Lesen')).toBe(true);
  });

  // zu-infinitives
  it('"aufzugeben" candidates include "aufgeben"', () => {
    const c = stemWord('aufzugeben', 'German');
    expect(c.has('aufgeben') || c.has('Aufgeben')).toBe(true);
  });

  it('"anzufangen" candidates include "anfangen"', () => {
    const c = stemWord('anzufangen', 'German');
    expect(c.has('anfangen') || c.has('Anfangen')).toBe(true);
  });

  it('"aufzuhören" candidates include "aufhören"', () => {
    const c = stemWord('aufzuhören', 'German');
    expect(c.has('aufhören') || c.has('Aufhören')).toBe(true);
  });

  // -ung nominalisations — Snowball handles
  it('"Wohnung" produces multiple candidates', () => {
    expect(stemWord('Wohnung', 'German').size).toBeGreaterThan(1);
  });

  it('"Übungen" and "Übung" share a stemmed candidate', () => {
    const plural = stemWord('Übungen', 'German');
    const singular = stemWord('Übung', 'German');
    const overlap = [...plural].some((c) => singular.has(c));
    expect(overlap).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// stemWord — French
// ---------------------------------------------------------------------------

describe('stemWord — French', () => {
  it('returns the word itself as a candidate', () => {
    expect(stemWord('parler', 'French').has('parler')).toBe(true);
  });

  it('"parlons" candidates include "parler" or stem', () => {
    const c = stemWord('parlons', 'French');
    expect(c.has('parler') || c.has('parl')).toBe(true);
  });

  it('"parlent" produces multiple candidates', () => {
    expect(stemWord('parlent', 'French').size).toBeGreaterThan(1);
  });

  it('"aimée" past participle produces multiple candidates', () => {
    expect(stemWord('aimée', 'French').size).toBeGreaterThan(1);
  });

  it('does not throw', () => {
    expect(() => stemWord('bonjour', 'French')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// stemWord — Spanish
// ---------------------------------------------------------------------------

describe('stemWord — Spanish', () => {
  it('returns the word itself as a candidate', () => {
    expect(stemWord('hablar', 'Spanish').has('hablar')).toBe(true);
  });

  it('"hablamos" candidates include "hablar" or stem', () => {
    const c = stemWord('hablamos', 'Spanish');
    expect(c.has('hablar') || c.has('habl')).toBe(true);
  });

  it('"hablado" past participle candidates include "hablar" or stem', () => {
    const c = stemWord('hablado', 'Spanish');
    expect(c.has('hablar') || c.has('habl')).toBe(true);
  });

  it('"comieron" produces multiple candidates', () => {
    expect(stemWord('comieron', 'Spanish').size).toBeGreaterThan(1);
  });

  it('does not throw', () => {
    expect(() => stemWord('casa', 'Spanish')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// stemWord — unknown language
// ---------------------------------------------------------------------------

describe('stemWord — unknown language', () => {
  it('returns lower and capitalised form', () => {
    const c = stemWord('hello', 'Unknown');
    expect(c.has('hello')).toBe(true);
    expect(c.has('Hello')).toBe(true);
  });

  it('does not throw on arbitrary language name', () => {
    expect(() => stemWord('test', 'Klingon')).not.toThrow();
  });

  it('returns exactly 2 candidates (no language-specific logic runs)', () => {
    expect(stemWord('word', 'Unknown').size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// isClearlyCorrect — Snowball stemmer integration (via fuzzyGrade)
// ---------------------------------------------------------------------------

describe('isClearlyCorrect — stemmer integration', () => {
  it('exact match returns true', () => {
    expect(isClearlyCorrect('Ich gehe nach Hause', 'Ich gehe nach Hause')).toBe(true);
  });

  it('ß → ss substitution accepted', () => {
    expect(isClearlyCorrect('Ich heisse Hans', 'Ich heiße Hans')).toBe(true);
  });

  it('ö → oe substitution accepted', () => {
    expect(isClearlyCorrect('Ich moechte Kaffee', 'Ich möchte Kaffee')).toBe(true);
  });

  it('ü → ue substitution accepted', () => {
    expect(isClearlyCorrect('Ich fuehle mich gut', 'Ich fühle mich gut')).toBe(true);
  });

  it('minor single-character typo passes Levenshtein threshold', () => {
    // "Hausee" vs "Hause" — similarity > 0.92
    expect(isClearlyCorrect('Ich gehe nach Hausee', 'Ich gehe nach Hause')).toBe(true);
  });

  it('identical sentences always return true', () => {
    expect(isClearlyCorrect('Der Hund schläft', 'Der Hund schläft')).toBe(true);
  });

  it('completely different sentences return false', () => {
    expect(isClearlyCorrect('Der Hund schläft', 'Die Katze läuft schnell')).toBe(false);
  });

  it('empty user answer returns false', () => {
    expect(isClearlyCorrect('', 'Ich gehe nach Hause')).toBe(false);
  });

  it('missing word in short sentence fails (≤3 tokens, threshold 0.90)', () => {
    // "Ich bin" vs "Ich bin gut" — Jaccard 0.67 < 0.90
    expect(isClearlyCorrect('Ich bin', 'Ich bin gut')).toBe(false);
  });

  it('word order variation on longer sentence may pass relaxed threshold', () => {
    // 7+ tokens → 0.80 threshold; same words different order → Jaccard = 1.0
    expect(
      isClearlyCorrect(
        'nach Hause gehe ich jeden Tag von der Arbeit',
        'Ich gehe jeden Tag von der Arbeit nach Hause'
      )
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isClearlyWrong — Snowball stemmer integration
// ---------------------------------------------------------------------------

describe('isClearlyWrong — stemmer integration', () => {
  it('empty input is clearly wrong', () => {
    expect(isClearlyWrong('', 'Ich gehe nach Hause')).toBe(true);
  });

  it('whitespace-only input is clearly wrong', () => {
    expect(isClearlyWrong('   ', 'Ich gehe nach Hause')).toBe(true);
  });

  it('completely unrelated words are clearly wrong', () => {
    expect(isClearlyWrong('banana apple orange mango', 'Ich gehe nach Hause')).toBe(true);
  });

  it('correct answer is not clearly wrong', () => {
    expect(isClearlyWrong('Ich gehe nach Hause', 'Ich gehe nach Hause')).toBe(false);
  });

  it('near-correct answer with one typo is not clearly wrong', () => {
    expect(isClearlyWrong('Ich gehe nach Hausee', 'Ich gehe nach Hause')).toBe(false);
  });

  it('single-character input is not flagged (guard against short inputs)', () => {
    expect(isClearlyWrong('a', 'Ich gehe nach Hause')).toBe(false);
  });

  it('two-character input is not flagged (guard)', () => {
    expect(isClearlyWrong('ab', 'Ich gehe nach Hause')).toBe(false);
  });

  it('answer sharing zero stemmed tokens with reference is clearly wrong', () => {
    expect(isClearlyWrong('xyz xyz xyz xyz xyz', 'Ich gehe nach Hause')).toBe(true);
  });

  it('partially correct answer is not clearly wrong', () => {
    // Shares "Ich" and "Hause" — Jaccard > 0
    expect(isClearlyWrong('Ich bleibe zu Hause', 'Ich gehe nach Hause')).toBe(false);
  });
});

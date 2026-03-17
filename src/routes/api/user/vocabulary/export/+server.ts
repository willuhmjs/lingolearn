import { prisma } from '$lib/server/prisma';

function escCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export async function GET({ url, locals }: { url: URL; locals: App.Locals }) {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const format = url.searchParams.get('format') ?? 'csv';
  const languageId = locals.user.activeLanguage?.id;

  if (!languageId) {
    return new Response(JSON.stringify({ error: 'No active language' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const userVocabs = await prisma.userVocabulary.findMany({
    where: { userId: locals.user.id, vocabulary: { languageId } },
    include: {
      vocabulary: {
        include: { meanings: { select: { value: true, partOfSpeech: true } } }
      }
    },
    orderBy: { vocabulary: { lemma: 'asc' } }
  });

  if (format === 'json') {
    const items = userVocabs.map((uv) => ({
      word: uv.vocabulary.lemma,
      meanings: uv.vocabulary.meanings.map((m) => ({ value: m.value, pos: m.partOfSpeech })),
      partOfSpeech: uv.vocabulary.partOfSpeech ?? '',
      gender: uv.vocabulary.gender ?? '',
      cefrLevel: uv.vocabulary.cefrLevel,
      srsState: uv.srsState,
      eloRating: Math.round(uv.eloRating)
    }));
    return new Response(JSON.stringify(items), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (format === 'anki') {
    // Anki tab-separated format: front\tback
    const lines = userVocabs.map((uv) => {
      const front = uv.vocabulary.lemma;
      const meanings = uv.vocabulary.meanings.map((m) => m.value).join('; ');
      const pos = uv.vocabulary.partOfSpeech ?? '';
      const back = pos ? `${meanings} (${pos})` : meanings;
      return `${front}\t${back}`;
    });

    return new Response(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="vocabulary-anki.txt"'
      }
    });
  }

  // CSV format
  const header = 'Word,Meanings,Part of Speech,Gender,CEFR Level,SRS State,ELO Rating';
  const rows = userVocabs.map((uv) => {
    const v = uv.vocabulary;
    return [
      escCsv(v.lemma),
      escCsv(v.meanings.map((m) => m.value).join('; ')),
      escCsv(v.partOfSpeech ?? ''),
      escCsv(v.gender ?? ''),
      escCsv(v.cefrLevel),
      escCsv(uv.srsState),
      String(Math.round(uv.eloRating))
    ].join(',');
  });

  const csv = [header, ...rows].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="vocabulary.csv"'
    }
  });
}

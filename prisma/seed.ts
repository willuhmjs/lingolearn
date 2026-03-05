import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

import { verbs as deVerbs } from './german_vocab/verbs';
import { nouns as deNouns } from './german_vocab/nouns';
import { adverbs as deAdverbs } from './german_vocab/adverbs';
import { adjectives as deAdjectives } from './german_vocab/adjectives';
import { conjunctions as deConjunctions } from './german_vocab/conjunctions';
import { prepositions as dePrepositions } from './german_vocab/prepositions';
import { pronouns as dePronouns } from './german_vocab/pronouns';
import { particles as deParticles } from './german_vocab/particles';
import { interjections as deInterjections } from './german_vocab/interjections';
import { articles as deArticles } from './german_vocab/articles';

import { verbs as esVerbs } from './spanish_vocab/verbs';
import { nouns as esNouns } from './spanish_vocab/nouns';
import { adverbs as esAdverbs } from './spanish_vocab/adverbs';
import { adjectives as esAdjectives } from './spanish_vocab/adjectives';
import { conjunctions as esConjunctions } from './spanish_vocab/conjunctions';
import { prepositions as esPrepositions } from './spanish_vocab/prepositions';
import { pronouns as esPronouns } from './spanish_vocab/pronouns';
import { particles as esParticles } from './spanish_vocab/particles';
import { interjections as esInterjections } from './spanish_vocab/interjections';
import { articles as esArticles } from './spanish_vocab/articles';


const germanVocabulary = [
  ...deArticles,
	...deVerbs,
	...deNouns,
	...deAdverbs,
	...deAdjectives,
	...deConjunctions,
	...dePrepositions,
	...dePronouns,
	...deParticles,
	...deInterjections
];

const spanishVocabulary = [
  ...esArticles,
	...esVerbs,
	...esNouns,
	...esAdverbs,
	...esAdjectives,
	...esConjunctions,
	...esPrepositions,
	...esPronouns,
	...esParticles,
	...esInterjections
];

const basicGrammarRules = [
  // ===== A1 Rules =====
  {
    title: 'Personal Pronouns (Nominative)',
    description: 'The use of ich, du, er, sie, es, wir, ihr, sie, Sie as subjects.',
    guide: '# Personal Pronouns (Nominative)\n\nPersonal pronouns replace the subject noun in a sentence and are the foundation for all verb conjugation.\n\n### Forms\n| Pronoun | Meaning |\n|---|---|\n| **ich** | I |\n| **du** | you (informal singular) |\n| **er / sie / es** | he / she / it |\n| **wir** | we |\n| **ihr** | you all (informal plural) |\n| **sie / Sie** | they / you (formal) |\n\n### Examples\n- *Ich bin müde.* (I am tired.)\n- *Er spielt Fußball.* (He plays football.)\n- *Wir lernen Deutsch.* (We are learning German.)\n\n> **Tipp:** Die formelle Anrede **Sie** wird immer großgeschrieben, auch mitten im Satz.',
    level: 'A1',
    dependencies: []
  },
  {
    title: 'Present Tense (Präsens) - Regular Verbs',
    description: 'Conjugation of regular verbs in the present tense.',
    guide: '# Präsens – regelmäßige Verben\n\nDas **Präsens** wird für Gegenwart, nahe Zukunft und allgemeine Aussagen verwendet. Regelmäßige Verben folgen einem Vorhersagbaren Muster.\n\n### Beispiel: **machen** (to do/make)\n| Person | Form |\n|---|---|\n| ich | mach**e** |\n| du | mach**st** |\n| er/sie/es | mach**t** |\n| wir | mach**en** |\n| ihr | mach**t** |\n| sie/Sie | mach**en** |\n\n### Verwendung\n- *Ich mache meine Hausaufgaben.*\n- *Wir machen heute Sport.*\n\n> **Merke:** Die Endungen -e, -st, -t, -en, -t, -en sind die Standard-Präsensendungen.',
    level: 'A1',
    dependencies: ['Personal Pronouns (Nominative)']
  },
  {
    title: 'Present Tense (Präsens) - Irregular Verbs',
    description: 'Irregular present tense patterns for verbs like sein, haben, werden and common stem-changing verbs.',
    guide: '# Präsens – unregelmäßige Verben\n\nEinige der wichtigsten Verben sind im Präsens unregelmäßig und müssen auswendig gelernt werden.\n\n### **sein** (to be)\n- ich **bin**\n- du **bist**\n- er/sie/es **ist**\n- wir **sind**\n- ihr **seid**\n- sie/Sie **sind**\n\n### **haben** (to have)\n- ich **habe**\n- du **hast**\n- er/sie/es **hat**\n- wir **haben**\n- ihr **habt**\n- sie/Sie **haben**\n\n### **werden** (to become / future auxiliary)\n- ich **werde**\n- du **wirst**\n- er/sie/es **wird**\n- wir **werden**\n- ihr **werdet**\n- sie/Sie **werden**\n\nZusätzlich gibt es viele Verben mit Stammvokalwechsel (nehmen → du nimmst, er nimmt; fahren → du fährst, er fährt).\n\n> **Tipp:** Lerne die Konjugation der Verben **sein**, **haben** und **werden** sehr früh – sie werden überall gebraucht.',
    level: 'A1',
    dependencies: ['Personal Pronouns (Nominative)']
  },
  {
    title: 'Noun Gender (Genus)',
    description: 'Every German noun has a grammatical gender.',
    guide: '# Noun Gender (Genus)\n\nJedes deutsche Nomen hat ein **grammatisches Geschlecht**: maskulin, feminin oder neutrum. Das Genus bestimmt den Artikel und viele Endungen.\n\n### Beispiele\n- **der** Mann (maskulin)\n- **die** Frau (feminin)\n- **das** Kind (neutrum)\n\n### Typische Endungen\n- Oft maskulin: -er, -en, -ig (der Computer, der Garten)\n- Oft feminin: -e, -heit, -keit, -ung, -schaft (die Blume, die Gesundheit)\n- Oft neutrum: -chen, -lein, -ment, -um (das Mädchen, das Instrument)\n\n> **Merke:** Das natürliche Geschlecht (biologisch) und das grammatische Geschlecht sind nicht immer gleich (z.B. *das Mädchen*).',
    level: 'A1',
    dependencies: []
  },
  {
    title: 'Definite Articles (Nominative)',
    description: 'The use of der, die, das in the nominative case.',
    guide: '# Bestimmte Artikel im Nominativ\n\nDer **bestimmte Artikel** entspricht dem englischen "the" und richtet sich nach Genus und Numerus des Nomens.\n\n### Tabelle Nominativ\n| Genus | Singular | Plural |\n|---|---|---|\n| maskulin | **der** Mann | **die** Männer |\n| feminin | **die** Frau | **die** Frauen |\n| neutrum | **das** Kind | **die** Kinder |\n\n### Beispiele\n- **Der** Hund schläft.\n- **Die** Katze spielt.\n- **Das** Haus ist groß.',
    level: 'A1',
    dependencies: ['Noun Gender (Genus)']
  },
  {
    title: 'Indefinite Articles (Nominative)',
    description: 'The use of ein, eine, kein in the nominative case.',
    guide: '# Unbestimmte Artikel im Nominativ\n\nDer **unbestimmte Artikel** entspricht englisch meistens "a/an". Im Plural gibt es keinen unbestimmten Artikel – oft wird einfach der Plural ohne Artikel oder **keine** verwendet.\n\n### Formen\n| Genus | Singular | Verneinung |\n|---|---|---|\n| maskulin | **ein** Mann | **kein** Mann |\n| feminin | **eine** Frau | **keine** Frau |\n| neutrum | **ein** Kind | **kein** Kind |\n\n### Beispiele\n- Ich habe **ein** Auto.\n- Sie hat **eine** Frage.\n- Wir haben **keine** Zeit.\n\n> **Merke:** **kein** wird wie **ein** dekliniert, kombiniert aber Artikel und Negation.',
    level: 'A1',
    dependencies: ['Noun Gender (Genus)']
  },
  {
    title: 'Word Order - Main Clause (Hauptsatz)',
    description: 'The verb is always the second element in a standard declarative main clause.',
    guide: '# Wortstellung im Hauptsatz (Verb-zweit)\n\nIm deutschen Aussagesatz steht das **konjugierte Verb immer an zweiter Stelle**. Das erste Satzglied kann Subjekt, Adverbial oder Objekt sein.\n\n### Beispiele\n- **Ich** (1) **gehe** (2) heute ins Kino.\n- **Heute** (1) **gehe** (2) ich ins Kino.\n\n> **Merke:** Zähle Satzglieder, nicht Wörter. Vorfeld (1) – Verb (2) – Rest.',
    level: 'A1',
    dependencies: ['Present Tense (Präsens) - Regular Verbs']
  },
  {
    title: 'Accusative Case (Akkusativ)',
    description: 'Direct objects. Note: only masculine articles change (der -> den, ein -> einen).',
    guide: '# Akkusativ – direktes Objekt\n\nDer **Akkusativ** kennzeichnet meist das direkte Objekt. Im Nominativ und Akkusativ ändern sich vor allem die maskulinen Formen.\n\n### Artikelübersicht (Singular)\n- der → **den**\n- ein → **einen**\n- die → **die**\n- eine → **eine**\n- das → **das**\n- ein → **ein**\n\n### Beispiele\n- Ich sehe **den** Hund.\n- Er kauft **einen** Computer.\n- Wir haben **eine** Frage.\n\n> **Tipp:** Viele Verben fordern zwingend den Akkusativ (sehen, kaufen, finden …).',
    level: 'A1',
    dependencies: ['Definite Articles (Nominative)', 'Indefinite Articles (Nominative)', 'Word Order - Main Clause (Hauptsatz)']
  },
  {
    title: 'Negation with "nicht" and "kein"',
    description: '"Nicht" negates verbs, adjectives, and specific nouns; "kein" negates indefinite nouns (ein → kein). Placement rules differ.',
    guide: '# Verneinung mit **nicht** und **kein**\n\nIm Deutschen wird unterschiedlich verneint:\n- **nicht** negiert Verben, Adjektive oder den ganzen Satz.\n- **kein** negiert ein Nomen mit unbestimmtem Artikel oder ohne Artikel.\n\n### Beispiele mit **nicht**\n- Ich komme **nicht**.\n- Das ist **nicht** interessant.\n\n### Beispiele mit **kein**\n- Ich habe **kein** Auto.\n- Wir haben **keine** Zeit.\n\n> **Merke:** **kein** = *nicht ein*. Es wird wie **ein** dekliniert.',
    level: 'A1',
    dependencies: ['Accusative Case (Akkusativ)']
  },
  {
    title: 'Yes/No Questions (Entscheidungsfragen)',
    description: 'Questions answered with ja/nein are formed by placing the conjugated verb in first position (e.g., Sprichst du Deutsch?).',
    guide: '# Entscheidungsfragen (Ja/Nein-Fragen)\n\nBei **Ja/Nein-Fragen** steht das konjugierte Verb an erster Stelle.\n\n### Struktur\n**Verb + Subjekt + Rest**\n\n### Beispiele\n- **Kommst** du heute?\n- **Hast** du Zeit?\n- **Wohnst** du in Berlin?\n\n> **Tipp:** Die Antwort beginnt meistens mit **ja** oder **nein**.',
    level: 'A1',
    dependencies: ['Word Order - Main Clause (Hauptsatz)']
  },
  {
    title: 'W-Questions (W-Fragen)',
    description: 'Questions starting with a W-word (wer, was, wo, wann, warum, wie, etc.) with the verb in second position.',
    guide: '# W-Fragen\n\n**W-Fragen** beginnen mit einem Fragewort (wer, was, wo, wann, warum, wie, wohin, woher …). Das konjugierte Verb steht an zweiter Stelle.\n\n### Struktur\n**Fragewort + Verb + Subjekt + Rest**\n\n### Beispiele\n- **Wo** wohnst du?\n- **Wann** kommst du?\n- **Warum** lernst du Deutsch?',
    level: 'A1',
    dependencies: ['Yes/No Questions (Entscheidungsfragen)']
  },
  {
    title: 'Possessive Articles (Possessivartikel)',
    description: 'Words showing ownership: mein (my), dein (your), sein (his/its), ihr (her/their), unser (our), euer (your pl.), Ihr (formal your). Declined like "ein".',
    guide: '# Possessivartikel\n\nPossessivartikel zeigen Besitz oder Zugehörigkeit an und werden wie **ein** dekliniert.\n\n### Grundformen\n- **mein(e)** – my\n- **dein(e)** – your (informal)\n- **sein(e)** – his/its\n- **ihr(e)** – her/their\n- **unser(e)** – our\n- **euer/eure** – your (plural, informal)\n- **Ihr(e)** – your (formal)\n\n### Beispiele\n- Das ist **mein** Auto.\n- Wo ist **deine** Tasche?\n- Wir besuchen **unsere** Freunde.',
    level: 'A1',
    dependencies: ['Indefinite Articles (Nominative)', 'Personal Pronouns (Nominative)']
  },
  {
    title: 'Sein, Haben, Werden - Conjugation',
    description: 'Core auxiliary verbs in German and their present tense forms.',
    guide: '# sein, haben, werden – Grundverben\n\nDie Verben **sein**, **haben** und **werden** sind extrem häufige Hilfs- und Vollverben.\n\n### sein\nIch **bin**, du **bist**, er/sie/es **ist**, wir **sind**, ihr **seid**, sie/Sie **sind**.\n\n### haben\nIch **habe**, du **hast**, er/sie/es **hat**, wir **haben**, ihr **habt**, sie/Sie **haben**.\n\n### werden\nIch **werde**, du **wirst**, er/sie/es **wird**, wir **werden**, ihr **werdet**, sie/Sie **werden**.\n\nSie dienen als Hilfsverben für Zeiten (Perfekt, Futur) und das Passiv.',
    level: 'A1',
    dependencies: ['Present Tense (Präsens) - Irregular Verbs']
  },
  {
    title: 'Modal Verbs (Modalverben)',
    description: 'Verbs expressing ability, obligation, permission, etc.: können, müssen, dürfen, sollen, wollen, mögen/möchten. The main verb goes to the end in infinitive form.',
    guide: '# Modalverben\n\nModalverben drücken Fähigkeit, Notwendigkeit, Wunsch oder Erlaubnis aus (können, müssen, dürfen, sollen, wollen, mögen/möchten). Sie stehen konjugiert an zweiter Stelle, das Vollverb im **Infinitiv am Satzende**.\n\n### Beispiele\n- Ich **kann** heute **kommen**.\n- Wir **müssen** viel **lernen**.\n- Sie **möchte** einen Kaffee **trinken**.\n\n> **Merke:** Nur das Modalverb wird konjugiert – das Vollverb bleibt im Infinitiv.',
    level: 'A1',
    dependencies: ['Present Tense (Präsens) - Irregular Verbs', 'Word Order - Main Clause (Hauptsatz)']
  },
  {
    title: 'Separable Verbs (Trennbare Verben)',
    description: 'Verbs with a separable prefix (e.g., anfangen, aufstehen, einkaufen). In main clauses, the prefix moves to the end of the sentence.',
    guide: '# Trennbare Verben\n\nViele Verben haben ein Präfix, das im Hauptsatz **abgetrennt** wird (aufstehen, einkaufen, anrufen …).\n\n### Struktur im Hauptsatz\n- Ich **stehe** um 7 Uhr **auf**.\n- Er **ruft** seine Freundin **an**.\n\nIm Infinitiv und im Partizip II bleibt das Präfix zusammen: **aufstehen**, **aufgestanden**.',
    level: 'A1',
    dependencies: ['Present Tense (Präsens) - Regular Verbs', 'Word Order - Main Clause (Hauptsatz)']
  },
  {
    title: 'Inseparable Verbs (Untrennbare Verben)',
    description: 'Verbs with prefixes that never separate: be-, emp-, ent-, er-, ge-, miss-, ver-, zer- (e.g., verstehen, beginnen, empfehlen).',
    guide: '# Untrennbare Verben\n\nEinige Präfixe werden **nie** abgetrennt: be-, emp-, ent-, er-, ge-, miss-, ver-, zer-.\n\n### Beispiele\n- verstehen, bekommen, beginnen, verkaufen, erklären\n\nIm Perfekt haben diese Verben kein zusätzliches ge-: **verstehen → verstanden**, **bekommen → bekommen**.',
    level: 'A1',
    dependencies: ['Separable Verbs (Trennbare Verben)']
  },
  {
    title: 'Accusative Prepositions',
    description: 'Prepositions that always take the accusative case: durch, für, gegen, ohne, um, bis, entlang.',
    guide: '# Präpositionen mit Akkusativ\n\nDiese Präpositionen verlangen **immer den Akkusativ**: **durch, für, gegen, ohne, um, bis, entlang**.\n\n### Beispiele\n- Das Geschenk ist **für** meinen Bruder.\n- Wir gehen **durch** den Park.\n- Sie fährt **ohne** ihren Mann.',
    level: 'A1',
    dependencies: ['Accusative Case (Akkusativ)']
  },
  {
    title: 'Numbers and Time Expressions',
    description: 'Cardinal numbers, ordinal numbers, telling time (Es ist drei Uhr / halb vier), days of the week, months.',
    guide: '# Zahlen und Zeitangaben\n\n### Kardinalzahlen\n0 null, 1 eins, 2 zwei, 3 drei …\n\n### Uhrzeit\n- **Es ist drei Uhr.**\n- **Es ist halb vier.** (3:30)\n\n### Wochentage & Monate\nMontag, Dienstag, Mittwoch, Donnerstag, Freitag, Samstag/Sonnabend, Sonntag; Januar, Februar …\n\n> **Tipp:** Zeitangaben stehen im Satz oft an Position 1 oder im Mittelfeld: *Heute gehe ich ins Kino.*',
    level: 'A1',
    dependencies: []
  },
  {
    title: 'Imperative (Imperativ)',
    description: 'Giving commands or instructions in du, ihr, and Sie forms (e.g., Komm!, Kommt!, Kommen Sie!).',
    guide: '# Imperativ\n\nDer Imperativ drückt Aufforderungen und Befehle aus. Es gibt Formen für **du**, **ihr** und **Sie**.\n\n### Beispiele\n- (du) **Komm!**\n- (ihr) **Kommt!**\n- (Sie) **Kommen Sie!**\n\n> **Merke:** Bei vielen Verben fällt im du-Imperativ die Endung -st weg: *du kommst → Komm!*',
    level: 'A1',
    dependencies: ['Present Tense (Präsens) - Regular Verbs']
  },
  {
    title: 'Coordinating Conjunctions (Konjunktionen)',
    description: 'Conjunctions that do not change word order: und (and), aber (but), oder (or), denn (because), sondern (but rather).',
    guide: '# Nebenordnende Konjunktionen\n\nKonjunktionen wie **und, aber, oder, denn, sondern** verbinden zwei Hauptsätze oder Satzteile, ohne die Wortstellung zu ändern (Verb bleibt an zweiter Stelle).\n\n### Beispiele\n- Ich gehe ins Kino, **aber** meine Freundin bleibt zu Hause.\n- Er lernt Deutsch **und** sie lernt Spanisch.',
    level: 'A1',
    dependencies: ['Word Order - Main Clause (Hauptsatz)']
  },

  // ===== A2 Rules =====
  {
    title: 'Dative Case (Dativ)',
    description: 'Indirect objects. Articles change: der/das -> dem, die -> der, plural -> den + n.',
    guide: '# Dativ – indirektes Objekt\n\nDer **Dativ** kennzeichnet meist das indirekte Objekt (wem?).\n\n### Artikelübersicht (Singular)\n- der → **dem**\n- die → **der**\n- das → **dem**\n\nIm Plural wird meist ein **-n** angehängt: *den Kindern*.\n\n### Beispiele\n- Ich gebe **dem Mann** das Buch.\n- Sie hilft **der Frau**.\n\n> Fragewort: **wem?**',
    level: 'A2',
    dependencies: ['Accusative Case (Akkusativ)']
  },
  {
    title: 'Dative Prepositions',
    description: 'Prepositions that always take the dative case (aus, außer, bei, mit, nach, seit, von, zu).',
    guide: '# Präpositionen mit Dativ\n\nDiese Präpositionen verlangen **immer den Dativ**: **aus, außer, bei, mit, nach, seit, von, zu**.\n\n### Beispiele\n- Ich fahre **mit** dem Bus.\n- Er wohnt **bei** seinen Eltern.\n- Wir kommen **aus** der Stadt.',
    level: 'A2',
    dependencies: ['Dative Case (Dativ)']
  },
  {
    title: 'Two-Way Prepositions (Wechselpräpositionen)',
    description: 'Prepositions (in, an, auf, über, unter, vor, hinter, neben, zwischen) that take Accusative for movement/direction and Dative for static location.',
    guide: '# Wechselpräpositionen\n\nPräpositionen wie **in, an, auf, über, unter, vor, hinter, neben, zwischen** können Dativ oder Akkusativ verlangen.\n\n- **Akkusativ**: Bewegung / Richtung (wohin?)\n- **Dativ**: Ort / Position (wo?)\n\n### Beispiele\n- Ich gehe **in die** Stadt. (Akk.)\n- Ich bin **in der** Stadt. (Dat.)',
    level: 'A2',
    dependencies: ['Accusative Prepositions', 'Dative Prepositions']
  },
  {
    title: 'Adjective Endings (Adjektivdeklination)',
    description: 'The endings added to adjectives based on the gender, case, and type of article (definite, indefinite, or none).',
    guide: '# Adjektivdeklination\n\nAdjektive bekommen im Deutschen **Endungen**, die von Genus, Kasus, Numerus und Artikeltyp abhängen.\n\n- Nach bestimmtem Artikel: **der schöne Mann**\n- Nach unbestimmtem Artikel: **ein schöner Mann**\n- Ohne Artikel: **schöner Mann**\n\n> **Strategie:** Lerne zuerst häufige Muster (Nominativ/Akkusativ Singular), baue danach weitere Fälle auf.',
    level: 'A2',
    dependencies: ['Dative Case (Dativ)']
  },
  {
    title: 'Comparative and Superlative (Komparativ und Superlativ)',
    description: 'Comparing things: Komparativ adds "-er" (schneller), Superlativ uses "am + -sten" (am schnellsten) or "der/die/das + -ste". Many common adjectives add an umlaut (alt → älter).',
    guide: '# Komparativ und Superlativ\n\n- **Komparativ**: Adjektiv + **-er** (schnell → schneller)\n- **Superlativ**: **am** + Adjektiv + **-sten** oder **der/die/das** + **-ste** (am schnellsten, der schnellste Läufer)\n\nViele Adjektive bekommen einen Umlaut: alt → älter, groß → größer.\n\n### Beispiele\n- Heute ist es **wärmer** als gestern.\n- Das ist **der beste** Film.',
    level: 'A2',
    dependencies: ['Adjective Endings (Adjektivdeklination)']
  },
  {
    title: 'Reflexive Verbs',
    description: 'Verbs that require a reflexive pronoun (mich, dich, sich, uns, euch, sich).',
    guide: '# Reflexive Verben\n\nReflexive Verben benutzen ein Reflexivpronomen (mich, dich, sich, uns, euch, sich).\n\n### Beispiele\n- Ich **wasche mich**.\n- Du **ziehst dich** an.\n- Wir **freuen uns**.',
    level: 'A2',
    dependencies: ['Accusative Case (Akkusativ)']
  },
  {
    title: 'Personal Pronouns in Accusative and Dative',
    description: 'Pronoun forms change by case: ich → mich/mir, du → dich/dir, er → ihn/ihm, sie → sie/ihr, es → es/ihm, etc.',
    guide: '# Personalpronomen im Akkusativ und Dativ\n\n| Nominativ | Akkusativ | Dativ |\n|---|---|---|\n| ich | mich | mir |\n| du | dich | dir |\n| er | ihn | ihm |\n| sie | sie | ihr |\n| es | es | ihm |\n| wir | uns | uns |\n| ihr | euch | euch |\n| sie/Sie | sie/Sie | ihnen/Ihnen |\n\n> **Tipp:** Lerne typische Verben mit Dativ: *helfen, danken, gefallen* usw.',
    level: 'A2',
    dependencies: ['Dative Case (Dativ)', 'Personal Pronouns (Nominative)']
  },
  {
    title: 'Subordinating Conjunctions (Subjunktionen)',
    description: 'Conjunctions that send the verb to the end: weil (dass), wenn, ob, als, obwohl, damit.',
    guide: '# Subjunktionen (unterordnende Konjunktionen)\n\nSubjunktionen wie **weil, dass, wenn, ob, als, obwohl, damit** leiten Nebensätze ein. Im Nebensatz steht das konjugierte Verb **am Ende**.\n\n### Beispiel\n- Ich bleibe zu Hause, **weil** ich krank **bin**.\n- Er sagt, **dass** er morgen **kommt**.',
    level: 'A2',
    dependencies: ['Coordinating Conjunctions (Konjunktionen)']
  },
  {
    title: 'Temporal Prepositions (Temporale Präpositionen)',
    description: 'Prepositions for time expressions: am, im, um, von...bis, seit, vor.',
    guide: '# Temporale Präpositionen\n\nHäufige Präpositionen für Zeitangaben:\n- **am** Montag, **im** Januar, **um** 8 Uhr\n- **von** 9 **bis** 17 Uhr\n- **seit** gestern, **vor** einer Woche\n\n### Beispiele\n- Ich arbeite **von** Montag **bis** Freitag.\n- **Seit** einem Jahr lerne ich Deutsch.',
    level: 'A2',
    dependencies: ['Dative Prepositions', 'Numbers and Time Expressions']
  },
  {
    title: 'Verbs with Dative Objects',
    description: 'Certain verbs that require a dative object instead of accusative: helfen, gefallen, gehören, etc.',
    guide: '# Verben mit Dativobjekt\n\nEinige Verben verlangen ein Dativobjekt statt Akkusativ: **helfen, danken, gefallen, gehören, gratulieren, schmecken** …\n\n### Beispiele\n- Ich **helfe** **dem Mann**.\n- Das Kleid **gefällt** **ihr**.',
    level: 'A2',
    dependencies: ['Dative Case (Dativ)']
  },
  {
    title: 'Word Order with Two Objects',
    description: 'When a sentence has both dative and accusative objects.',
    guide: '# Satzstellung mit Dativ- und Akkusativobjekt\n\nStehen Dativ- und Akkusativobjekt im selben Satz, steht meist der **Dativ vor dem Akkusativ** – besonders bei Pronomen.\n\n### Beispiele\n- Ich gebe **dir** (Dat.) **das Buch** (Akk.).\n- Ich gebe **es** (Akk.) **dem Mann** (Dat.), wenn das Akkusativobjekt ein Pronomen ist.',
    level: 'A2',
    dependencies: ['Verbs with Dative Objects']
  },
  {
    title: 'Adverbs of Frequency and Time',
    description: 'Common time adverbs and their placement: immer, oft, manchmal, selten, nie, schon, noch, gerade, bald.',
    guide: '# Adverbien der Häufigkeit und Zeit\n\nHäufige Adverbien: **immer, oft, manchmal, selten, nie, schon, noch, gerade, bald**.\n\nSie stehen typischerweise im Mittelfeld des Satzes, vor dem Vollverb oder am Satzende.\n\n- Ich gehe **oft** ins Kino.\n- Er ist **nie** pünktlich.',
    level: 'A2',
    dependencies: ['Word Order - Main Clause (Hauptsatz)']
  },
  {
    title: '"es gibt" Construction',
    description: '"Es gibt" + Accusative is used to express existence or availability (There is/are). E.g., Es gibt einen Park hier.',
    guide: '# Konstruktion "es gibt"\n\nMit **es gibt** + Akkusativ drückt man Existenz oder Verfügbarkeit aus (there is/are).\n\n### Beispiele\n- **Es gibt** einen Park hier.\n- **Es gibt** viele gute Restaurants in der Stadt.',
    level: 'A2',
    dependencies: ['Accusative Case (Akkusativ)']
  },

  // ===== B1 Rules =====
  {
    title: 'Perfect Tense (Perfekt)',
    description: 'Used for spoken past tense. Formed with "haben" or "sein" and the past participle.',
    guide: '# Perfekt\n\nDas **Perfekt** ist die wichtigste Vergangenheitszeit in der gesprochenen Sprache. Es besteht aus einem Hilfsverb (**haben/sein**) + Partizip II.\n\n### Beispiele\n- Ich **habe** das Buch **gelesen**.\n- Er **ist** nach Berlin **gefahren**.\n\n> **Merke:** Bewegungsverben und Zustandswechsel nehmen meist **sein**, die meisten anderen Verben **haben**.',
    level: 'A2',
    dependencies: ['Sein, Haben, Werden - Conjugation', 'Separable Verbs (Trennbare Verben)', 'Inseparable Verbs (Untrennbare Verben)']
  },
  {
    title: 'Simple Past (Präteritum)',
    description: 'Used primarily in written past tense for storytelling and formal reports.',
    guide: '# Präteritum (einfache Vergangenheit)\n\nDas **Präteritum** wird vor allem in der Schriftsprache (Berichte, Geschichten) verwendet. Einige Verben (sein, haben, Modalverben) sind auch im Alltag im Präteritum häufig.\n\n### Beispiele\n- Er **war** müde.\n- Wir **hatten** keine Zeit.\n- Sie **konnte** gut schwimmen.',
    level: 'B1',
    dependencies: ['Perfect Tense (Perfekt)']
  },
  {
    title: 'Subordinate Clauses (Nebensätze)',
    description: 'Clauses introduced by conjunctions like "dass", "weil", "wenn", where the conjugated verb moves to the end.',
    guide: '# Nebensätze\n\nNebensätze werden durch Subjunktionen (dass, weil, wenn, ob …) eingeleitet. In Nebensätzen steht das **konjugierte Verb am Ende**.\n\n- Ich glaube, **dass** er heute **kommt**.\n- Wir bleiben zu Hause, **weil** es **regnet**.',
    level: 'B1',
    dependencies: ['Subordinating Conjunctions (Subjunktionen)']
  },
  {
    title: 'Passive Voice (Passiv) - Present',
    description: 'Focuses on the action rather than the doer. Formed with "werden" + past participle.',
    guide: '# Passiv Präsens\n\nIm **Vorgangspassiv** steht die Handlung im Vordergrund, nicht der Handelnde.\n\n### Bildung\n**werden** (konjugiert) + Partizip II\n\n- Das Haus **wird gebaut**.\n- Die Briefe **werden geschrieben**.',
    level: 'B1',
    dependencies: ['Sein, Haben, Werden - Conjugation', 'Perfect Tense (Perfekt)']
  },
  {
    title: 'Relative Clauses (Relativsätze)',
    description: 'Clauses used to provide more info about a noun, using relative pronouns (der, die, das) with the verb at the end.',
    guide: '# Relativsätze\n\nRelativsätze geben zusätzliche Informationen zu einem Nomen. Sie werden mit Relativpronomen (der, die, das, dem, den …) eingeleitet; das Verb steht am Ende.\n\n- Das ist der Mann, **der** neben mir **wohnt**.\n- Ich kenne die Frau, **die** dort **steht**.',
    level: 'B1',
    dependencies: ['Subordinate Clauses (Nebensätze)', 'Personal Pronouns in Accusative and Dative']
  },
  {
    title: 'Genitive Case (Genitiv)',
    description: 'Used to show possession or after certain prepositions (wegen, während). Often replaced by "von + Dativ" in spoken German.',
    guide: '# Genitiv\n\nDer **Genitiv** drückt Besitz aus, wird aber in der gesprochenen Sprache oft durch **von + Dativ** ersetzt.\n\n- das Auto **des** Mannes (= das Auto von dem Mann)\n- das Ende **des** Tages',
    level: 'B1',
    dependencies: ['Dative Case (Dativ)']
  },
  {
    title: 'Future I (Futur I)',
    description: 'Used for intentions and predictions. Formed with "werden" + infinitive.',
    guide: '# Futur I\n\nMit **Futur I** drückt man Zukunft oder Vermutungen aus.\n\n### Bildung\n**werden** (konjugiert) + Infinitiv\n\n- Ich **werde** morgen arbeiten.\n- Er **wird** schon recht haben.',
    level: 'B1',
    dependencies: ['Sein, Haben, Werden - Conjugation']
  },
  {
    title: 'Infinitive Clauses with "zu" (Infinitivsätze)',
    description: 'Clauses using "zu" + infinitive, often after verbs like versuchen, anfangen, aufhören, or with "um...zu" (in order to), "ohne...zu" (without), "anstatt...zu" (instead of).',
    guide: '# Infinitivsätze mit **zu**\n\nNach bestimmten Verben oder Wendungen benutzt man **zu + Infinitiv**. Häufig auch in Konstruktionen wie **um ... zu**, **ohne ... zu**, **anstatt ... zu**.\n\n- Ich versuche, **mehr zu lernen**.\n- Er geht zur Arbeit, **ohne zu frühstücken**.',
    level: 'B1',
    dependencies: ['Subordinate Clauses (Nebensätze)']
  },
  {
    title: 'Indirect Questions (Indirekte Fragen)',
    description: 'Questions embedded in a sentence using "ob" (whether) or a W-word, with the verb at the end: Ich weiß nicht, ob er kommt.',
    guide: '# Indirekte Fragen\n\nIndirekte Fragen werden mit einem Einleitwort (**ob**, W-Wort) und einem Nebensatz mit Verb am Ende gebildet.\n\n- Ich weiß nicht, **ob** er **kommt**.\n- Kannst du mir sagen, **wann** der Zug **ankommt**?',
    level: 'B1',
    dependencies: ['W-Questions (W-Fragen)', 'Subordinate Clauses (Nebensätze)']
  },
  {
    title: 'Conjunctive Adverbs (Konjunktionaladverbien)',
    description: 'Adverbs that connect clauses and cause verb-subject inversion: deshalb, trotzdem, deswegen, außerdem, stattdessen, dennoch.',
    guide: '# Konjunktionaladverbien\n\nWörter wie **deshalb, trotzdem, deswegen, außerdem, dennoch** verbinden Sätze und stehen meist an Position 1, danach folgt Inversion (Verb an zweiter Stelle, Subjekt danach).\n\n- Es regnet, **deshalb** bleibe ich zu Hause.\n- Er war müde, **trotzdem** ging er arbeiten.',
    level: 'B1',
    dependencies: ['Coordinating Conjunctions (Konjunktionen)']
  },
  {
    title: 'Passive Voice - Past Tenses (Passiv Perfekt/Präteritum)',
    description: 'Passive in Perfekt: "sein" + past participle + "worden" (Es ist gebaut worden). Passive in Präteritum: "wurde" + past participle.',
    guide: '# Passiv in der Vergangenheit\n\n- **Perfekt**: sein (Präsens) + Partizip II + **worden** → *Es ist gebaut worden.*\n- **Präteritum**: werden (Präteritum) + Partizip II → *Es wurde gebaut.*',
    level: 'B1',
    dependencies: ['Passive Voice (Passiv) - Present', 'Simple Past (Präteritum)']
  },
  {
    title: 'Verbs with Prepositional Objects (Verben mit Präpositionalobjekt)',
    description: 'Verbs requiring a specific preposition: warten auf, sich freuen über/auf, denken an, sich interessieren für, Angst haben vor, etc.',
    guide: '# Verben mit Präpositionalobjekt\n\nEinige Verben verbinden sich fest mit einer Präposition: **warten auf, denken an, sich freuen über/auf, Angst haben vor** usw.\n\n- Ich **warte auf** den Bus.\n- Sie **denkt an** ihre Freunde.',
    level: 'B1',
    dependencies: ['Accusative Prepositions', 'Dative Prepositions']
  },
  {
    title: 'Da-Compounds (Da-Komposita)',
    description: 'Replacing "preposition + pronoun" for things (not people) with da(r)- + preposition: darauf, damit, darüber, dafür, daran, etc.',
    guide: '# Da-Komposita\n\nStatt "Präposition + es/das" verwendet man häufig **da(r) + Präposition**: **darauf, daran, damit, darüber** …\n\n- Ich warte **darauf**. (= auf das Ergebnis)\n- Er freut sich **darüber**.',
    level: 'B1',
    dependencies: ['Verbs with Prepositional Objects (Verben mit Präpositionalobjekt)']
  },
  {
    title: 'Wo-Compounds (Wo-Komposita)',
    description: 'Question words for prepositional objects referring to things: worauf, womit, worüber, wofür, woran, etc.',
    guide: '# Wo-Komposita\n\nFragen nach Präpositionalobjekten mit Sachen werden mit **wo(r) + Präposition** gebildet: **worauf, womit, woran, wofür** …\n\n- **Worauf** wartest du?\n- **Womit** fängst du an?',
    level: 'B1',
    dependencies: ['Da-Compounds (Da-Komposita)']
  },
  {
    title: 'Konjunktiv II - Common Forms',
    description: 'Basic subjunctive for politeness and wishes: hätte, wäre, könnte, würde + infinitive. "Ich hätte gern..." / "Könnten Sie...?"',
    guide: '# Konjunktiv II – häufige Formen\n\nDer **Konjunktiv II** drückt Wünsche, Irrealität und Höflichkeit aus.\n\n- **hätte, wäre, könnte, müsste, dürfte, wollte, sollte**\n\n### Beispiele\n- Ich **hätte** gern einen Kaffee.\n- **Könnten** Sie mir helfen?',
    level: 'B1',
    dependencies: ['Simple Past (Präteritum)']
  },
  {
    title: '"lassen" (to let / to have something done)',
    description: 'Used with an infinitive to mean "to let/allow" (Lass mich gehen) or "to have something done" (Ich lasse mein Auto reparieren).',
    guide: '# lassen\n\n**lassen** kann bedeuten:\n- zulassen/erlauben: *Lass mich gehen!*\n- veranlassen: *Ich lasse mein Auto reparieren.*\n\nStruktur: **lassen** (konjugiert) + Objekt + Infinitiv.',
    level: 'B1',
    dependencies: ['Modal Verbs (Modalverben)']
  },
  {
    title: 'Genitive Prepositions',
    description: 'Prepositions that take the genitive case: wegen, während, trotz, (an)statt, innerhalb, außerhalb, aufgrund.',
    guide: '# Genitivpräpositionen\n\nDiese Präpositionen verlangen den **Genitiv**: **wegen, während, trotz, (an)statt, innerhalb, außerhalb, aufgrund**.\n\n- **Wegen** des Wetters bleiben wir zu Hause.\n- **Trotz** des Regens gehen wir spazieren.',
    level: 'B1',
    dependencies: ['Genitive Case (Genitiv)']
  },

  // ===== B2 Rules =====
  {
    title: 'Plusquamperfekt (Past Perfect)',
    description: 'Used to describe an action that happened before another past action. Formed with Präteritum of "haben/sein" + past participle.',
    guide: '# Plusquamperfekt\n\nDas **Plusquamperfekt** drückt eine Vorvergangenheit aus – etwas war schon passiert, bevor etwas anderes passierte.\n\n### Bildung\nPräteritum von **haben/sein** + Partizip II\n\n- Ich **hatte gegessen**, bevor ich ging.\n- Er **war angekommen**, als der Unterricht begann.',
    level: 'B2',
    dependencies: ['Simple Past (Präteritum)', 'Perfect Tense (Perfekt)']
  },
  {
    title: 'Konjunktiv II (Subjunctive II) - Present',
    description: 'Used for unreal situations, wishes, and polite requests. Often formed with "würde" + infinitive.',
    guide: '# Konjunktiv II Präsens\n\nDrückt irreale Gegenwart oder Wunsch aus.\n\n- **würde + Infinitiv** (würde machen, würde gehen)\n- eigene Formen bei starken Verben (käme, ginge, sähe …)\n\n*Wenn ich Zeit hätte, würde ich mehr lesen.*',
    level: 'B2',
    dependencies: ['Konjunktiv II - Common Forms']
  },
  {
    title: 'Konjunktiv II (Subjunctive II) - Past',
    description: 'Expresses unreal conditions in the past: "hätte/wäre" + past participle. E.g., Wenn ich das gewusst hätte, wäre ich gekommen.',
    guide: '# Konjunktiv II Vergangenheit\n\nStruktur: **hätte/wäre + Partizip II**\n\n- Wenn ich das **gewusst hätte**, **wäre** ich **gekommen**.\n\nDrückt irreale oder verpasste Möglichkeiten in der Vergangenheit aus.',
    level: 'B2',
    dependencies: ['Konjunktiv II (Subjunctive II) - Present', 'Plusquamperfekt (Past Perfect)']
  },
  {
    title: 'N-Declension (N-Deklination)',
    description: 'Specific masculine nouns that take an "-n" or "-en" ending in all cases except Nominative singular.',
    guide: '# N-Deklination\n\nBestimmte maskuline Nomen bekommen in allen Fällen außer Nominativ Singular ein **-n/-en**: **der Student – des Studenten – dem Studenten – den Studenten**.\n\nAndere Beispiele: der Junge, der Kunde, der Kollege, der Herr.',
    level: 'B2',
    dependencies: ['Accusative Case (Akkusativ)', 'Dative Case (Dativ)']
  },
  {
    title: 'Modal Particles (Modalpartikeln)',
    description: 'Small words (doch, ja, mal, halt, eben, schon, wohl) that convey emotion or emphasis but have no direct translation.',
    guide: '# Modalpartikeln\n\nWörter wie **doch, ja, mal, halt, eben, schon, wohl** färben die Aussage emotional, werden aber kaum übersetzt.\n\n- Komm **doch** mal her!\n- Das ist **ja** interessant.',
    level: 'B2',
    dependencies: ['Adverbs of Frequency and Time']
  },
  {
    title: 'Future II (Futur II)',
    description: 'Expresses a completed action in the future or a past assumption. Formed with "werden" + past participle + "haben/sein". E.g., Er wird das Buch gelesen haben.',
    guide: '# Futur II\n\nMit **Futur II** drückt man Vermutungen über die Vergangenheit oder eine abgeschlossene Handlung in der Zukunft aus.\n\n- Er **wird** das Buch bis morgen **gelesen haben**.',
    level: 'B2',
    dependencies: ['Future I (Futur I)', 'Perfect Tense (Perfekt)']
  },
  {
    title: 'Passive with Modal Verbs',
    description: 'Combining passive voice with modal verbs: modal + past participle + "werden". E.g., Das muss sofort erledigt werden (That must be taken care of immediately).',
    guide: '# Passiv mit Modalverben\n\nStruktur: **Modalverb (konjugiert) + Partizip II + werden (Infinitiv)**\n\n- Das muss **sofort erledigt werden**.\n- Die Aufgabe kann **morgen gemacht werden**.',
    level: 'B2',
    dependencies: ['Passive Voice (Passiv) - Present', 'Modal Verbs (Modalverben)']
  },
  {
    title: 'Subjective Meaning of Modal Verbs',
    description: 'Modal verbs used to express assumptions or probability: Er muss krank sein (He must be sick). Sie soll reich sein (She is said to be rich).',
    guide: '# Modale Bedeutung der Modalverben\n\nModalverben können auch Vermutungen ausdrücken:\n- Er **muss** krank sein. (starke Vermutung)\n- Er **kann** krank sein. (Möglichkeit)\n- Er **soll** reich sein. (man sagt, dass …)',
    level: 'B2',
    dependencies: ['Modal Verbs (Modalverben)']
  },
  {
    title: '"je...desto/umso" Comparisons',
    description: 'Proportional comparison: "Je" + comparative + subordinate clause, "desto/umso" + comparative + main clause. E.g., Je mehr ich lerne, desto besser werde ich.',
    guide: '# je ... desto/umso\n\nMit **je ... desto/umso** drückt man proportionale Vergleiche aus.\n\n- **Je** mehr ich lerne, **desto** besser werde ich.\n- **Je** früher du kommst, **umso** mehr können wir vorbereiten.',
    level: 'B2',
    dependencies: ['Comparative and Superlative (Komparativ und Superlativ)', 'Subordinate Clauses (Nebensätze)']
  },
  {
    title: 'Double Connectors (Doppelkonjunktionen)',
    description: 'Two-part connectors: sowohl...als auch, weder...noch, entweder...oder, nicht nur...sondern auch, zwar...aber.',
    guide: '# Doppelkonjunktionen\n\nHäufige Doppelkonjunktionen:\n- **sowohl ... als auch**\n- **weder ... noch**\n- **entweder ... oder**\n- **nicht nur ... sondern auch**\n- **zwar ... aber**\n\nSie verbinden zwei parallele Satzteile oder Sätze.',
    level: 'B2',
    dependencies: ['Coordinating Conjunctions (Konjunktionen)']
  },
  {
    title: 'Extended Relative Clauses',
    description: 'Relative clauses with "was" (after indefinite pronouns/superlatives), "wo" (for places), and "wer" (whoever).',
    guide: '# Erweiterte Relativsätze\n\nSpezielle Relativpronomen:\n- **was** nach Indefinitpronomen/Superlativen (*alles, was …*; *das Beste, was …*)\n- **wer**, **wo** in bestimmten festen Wendungen.',
    level: 'B2',
    dependencies: ['Relative Clauses (Relativsätze)']
  },
  {
    title: 'Statal Passive (Zustandspassiv)',
    description: 'Describes a state resulting from a completed action, formed with "sein" + past participle: Die Tür ist geöffnet.',
    guide: '# Zustandspassiv\n\nBeschreibt ein Ergebnis/Zustand: **sein + Partizip II**.\n\n- Die Tür **ist geöffnet**. (Sie steht offen.)\n- Das Fenster **ist geschlossen**.',
    level: 'B2',
    dependencies: ['Passive Voice (Passiv) - Present']
  },
  {
    title: 'Verb-Noun Combinations (Nomen-Verb-Verbindungen)',
    description: 'Fixed expressions where a noun and verb form a set phrase: eine Entscheidung treffen, in Betracht ziehen.',
    guide: '# Nomen-Verb-Verbindungen\n\nFeste Kombinationen wie **eine Entscheidung treffen, in Betracht ziehen, zur Verfügung stellen** sind typisch für formelle Sprache.\n\nSie funktionieren oft wie ein simples Verb (entscheiden, betrachten, bereitstellen).',
    level: 'B2',
    dependencies: ['Verbs with Prepositional Objects (Verben mit Präpositionalobjekt)']
  },

  // ===== C1 Rules =====
  {
    title: 'Konjunktiv I (Subjunctive I)',
    description: 'Used primarily in indirect speech (indirekte Rede), especially in journalism and formal writing.',
    guide: '# Konjunktiv I\n\nDer **Konjunktiv I** wird vor allem in der indirekten Rede verwendet, um sich vom zitierten Inhalt zu distanzieren.\n\n- Er sagt, er **habe** keine Zeit.\n- Sie behauptet, sie **sei** krank.',
    level: 'C1',
    dependencies: ['Konjunktiv II (Subjunctive II) - Present']
  },
  {
    title: 'Partizipialattribute (Participial Attributes)',
    description: 'Extended adjective phrases built from present or past participles, placed before the noun.',
    guide: '# Partizipialattribute\n\nPartizipien können wie Adjektive vor dem Nomen stehen und lange Attribute bilden:\n\n- der **in Berlin geborene** Schriftsteller\n- die **am Schalter wartenden** Kunden',
    level: 'C1',
    dependencies: ['Relative Clauses (Relativsätze)', 'Adjective Endings (Adjektivdeklination)']
  },
  {
    title: 'Nominalization (Nominalisierung)',
    description: 'Transforming verbs or adjectives into nouns, often used in scientific or formal language.',
    guide: '# Nominalisierung\n\nVerben und Adjektive werden zu Nomen, oft in formeller Sprache:\n\n- **das Lesen** (von lesen)\n- **die Verbesserung** (von verbessern)\n- **die Schnelligkeit** (von schnell)',
    level: 'C1',
    dependencies: ['Genitive Case (Genitiv)', 'Noun Gender (Genus)']
  },
  {
    title: 'Functional Verb Structures (Funktionsverbgefüge)',
    description: 'Fixed verb-noun combinations where the verb has a reduced meaning.',
    guide: '# Funktionsverbgefüge\n\nKonstruktionen wie **zur Anwendung kommen, in Kraft treten, eine Entscheidung treffen** kombinieren ein relativ inhaltsleeres Verb mit einem Nomen.\n\nSie sind typisch für Amts- und Fachsprache.',
    level: 'C1',
    dependencies: ['Verb-Noun Combinations (Nomen-Verb-Verbindungen)']
  },
  {
    title: 'Complex Sentence Connectors',
    description: 'Advanced connectors for formal writing: indem, sofern, insofern als, es sei denn, geschweige denn.',
    guide: '# Komplexe Satzverknüpfungen\n\nVerbindungen wie **indem, sofern, insofern als, es sei denn, geschweige denn** erlauben präzise logische Beziehungen.\n\n- **Indem** er viel liest, verbessert er sein Deutsch.',
    level: 'C1',
    dependencies: ['Subordinate Clauses (Nebensätze)']
  },
  {
    title: 'Passive Alternatives (Passiversatzformen)',
    description: 'Structures that replace passive: "sich lassen" + infinitive, "sein + zu + Infinitiv", "-bar" adjectives.',
    guide: '# Passiversatzformen\n\nStatt des Passivs benutzt man oft:\n- **sein + zu + Infinitiv** (*Das ist zu vermeiden.*)\n- **sich lassen + Infinitiv** (*Die Tür lässt sich nicht öffnen.*)\n- **-bar/-lich**-Adjektive (*trinkbar, essbar*).',
    level: 'C1',
    dependencies: ['Passive Voice (Passiv) - Present']
  },
  {
    title: 'Subjective Modal Verbs in Past',
    description: 'Modal verbs expressing past assumptions: Er muss krank gewesen sein.',
    guide: '# Subjektive Modalität in der Vergangenheit\n\nKombination von Modalverb + **gewesen/ gehabt** + Partizip II:\n- Er **muss krank gewesen sein**.\n- Sie **kann das gewusst haben**.',
    level: 'C1',
    dependencies: ['Subjective Meaning of Modal Verbs', 'Plusquamperfekt (Past Perfect)']
  },
  {
    title: 'Concessive Clauses and Structures',
    description: 'Expressing concession beyond "obwohl": wenn...auch, so...auch, wie...auch immer.',
    guide: '# Konzessive Strukturen\n\nNeben **obwohl** gibt es Wendungen wie **wenn auch, so ... auch, wie ... auch immer**, um Zugeständnisse auszudrücken.\n\n- **Wenn auch** das Wetter schlecht ist, gehen wir spazieren.',
    level: 'C1',
    dependencies: ['Subordinate Clauses (Nebensätze)']
  },
  {
    title: 'Appositional Constructions (Appositionen)',
    description: 'Parenthetical explanations inserted into sentences. The apposition matches the case of the noun it modifies.',
    guide: '# Appositionen\n\nEine **Apposition** ist eine Beifügung zu einem Nomen und steht im gleichen Kasus:\n\n- Frau Müller, **unsere Nachbarin**, kommt mit.\n- Berlin, **die Hauptstadt Deutschlands**, ist groß.',
    level: 'C1',
    dependencies: ['Relative Clauses (Relativsätze)']
  },
  {
    title: 'Expanded Prepositional Phrases',
    description: 'Complex prepositional expressions used in formal/academic language.',
    guide: '# Erweiterte Präpositionalphrasen\n\nIn der Schriftsprache treten komplexe Präpositionen auf: **im Hinblick auf, in Bezug auf, mit Hilfe von, im Rahmen von** usw.\n\nSie strukturieren Texte und Argumentationen.',
    level: 'C1',
    dependencies: ['Genitive Prepositions', 'Dative Prepositions']
  },

  // ===== C2 Rules =====
  {
    title: 'Konjunktiv I - Past (Vergangenheit)',
    description: 'Past forms of Konjunktiv I for indirect speech: Er sagte, er habe das Buch gelesen.',
    guide: '# Konjunktiv I Vergangenheit\n\nIndirekte Rede in der Vergangenheit wird oft mit **Konjunktiv I** von *haben/sein* + Partizip II gebildet:\n\n- Er sagte, er **habe das Buch gelesen**.',
    level: 'C2',
    dependencies: ['Konjunktiv I (Subjunctive I)']
  },
  {
    title: 'Archaic and Literary Konjunktiv II Forms',
    description: 'Using original Konjunktiv II forms instead of "würde" + infinitive in literary contexts.',
    guide: '# Literarischer Konjunktiv II\n\nIn literarischer Sprache erscheinen ursprüngliche Konjunktivformen statt "würde + Infinitiv":\n\n- ich **führe**, ich **spräche**, ich **ginge** …',
    level: 'C2',
    dependencies: ['Konjunktiv II (Subjunctive II) - Present']
  },
  {
    title: 'Complex Participial Constructions',
    description: 'Heavily nested participial attributes common in academic/legal writing.',
    guide: '# Komplexe Partizipialkonstruktionen\n\nVor allem in juristischen und wissenschaftlichen Texten werden sehr lange Partizipialattribute verwendet, um Informationen zu verdichten.',
    level: 'C2',
    dependencies: ['Partizipialattribute (Participial Attributes)']
  },
  {
    title: 'Rhetorical and Stylistic Devices',
    description: 'Advanced rhetorical structures: inversion for emphasis, deliberate word-order variation.',
    guide: '# Rhetorische und stilistische Mittel\n\nUm Stil und Wirkung zu verändern, nutzt man Inversion, Parallelismen, Wiederholungen und andere Mittel. Auf C2-Niveau werden solche Effekte bewusst eingesetzt.',
    level: 'C2',
    dependencies: ['Complex Sentence Connectors']
  },
  {
    title: 'Register and Style Variation',
    description: 'Mastering transitions between registers: colloquial, standard, formal/written, and academic.',
    guide: '# Register- und Stilvariation\n\nAuf C2-Niveau kann man flexibel zwischen Umgangssprache, Standardsprache, formeller und wissenschaftlicher Sprache wechseln und den Stil bewusst an Situation und Zielgruppe anpassen.',
    level: 'C2',
    dependencies: ['Rhetorical and Stylistic Devices']
  },
  {
    title: 'Idiomatic Expressions (Redewendungen)',
    description: 'Fixed idiomatic phrases whose meaning cannot be derived from individual words.',
    guide: '# Idiomatische Ausdrücke (Redewendungen)\n\nFeste Wendungen wie **ins Bett gehen, auf dem Holzweg sein, jemandem die Daumen drücken** haben eine übertragene Bedeutung, die sich nicht wörtlich ergibt. Sie sind typisch für ein sehr hohes Sprachniveau.',
    level: 'C2',
    dependencies: []
  }
];

const spanishGrammarRules = [
  // ===== A1 Rules =====
  {
    title: 'Subject Pronouns (Pronombres Personales)',
    description: 'The use of yo, tú, él, ella, usted, nosotros, vosotros, ellos, ellas, ustedes.',
    guide: '# Subject Pronouns\n\nSubject pronouns replace the subject noun in a sentence. In Spanish, they are often omitted because the verb ending already indicates the subject.\n\n### Forms:\n*   **yo** (I)\n*   **tú** (you, informal singular)\n*   **él/ella/usted** (he/she/you formal singular)\n*   **nosotros/nosotras** (we)\n*   **vosotros/vosotras** (you all, informal plural - used mostly in Spain)\n*   **ellos/ellas/ustedes** (they/you all formal plural)\n\n### Examples:\n*   *(Yo) hablo español.* (I speak Spanish.)\n*   *¿(Tú) eres de México?* (Are you from Mexico?)',
    level: 'A1',
    dependencies: []
  },
  {
    title: 'Noun Gender and Plurals',
    description: 'Understanding masculine/feminine nouns and how to form plurals.',
    guide: '# Noun Gender and Plurals\n\n### Gender\nAll Spanish nouns have a grammatical gender: **masculine** or **feminine**.\n*   Generally, nouns ending in **-o** are masculine (el chico, el libro).\n*   Generally, nouns ending in **-a** are feminine (la chica, la mesa).\n*   Exceptions exist (el mapa, la mano, el problema).\n\n### Plurals\n*   If a noun ends in a vowel, add **-s** (chico → chicos).\n*   If a noun ends in a consonant, add **-es** (papel → papeles).\n*   If a noun ends in **-z**, change to **-c** and add **-es** (lápiz → lápices).',
    level: 'A1',
    dependencies: []
  },
  {
    title: 'Definite and Indefinite Articles',
    description: 'The use of el, la, los, las, un, una, unos, unas.',
    guide: '# Articles\n\nArticles agree in gender and number with the noun they modify.\n\n### Definite Articles (The)\n*   Masculine singular: **el**\n*   Feminine singular: **la**\n*   Masculine plural: **los**\n*   Feminine plural: **las**\n\n### Indefinite Articles (A/An/Some)\n*   Masculine singular: **un**\n*   Feminine singular: **una**\n*   Masculine plural: **unos**\n*   Feminine plural: **unas**\n\n### Examples:\n*   *el gato* (the cat)\n*   *una casa* (a house)',
    level: 'A1',
    dependencies: ['Noun Gender and Plurals']
  },
  {
    title: 'Present Tense Regular Verbs (-ar, -er, -ir)',
    description: 'Conjugating regular verbs in the present tense.',
    guide: '# Present Tense Regular Verbs\n\nSpanish verbs belong to three categories based on their infinitive endings: **-ar**, **-er**, and **-ir**.\n\n### -AR verbs (e.g., hablar)\n*   yo habl**o**\n*   tú habl**as**\n*   él/ella/usted habl**a**\n*   nosotros habl**amos**\n*   vosotros habl**áis**\n*   ellos/ellas/ustedes habl**an**\n\n### -ER verbs (e.g., comer)\n*   yo com**o**\n*   tú com**es**\n*   él/ella/usted com**e**\n*   nosotros com**emos**\n*   vosotros com**éis**\n*   ellos/ellas/ustedes com**en**\n\n### -IR verbs (e.g., vivir)\n*   yo viv**o**\n*   tú viv**es**\n*   él/ella/usted viv**e**\n*   nosotros viv**imos**\n*   vosotros viv**ís**\n*   ellos/ellas/ustedes viv**en**',
    level: 'A1',
    dependencies: ['Subject Pronouns (Pronombres Personales)']
  },
  {
    title: 'Ser vs Estar',
    description: 'The two verbs for "to be" in Spanish.',
    guide: '# Ser vs Estar\n\nIn Spanish, there are two common verbs for "to be": **ser** and **estar**. They are both irregular in the present tense.\n\n### Ser (Permanent or Lasting)\n*   **Forms:** soy, eres, es, somos, sois, son\n*   **Uses (DOCTOR):** Description, Occupation, Characteristic, Time, Origin, Relationship.\n*   *Ejemplo:* Soy de España. (I am from Spain.)\n\n### Estar (Temporary or Location)\n*   **Forms:** estoy, estás, está, estamos, estáis, están\n*   **Uses (PLACE):** Position, Location, Action (present continuous), Condition, Emotion.\n*   *Ejemplo:* Estoy feliz hoy. (I am happy today.)',
    level: 'A1',
    dependencies: ['Subject Pronouns (Pronombres Personales)']
  },
  {
    title: 'Adjective Agreement',
    description: 'Making adjectives match the nouns they describe in gender and number.',
    guide: '# Adjective Agreement\n\nAdjectives must agree in **gender** (masculine/feminine) and **number** (singular/plural) with the noun they modify.\n\n*   Adjectives ending in **-o** have four forms: alto, alta, altos, altas.\n*   Adjectives ending in **-e** or a **consonant** usually have only two forms (singular/plural): inteligente, inteligentes; fácil, fáciles.\n*   Adjectives usually go **after** the noun.\n\n### Examples:\n*   el chico **alto** (the tall boy)\n*   las casas **blancas** (the white houses)',
    level: 'A1',
    dependencies: ['Noun Gender and Plurals']
  },
  {
    title: 'Tener and Idioms with Tener',
    description: 'Conjugating the irregular verb "tener" and its special expressions.',
    guide: '# Tener (To Have)\n\nThe verb **tener** is irregular and very common. It is used to express possession, age, and various physical/emotional states.\n\n### Conjugation (Present):\n*   tengo, tienes, tiene, tenemos, tenéis, tienen\n\n### Idiomatic Expressions:\nIn English, we often use "to be" for these, but Spanish uses "tener" (to have):\n*   **tener años:** to be... years old (Tengo 20 años.)\n*   **tener hambre/sed:** to be hungry/thirsty\n*   **tener frío/calor:** to be cold/hot\n*   **tener miedo:** to be afraid\n*   **tener sueño:** to be sleepy',
    level: 'A1',
    dependencies: ['Subject Pronouns (Pronombres Personales)']
  },
  {
    title: 'Ir and the Near Future (Ir + a + Infinitive)',
    description: 'The verb "ir" (to go) and expressing future plans.',
    guide: '# Ir (To Go) & Near Future\n\nThe verb **ir** is highly irregular.\n\n### Conjugation (Present):\n*   voy, vas, va, vamos, vais, van\n\n### Near Future (Ir + a + Infinitive)\nTo express something you are going to do in the future, use the formula:\n**[conjugated form of ir] + a + [infinitive verb]**\n\n### Examples:\n*   Voy al cine. (I am going to the movies.)\n*   **Voy a estudiar** mañana. (I am going to study tomorrow.)\n*   ¿Qué **vas a hacer**? (What are you going to do?)',
    level: 'A1',
    dependencies: ['Present Tense Regular Verbs (-ar, -er, -ir)']
  },
  {
    title: 'Possessive Adjectives',
    description: 'Words showing ownership: mi, tu, su, nuestro, vuestro, su.',
    guide: '# Possessive Adjectives\n\nPossessive adjectives show ownership. They agree in number (and sometimes gender) with the **noun being possessed**, not the owner.\n\n*   **mi / mis** (my)\n*   **tu / tus** (your, informal)\n*   **su / sus** (his, her, your formal, their)\n*   **nuestro/a / nuestros/as** (our) - agrees in gender too!\n*   **vuestro/a / vuestros/as** (your all, informal) - agrees in gender too!\n\n### Examples:\n*   **Mi** libro (My book)\n*   **Mis** libros (My books)\n*   **Nuestra** casa (Our house)',
    level: 'A1',
    dependencies: ['Noun Gender and Plurals']
  },
  {
    title: 'Stem-Changing Verbs in the Present Tense',
    description: 'Verbs that have a vowel change in the stem (e→ie, o→ue, e→i).',
    guide: '# Stem-Changing Verbs\n\nSome verbs change a vowel in their stem in the present tense for all forms **except** nosotros and vosotros (often called "boot verbs").\n\n### 1. e → ie\n*   **Pensar** (to think): pienso, piensas, piensa, pensamos, pensáis, piensan\n*   *Other examples:* querer, cerrar, empezar, entender.\n\n### 2. o → ue\n*   **Poder** (to be able to): puedo, puedes, puede, podemos, podéis, pueden\n*   *Other examples:* dormir, volver, encontrar, jugar (u→ue).\n\n### 3. e → i\n*   **Pedir** (to ask for): pido, pides, pide, pedimos, pedís, piden\n*   *Other examples:* servir, repetir.',
    level: 'A2',
    dependencies: ['Present Tense Regular Verbs (-ar, -er, -ir)']
  },
  {
    title: 'Reflexive Verbs',
    description: 'Verbs where the subject performs the action on itself (lavarse, levantarse).',
    guide: '# Reflexive Verbs\n\nReflexive verbs indicate that the subject does something to or for itself. They require reflexive pronouns.\n\n### Reflexive Pronouns:\n*   **me** (myself)\n*   **te** (yourself)\n*   **se** (himself, herself, yourself formal)\n*   **nos** (ourselves)\n*   **os** (yourselves)\n*   **se** (themselves, yourselves formal)\n\n### Conjugation (e.g., Lavarse - to wash oneself):\n*   yo **me** lavo\n*   tú **te** lavas\n*   él/ella/usted **se** lava\n*   nosotros **nos** lavamos\n*   vosotros **os** laváis\n*   ellos/ellas/ustedes **se** lavan\n\n*Note:* The pronoun goes before the conjugated verb.',
    level: 'A2',
    dependencies: ['Present Tense Regular Verbs (-ar, -er, -ir)']
  },
  {
    title: 'Gustar and Similar Verbs',
    description: 'How to express likes and dislikes using "gustar".',
    guide: '# Gustar (To Like)\n\nThe verb **gustar** works differently than "to like" in English. It literally means "to be pleasing to".\n\nIt requires an Indirect Object Pronoun (me, te, le, nos, os, les).\n\n### Forms\n*   Use **gusta** for singular nouns or verbs (infinitives).\n*   Use **gustan** for plural nouns.\n\n### Examples:\n*   **Me gusta** la manzana. (The apple is pleasing to me / I like the apple.)\n*   **Te gustan** los libros. (The books are pleasing to you / You like the books.)\n*   **Nos gusta** cantar. (Singing is pleasing to us / We like to sing.)\n\n*Similar verbs:* encantar, importar, faltar.',
    level: 'A2',
    dependencies: ['Definite and Indefinite Articles']
  },
  {
    title: 'Direct Object Pronouns (DOPs)',
    description: 'Replacing the direct object in a sentence (lo, la, los, las).',
    guide: '# Direct Object Pronouns\n\nA direct object receives the action of the verb directly. A Direct Object Pronoun (DOP) replaces it to avoid repetition.\n\n### Pronouns:\n*   **me** (me), **te** (you), **lo/la** (him, her, it, you formal), **nos** (us), **os** (you all), **los/las** (them, you all formal).\n\n### Placement:\n*   Before the conjugated verb.\n*   Attached to the end of an infinitive or present participle.\n\n### Examples:\n*   Compro *el libro*. → **Lo** compro. (I buy it.)\n*   Veo a *María*. → **La** veo. (I see her.)\n*   Quiero comer*lo*. (I want to eat it.)',
    level: 'A2',
    dependencies: ['Present Tense Regular Verbs (-ar, -er, -ir)']
  },
  {
    title: 'Indirect Object Pronouns (IOPs)',
    description: 'Indicating to whom or for whom an action is done (le, les).',
    guide: '# Indirect Object Pronouns\n\nAn indirect object answers "to whom" or "for whom" the action is performed.\n\n### Pronouns:\n*   **me** (to/for me), **te** (to/for you), **le** (to/for him, her, it, you formal), **nos** (to/for us), **os** (to/for you all), **les** (to/for them, you all formal).\n\n### Examples:\n*   Yo **le** doy el regalo. (I give the gift to him/her.)\n*   Ella **nos** habla. (She speaks to us.)\n\n### Double Pronouns:\nWhen using both an IOP and DOP, the IOP goes first. If both start with \'l\' (e.g., le lo), the IOP changes to **se**.\n*   *Le doy el libro* → **Se lo** doy. (I give it to him.)',
    level: 'A2',
    dependencies: ['Direct Object Pronouns (DOPs)']
  },
  {
    title: 'Saber vs Conocer',
    description: 'The two verbs for "to know".',
    guide: '# Saber vs Conocer\n\nSpanish has two verbs for "to know", each with distinct uses.\n\n### Saber\nTo know facts, information, or how to do something.\n*   Forms: sé, sabes, sabe, sabemos, sabéis, saben\n*   *Sé que Madrid es la capital.* (I know Madrid is the capital.)\n*   *Ella sabe nadar.* (She knows how to swim.)\n\n### Conocer\nTo know or be familiar with people, places, or things.\n*   Forms: conozco, conoces, conoce, conocemos, conocéis, conocen\n*   *Conozco a Juan.* (I know Juan.)\n*   *No conozco París.* (I don\'t know/am not familiar with Paris.)',
    level: 'A2',
    dependencies: ['Present Tense Regular Verbs (-ar, -er, -ir)']
  },
  {
    title: 'Preterite Tense - Regular Verbs',
    description: 'Conjugating regular verbs in the past tense (completed actions).',
    guide: '# Preterite Tense (Regular)\n\nThe preterite tense is used for completed actions in the past with a definite beginning and end.\n\n### -AR Verbs (e.g., hablar)\n*   yo habl**é**\n*   tú habl**aste**\n*   él/ella/Ud. habl**ó**\n*   nosotros habl**amos**\n*   vosotros habl**asteis**\n*   ellos/ellas/Uds. habl**aron**\n\n### -ER / -IR Verbs (e.g., comer, vivir)\n*   yo com**í** / viv**í**\n*   tú com**iste** / viv**iste**\n*   él/ella/Ud. com**ió** / viv**ió**\n*   nosotros com**imos** / viv**imos**\n*   vosotros com**isteis** / viv**isteis**\n*   ellos/ellas/Uds. com**ieron** / viv**ieron**',
    level: 'A2',
    dependencies: ['Present Tense Regular Verbs (-ar, -er, -ir)']
  },
  {
    title: 'Preterite Tense - Irregular Verbs',
    description: 'Common irregular verbs in the preterite (ir, ser, hacer, tener, estar).',
    guide: '# Preterite Tense (Irregular)\n\nMany common verbs are highly irregular in the preterite. They often share a set of irregular endings: -e, -iste, -o, -imos, -isteis, -ieron (no accents!).\n\n### Ser / Ir (Identical forms)\n*   fui, fuiste, fue, fuimos, fuisteis, fueron\n\n### Hacer (Stem: hic- / hiz-)\n*   hice, hiciste, hizo, hicimos, hicisteis, hicieron\n\n### Tener (Stem: tuv-)\n*   tuve, tuviste, tuvo, tuvimos, tuvisteis, tuvieron\n\n### Estar (Stem: estuv-)\n*   estuve, estuviste, estuvo, estuvimos, estuvisteis, estuvieron',
    level: 'A2',
    dependencies: ['Preterite Tense - Regular Verbs']
  },
  {
    title: 'Imperfect Tense',
    description: 'The past tense used for ongoing actions, habits, and background descriptions.',
    guide: '# Imperfect Tense\n\nThe imperfect describes past habits, ongoing past actions (was/were doing), time, age, and background descriptions.\n\n### Regular -AR verbs (e.g., hablar)\n*   hablaba, hablabas, hablaba, hablábamos, hablabais, hablaban\n\n### Regular -ER/-IR verbs (e.g., comer)\n*   comía, comías, comía, comíamos, comíais, comían\n\n### Irregular Verbs (Only 3!)\n*   **Ser:** era, eras, era, éramos, erais, eran\n*   **Ir:** iba, ibas, iba, íbamos, ibais, iban\n*   **Ver:** veía, veías, veía, veíamos, veíais, veían',
    level: 'B1',
    dependencies: ['Preterite Tense - Regular Verbs']
  },
  {
    title: 'Preterite vs Imperfect',
    description: 'Choosing between the two past tenses.',
    guide: '# Preterite vs Imperfect\n\nChoosing the correct past tense depends on the context.\n\n### Use Preterite for (SAFE):\n*   **S**pecific events or completed actions.\n*   **A**ction that interrupts an ongoing action.\n*   **F**ocus on beginning or end of an action.\n*   **E**nclosed amount of time.\n*   *Ayer fui a la tienda.* (Yesterday I went to the store.)\n\n### Use Imperfect for (WATERS):\n*   **W**eather.\n*   **A**ge.\n*   **T**ime.\n*   **E**motion/Condition.\n*   **R**epetition (Habits / "used to").\n*   **S**etting the scene / ongoing actions.\n*   *Hacía sol y yo estaba feliz.* (It was sunny and I was happy.)',
    level: 'B1',
    dependencies: ['Preterite Tense - Regular Verbs', 'Imperfect Tense']
  },
  {
    title: 'Por vs Para',
    description: 'The two prepositions translating to "for", "by", or "through".',
    guide: '# Por vs Para\n\nBoth mean "for," but they are not interchangeable.\n\n### Use PARA for (PERFECT):\n*   **P**urpose (in order to + infinitive)\n*   **E**xact date/deadline\n*   **R**ecipient (for someone)\n*   **F**uture destination\n*   **E**mployment\n*   **C**omparison\n*   **T**oward a specific place\n\n### Use POR for (ATTRACTED):\n*   **A**round a place\n*   **T**hrough a place\n*   **T**ransportation / communication (by bus, by phone)\n*   **R**eason or motive (because of)\n*   **A**fter / going to get something\n*   **C**ost / Exchange\n*   **T**hanks (Gracias por...)\n*   **E**xchange\n*   **D**uration of time',
    level: 'B1',
    dependencies: []
  },
  {
    title: 'Formal Commands (Usted/Ustedes)',
    description: 'Giving orders or advice politely.',
    guide: '# Formal Commands (Usted/Ustedes)\n\nUsed to tell someone formally (usted/ustedes) to do or not do something.\n\n### Formation (Present Subjunctive forms):\n1.  Start with the "yo" form of the present tense (e.g., hablo, como).\n2.  Drop the -o.\n3.  Add the "opposite" ending:\n    *   **-AR verbs add **-e** (Ud.) or **-en** (Uds.).\n    *   **-ER/-IR verbs add **-a** (Ud.) or **-an** (Uds.).\n\n### Examples:\n*   Hablar → **Hable** Ud. / **Hablen** Uds.\n*   Comer → **Coma** Ud. / **Coman** Uds.\n*   Tener (tengo) → **Tenga** Ud. / **Tengan** Uds.\n\n*Negative commands:* Simply put "No" in front. (No hable Ud.)',
    level: 'B1',
    dependencies: ['Present Tense Regular Verbs (-ar, -er, -ir)']
  },
  {
    title: 'Informal Commands (Tú)',
    description: 'Giving orders to friends or peers.',
    guide: '# Informal Commands (Tú)\n\nUsed to tell a friend (tú) to do or not do something.\n\n### Affirmative Tú Commands:\nUse the **él/ella/usted** form of the present tense.\n*   Hablar → ¡**Habla**! (Speak!)\n*   Comer → ¡**Come**! (Eat!)\n*   *Irregular:* Ven, di, sal, haz, ten, ve, pon, sé.\n\n### Negative Tú Commands:\nUse the "tú" form of the Present Subjunctive (opposite endings).\n1. Yo form, drop -o.\n2. Add opposite ending + s: -AR adds **-es**, -ER/-IR adds **-as**.\n*   Hablar → ¡No **hables**! (Don\'t speak!)\n*   Comer → ¡No **comas**! (Don\'t eat!)',
    level: 'B1',
    dependencies: ['Present Tense Regular Verbs (-ar, -er, -ir)']
  },
  {
    title: 'Present Subjunctive Mood',
    description: 'Expressing doubt, desire, emotion, and recommendations.',
    guide: '# Present Subjunctive\n\nThe subjunctive is a mood used for subjectivity, doubt, wishes, and emotions. Often triggered by "WEIRDO" verbs (Wishes, Emotions, Impersonal expressions, Recommendations, Doubt, Ojalá) + "que".\n\n### Formation:\n1. Start with the "yo" form of the present indicative.\n2. Drop the -o.\n3. Add opposite endings:\n   *   **-AR:** -e, -es, -e, -emos, -éis, -en\n   *   **-ER/-IR:** -a, -as, -a, -amos, -áis, -an\n\n### Examples:\n*   (Hablar) Espero que tú **hables** español. (I hope that you speak Spanish.)\n*   (Comer) Quiero que ella **coma**. (I want her to eat.)',
    level: 'B1',
    dependencies: ['Present Tense Regular Verbs (-ar, -er, -ir)']
  },
  {
    title: 'Future Tense',
    description: 'Conjugating verbs to express what "will" happen.',
    guide: '# Future Tense\n\nThe future tense is used to express what *will* happen. It is easier to form than other tenses because you keep the infinitive and add endings.\n\n### Regular Endings (Added to the INFINITIVE for all verbs):\n*   -é, -ás, -á, -emos, -éis, -án\n\n### Examples:\n*   **Hablar:** hablaré, hablarás, hablará...\n*   **Comer:** comeré, comerás, comerá...\n\n### Irregular Stems:\nSome verbs have irregular stems but use the same endings:\n*   Tener → **tendr-** (tendré)\n*   Hacer → **har-** (haré)\n*   Poder → **podr-** (podré)',
    level: 'B1',
    dependencies: ['Present Tense Regular Verbs (-ar, -er, -ir)']
  },
  {
    title: 'Conditional Tense',
    description: 'Expressing what "would" happen.',
    guide: '# Conditional Tense\n\nThe conditional is used to express what *would* happen under certain conditions, or to make polite requests.\n\n### Regular Endings (Added to the INFINITIVE for all verbs):\n*   -ía, -ías, -ía, -íamos, -íais, -ían\n\n### Examples:\n*   **Hablar:** hablaría, hablarías, hablaría...\n*   **Comer:** comería, comerías, comería...\n\n### Irregular Stems:\nThe conditional uses the *exact same irregular stems* as the future tense:\n*   Tener → **tendr-** (tendría)\n*   Hacer → **har-** (haría)\n*   Poder → **podr-** (podría)',
    level: 'B2',
    dependencies: ['Future Tense']
  },
  {
    title: 'Present Perfect (Pretérito Perfecto)',
    description: 'Expressing past events that are connected to the present (I have done...).',
    guide: '# Present Perfect\n\nThe present perfect is used to describe actions that "have happened" and are still relevant to the present.\n\n### Formation:\n**Present tense of "haber" + Past Participle**\n\n### Haber conjugations:\n*   he, has, ha, hemos, habéis, han\n\n### Past Participles:\n*   -AR verbs: drop -ar, add **-ado** (hablar → hablado)\n*   -ER/-IR verbs: drop -er/-ir, add **-ido** (comer → comido)\n\n### Example:\n*   **He comido** una manzana. (I have eaten an apple.)\n*   ¿**Has visitado** España? (Have you visited Spain?)',
    level: 'B2',
    dependencies: ['Preterite Tense - Regular Verbs']
  },
  {
    title: 'Past Perfect (Pluscuamperfecto)',
    description: 'Expressing an action that "had happened" before another past action.',
    guide: '# Past Perfect (Pluscuamperfecto)\n\nUsed to express an action that happened *before* another action in the past (I had done...).\n\n### Formation:\n**Imperfect tense of "haber" + Past Participle**\n\n### Haber conjugations (Imperfect):\n*   había, habías, había, habíamos, habíais, habían\n\n### Example:\n*   Cuando llegué, ella ya **había salido**. (When I arrived, she had already left.)',
    level: 'B2',
    dependencies: ['Present Perfect (Pretérito Perfecto)', 'Imperfect Tense']
  },
  {
    title: 'Imperfect Subjunctive',
    description: 'Subjunctive mood in the past tense.',
    guide: '# Imperfect Subjunctive\n\nUsed in the same situations as the present subjunctive (WEIRDO clauses), but when the main clause is in a past tense.\n\n### Formation:\n1. Find the "ellos" form of the preterite (e.g., hablaron, comieron, tuvieron).\n2. Drop the "-ron".\n3. Add the endings: **-ra, -ras, -ra, -\'ramos, -rais, -ran**.\n\n### Examples:\n*   Hablar → hablara, hablaras, hablara, habláramos, hablarais, hablaran.\n*   Tener → tuviera...\n\n*Example sentence:* Yo quería que tú **vinieras** a la fiesta. (I wanted you to come to the party.)',
    level: 'B2',
    dependencies: ['Preterite Tense - Irregular Verbs', 'Present Subjunctive Mood']
  },
  {
    title: 'Yes/No and Wh- Questions in Spanish',
    description: 'Forming sí/no questions and information questions with question words like qué, cuándo, dónde, por qué.',
    guide: '# Yes/No and Wh- Questions in Spanish\n\nSpanish questions use **inversion** and often a **question word**.\n\n### Yes/No Questions\nUsually just invert subject and verb or use rising intonation:\n*   **¿Hablas español?** (Do you speak Spanish?)\n*   **¿Comes carne?** (Do you eat meat?)\n\n### Wh- Questions (Information Questions)\nUse a question word + verb + subject:\n*   **¿Qué** comes? (What are you eating?)\n*   **¿Dónde** vives? (Where do you live?)\n*   **¿Cuándo** trabajas? (When do you work?)\n*   **¿Por qué** estudias español? (Why do you study Spanish?)\n\n> **Note:** Question words in Spanish always carry an accent in questions (qué, cuándo, dónde, cómo, por qué, etc.).',
    level: 'A1',
    dependencies: ['Subject Pronouns (Pronombres Personales)', 'Present Tense Regular Verbs (-ar, -er, -ir)']
  },
  {
    title: 'Present Progressive (Estar + Gerundio)',
    description: 'Describing actions that are happening right now using estar + gerund.',
    guide: '# Present Progressive (Estar + Gerundio)\n\nTo talk about actions happening **right now**, Spanish often uses **estar + gerundio** (similar to English "be + -ing").\n\n### Formation\n**Estar (present) + gerund**\n\n- AR verbs → -ando (hablar → hablando)\n- ER/IR verbs → -iendo (comer → comiendo, vivir → viviendo)\n\n### Examples\n*   **Estoy estudiando** español. (I am studying Spanish.)\n*   **Estamos comiendo** ahora. (We are eating now.)\n\n> It is less overused than the English -ing and not used for long-term habits.',
    level: 'A2',
    dependencies: ['Ser vs Estar', 'Present Tense Regular Verbs (-ar, -er, -ir)']
  },
  {
    title: 'Comparatives and Superlatives in Spanish',
    description: 'Forming comparisons with más/menos ... que and superlatives with el/la más ... de.',
    guide: '# Comparatives and Superlatives in Spanish\n\n### Comparatives\nTo compare two things, use **más/menos ... que** or **tan ... como**.\n\n*   Ella es **más alta que** su hermana. (She is taller than her sister.)\n*   Este libro es **menos interesante que** el otro. (This book is less interesting than the other.)\n*   Soy **tan paciente como** tú. (I am as patient as you.)\n\n### Superlatives\nUse **el/la/los/las más/menos + adjective + de**.\n\n*   Es **el más grande de** la clase. (He is the tallest in the class.)\n*   Son **las menos caras de** la tienda. (They are the least expensive in the store.)\n\nSome adjectives have irregular forms (bueno → mejor, malo → peor, grande → mayor, pequeño → menor).',
    level: 'A2',
    dependencies: ['Adjective Agreement']
  },
  {
    title: 'Adverbs ending in -mente',
    description: 'Forming manner adverbs like rápidamente, fácilmente from adjectives.',
    guide: '# -mente Adverbs\n\nMany adverbs of manner are formed from adjectives + **-mente** (like English "-ly").\n\n### Formation\n1. Take the feminine singular form of the adjective (if it has one).\n2. Add **-mente**.\n\n*   rápido → rápida → **rápidamente** (quick → quickly)\n*   feliz → feliz → **felizmente** (happy → happily)\n\n### Examples\n*   Habla **claramente**. (He speaks clearly.)\n*   Ella conduce **cuidadosamente**. (She drives carefully.)',
    level: 'A2',
    dependencies: ['Adjective Agreement']
  },
  {
    title: 'Relative Clauses (Oraciones de Relativo)',
    description: 'Using que, quien, donde, cuyo to join sentences and describe nouns.',
    guide: '# Relative Clauses (Oraciones de Relativo)\n\nRelative clauses give extra information about a noun and are introduced by relative pronouns.\n\n### Common Pronouns\n*   **que** – that, who, which (most frequent)\n*   **quien(es)** – who (after prepositions / in nonessential clauses)\n*   **donde** – where\n*   **cuyo/a(s)** – whose (agrees with the thing possessed)\n\n### Examples\n*   El libro **que** compré es interesante. (The book that I bought is interesting.)\n*   La mujer **con quien** hablo es mi profesora. (The woman with whom I speak is my teacher.)\n*   La ciudad **donde** vivo es pequeña. (The city where I live is small.)',
    level: 'B1',
    dependencies: ['Definite and Indefinite Articles', 'Preterite vs Imperfect']
  },
  {
    title: 'Impersonal and Passive "se"',
    description: 'Using se for impersonal statements and passive-like constructions (Se habla español).',
    guide: '# Impersonal and Passive "se"\n\nSpanish often uses **se** to make general or passive-like statements without mentioning who does the action.\n\n### Impersonal se\nUsed for people in general (like English "one/you/they").\n*   **Se come** tarde en España. (People eat late in Spain.)\n\n### Passive se\nUsed with a direct object that becomes the grammatical subject. The verb agrees with the object.\n*   **Se venden** casas. (Houses are sold.)\n*   **Se habla** español aquí. (Spanish is spoken here.)',
    level: 'B1',
    dependencies: ['Preterite Tense - Regular Verbs', 'Direct Object Pronouns (DOPs)', 'Indirect Object Pronouns (IOPs)']
  },
  {
    title: 'Periphrastic Constructions (Tener que, Acabar de, Volver a, Seguir + Gerund)',
    description: 'Common verb + infinitive or gerund constructions that express obligation, recent past, repetition and continuation.',
    guide: '# Common Periphrastic Constructions\n\nSpanish uses many **verb + infinitive/gerund** combinations with special meanings.\n\n### Obligation\n*   **tener que + infinitive** – to have to do something:\n    *   Tengo que estudiar. (I have to study.)\n\n### Recent Past\n*   **acabar de + infinitive** – to have just done something:\n    *   Acabo de llegar. (I have just arrived.)\n\n### Repetition\n*   **volver a + infinitive** – to do something again:\n    *   Volvimos a intentarlo. (We tried again.)\n\n### Continuation\n*   **seguir + gerundio** – to keep doing something:\n    *   Sigo trabajando. (I keep working.)',
    level: 'B1',
    dependencies: ['Present Tense Regular Verbs (-ar, -er, -ir)', 'Tener and Idioms with Tener', 'Ir and the Near Future (Ir + a + Infinitive)']
  },
  {
    title: 'Subjunctive in Noun Clauses',
    description: 'Using the present subjunctive after WEIRDO verbs and expressions in que-clauses.',
    guide: '# Subjunctive in Noun Clauses\n\nNoun clauses are usually introduced by **que** and function as the object of a verb or expression. With WEIRDO triggers, they require the **subjunctive**.\n\n### Examples\n*   Quiero **que vengas**. (I want you to come.)\n*   Es importante **que estudies**. (It is important that you study.)\n*   Dudo **que sea** verdad. (I doubt it is true.)',
    level: 'B2',
    dependencies: ['Present Subjunctive Mood']
  },
  {
    title: 'Subjunctive in Adverbial Clauses',
    description: 'Using subjunctive after conjunctions like cuando, antes de que, para que, en caso de que.',
    guide: '# Subjunctive in Adverbial Clauses\n\nCertain conjunctions trigger the subjunctive because they introduce actions that are **hypothetical, future, or uncertain**.\n\n### Always Subjunctive\n*   para que (so that)\n*   a menos que (unless)\n*   en caso de que (in case)\n*   antes de que (before)\n\n### Time Conjunctions (cuando, hasta que, etc.)\nUse **subjunctive** if the action is in the future/unreal; **indicative** if it is habitual or in the past.\n\n*   Te llamaré cuando **llegue**. (I will call you when I arrive.)\n*   Siempre me llama cuando **llega**. (He always calls me when he arrives.)',
    level: 'B2',
    dependencies: ['Present Subjunctive Mood', 'Preterite vs Imperfect']
  },
  {
    title: 'Future Perfect (Futuro Perfecto)',
    description: 'Expressing what will have happened by a certain point in the future.',
    guide: '# Future Perfect (Futuro Perfecto)\n\nUsed to express what **will have happened** by a certain moment in the future, or to speculate about the past.\n\n### Formation\n**Future of haber + past participle**\n*   habré, habrás, habrá, habremos, habréis, habrán + hablado/comido/vivido\n\n### Examples\n*   Para mañana, **habré terminado** el proyecto. (By tomorrow, I will have finished the project.)\n*   ¿Dónde está Juan? **Habrá salido**. (He must have gone out.)',
    level: 'B2',
    dependencies: ['Future Tense', 'Present Perfect (Pretérito Perfecto)']
  },
  {
    title: 'Conditional Perfect (Condicional Perfecto)',
    description: 'Expressing what would have happened under different conditions (habría + participle).',
    guide: '# Conditional Perfect (Condicional Perfecto)\n\nUsed to express what **would have happened** under different conditions, often in third type si-clauses.\n\n### Formation\n**Conditional of haber + past participle**\n*   habría, habrías, habría, habríamos, habríais, habrían + hablado/comido/vivido\n\n### Example\n*   Yo **habría ido**, pero estaba enfermo. (I would have gone, but I was sick.)',
    level: 'B2',
    dependencies: ['Conditional Tense', 'Past Perfect (Pluscuamperfecto)']
  },
  {
    title: 'Si Clauses (Conditionals)',
    description: 'Expressing "if... then..." statements.',
    guide: '# Si Clauses (If Clauses)\n\n"Si" means "if". Different tense combinations are used depending on the likelihood of the condition.\n\n### 1. Likely Situations (Present + Present/Future)\n*   Si **tengo** tiempo, **iré** al cine. (If I have time, I will go to the movies.)\n\n### 2. Unlikely/Unreal Present Situations (Imperfect Subjunctive + Conditional)\n*   Si **tuviera** dinero, **compraría** un coche. (If I had money, I would buy a car.)\n\n### 3. Impossible Past Situations (Past Perfect Subjunctive + Conditional Perfect)\n*   Si **hubiera estudiado**, **habría aprobado**. (If I had studied, I would have passed.)',
    level: 'C1',
    dependencies: ['Conditional Tense', 'Imperfect Subjunctive']
  }
];

export async function runSeed(client: PrismaClient = prisma, override: boolean = false) {
  // 1. Check if we need to seed
  const count = await client.vocabulary.count();
  if (count > 0 && !override) {
    console.log('Database already seeded. Skipping...');
    return;
  }

  console.log('Start seeding...');

  // 1.5 Create Languages
  console.log('Creating languages...');
  const german = await client.language.upsert({
    where: { code: 'de' },
    update: {},
    create: { code: 'de', name: 'German', flag: '🇩🇪' },
  });

  const spanish = await client.language.upsert({
    where: { code: 'es' },
    update: {},
    create: { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  });

  // 2. Insert Vocabulary
  console.log('Seeding vocabulary...');
  for (const vocab of germanVocabulary) {
    let gender: any = (vocab as any).gender;
    if (gender === 'der') gender = 'MASCULINE';
    else if (gender === 'die') gender = 'FEMININE';
    else if (gender === 'das') gender = 'NEUTER';

    const existing = await client.vocabulary.findFirst({ where: { lemma: vocab.lemma, languageId: german.id } });
    if (existing) {
      await client.vocabulary.update({
        where: { id: existing.id },
        data: { ...vocab, gender }
      });
    } else {
      await client.vocabulary.create({
        data: { ...vocab, gender, languageId: german.id }
      });
    }
  }
  console.log(`Seeded ${germanVocabulary.length} vocabulary words for German.`);

  console.log('Seeding Spanish vocabulary...');
  for (const vocab of spanishVocabulary) {
    let gender: any = (vocab as any).gender;

    const existing = await client.vocabulary.findFirst({ where: { lemma: vocab.lemma, languageId: spanish.id } });
    if (existing) {
      await client.vocabulary.update({
        where: { id: existing.id },
        data: { ...vocab, gender }
      });
    } else {
      await client.vocabulary.create({
        data: { ...vocab, gender, languageId: spanish.id }
      });
    }
  }
  console.log(`Seeded ${spanishVocabulary.length} vocabulary words for Spanish.`);

  // 3. Insert Grammar Rules (First Pass: Create without dependencies)
  console.log('Seeding grammar rules (First Pass)...');
  for (const rule of basicGrammarRules) {
    const existing = await client.grammarRule.findFirst({ where: { title: rule.title, languageId: german.id } });
    if (existing) {
      await client.grammarRule.update({
        where: { id: existing.id },
        data: { description: rule.description, guide: rule.guide, level: rule.level }
      });
    } else {
      await client.grammarRule.create({
        data: {
          title: rule.title,
          description: rule.description,
          guide: rule.guide,
          level: rule.level,
          languageId: german.id
        },
      });
    }
  }

  for (const rule of spanishGrammarRules) {
    const existing = await client.grammarRule.findFirst({ where: { title: rule.title, languageId: spanish.id } });
    if (existing) {
      await client.grammarRule.update({
        where: { id: existing.id },
        data: { description: rule.description, guide: rule.guide, level: rule.level }
      });
    } else {
      await client.grammarRule.create({
        data: {
          title: rule.title,
          description: rule.description,
          guide: rule.guide,
          level: rule.level,
          languageId: spanish.id
        },
      });
    }
  }

  console.log(`Seeded ${basicGrammarRules.length} German grammar rules and ${spanishGrammarRules.length} Spanish grammar rules.`);

  // 4. Update Grammar Rules (Second Pass: Connect dependencies)
  console.log('Connecting grammar rule dependencies (Second Pass)...');
  for (const rule of basicGrammarRules) {
    if (rule.dependencies && rule.dependencies.length > 0) {
      const parentRules = await client.grammarRule.findMany({
        where: { title: { in: rule.dependencies }, languageId: german.id },
      });
      
      const currentRule = await client.grammarRule.findFirst({
        where: { title: rule.title, languageId: german.id }
      });

      if (parentRules.length > 0 && currentRule) {
        await client.grammarRule.update({
          where: { id: currentRule.id },
          data: {
            dependencies: {
              connect: parentRules.map((parent) => ({ id: parent.id })),
            },
          },
        });
      }
    }
  }

  for (const rule of spanishGrammarRules) {
    if (rule.dependencies && rule.dependencies.length > 0) {
      const parentRules = await client.grammarRule.findMany({
        where: { title: { in: rule.dependencies }, languageId: spanish.id },
      });
      
      const currentRule = await client.grammarRule.findFirst({
        where: { title: rule.title, languageId: spanish.id }
      });

      if (parentRules.length > 0 && currentRule) {
        await client.grammarRule.update({
          where: { id: currentRule.id },
          data: {
            dependencies: {
              connect: parentRules.map((parent) => ({ id: parent.id })),
            },
          },
        });
      }
    }
  }

  console.log('Connected grammar rule dependencies.');

  console.log('Seeding finished.');
}

async function main() {
  await runSeed(prisma, true);
}

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === new URL(import.meta.url).pathname || process.argv[1] === __filename) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

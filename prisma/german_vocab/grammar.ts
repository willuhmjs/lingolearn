export const germanGrammarRules = [
  // ===== A1 Rules =====
  {
    title: 'Personal Pronouns (Nominative)',
    description: 'The use of ich, du, er, sie, es, wir, ihr, sie, Sie as subjects.',
    guide:
      '# Personal Pronouns (Nominative)\n\nPersonal pronouns replace the subject noun in a sentence and are the foundation for all verb conjugation.\n\n### Forms\n| Pronoun | Meaning |\n|---|---|\n| **ich** | I |\n| **du** | you (informal singular) |\n| **er / sie / es** | he / she / it |\n| **wir** | we |\n| **ihr** | you all (informal plural) |\n| **sie / Sie** | they / you (formal) |\n\n### Examples\n- *Ich bin müde.* (I am tired.)\n- *Er spielt Fußball.* (He plays football.)\n- *Wir lernen Deutsch.* (We are learning German.)\n\n> **Tip:** The formal address **Sie** is always capitalised, even in the middle of a sentence.',
    ruleType: 'pronoun',
    targetForms: ['ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr'],
    level: 'A1',
    dependencies: []
  },
  {
    title: 'Present Tense (Präsens) - Regular Verbs',
    description: 'Conjugation of regular verbs in the present tense.',
    guide:
      '# Präsens – Regular Verbs\n\nThe **Präsens** is used for the present, the near future, and general statements. Regular verbs follow a predictable pattern.\n\n### Example: **machen** (to do/make)\n| Person | Form |\n|---|---|\n| ich | mach**e** |\n| du | mach**st** |\n| er/sie/es | mach**t** |\n| wir | mach**en** |\n| ihr | mach**t** |\n| sie/Sie | mach**en** |\n\n### Usage\n- *Ich mache meine Hausaufgaben.*\n- *Wir machen heute Sport.*\n\n> **Note:** The endings -e, -st, -t, -en, -t, -en are the standard present-tense endings.',
    ruleType: 'verb_conjugation',
    targetForms: ['-e', '-st', '-t', '-en'],
    level: 'A1',
    dependencies: ['Personal Pronouns (Nominative)']
  },
  {
    title: 'Present Tense (Präsens) - Irregular Verbs',
    description:
      'Irregular present tense patterns for verbs like sein, haben, werden and common stem-changing verbs.',
    guide:
      '# Präsens – Irregular Verbs\n\nSome of the most important verbs are irregular in the present tense and must be memorised.\n\n### **sein** (to be)\n- ich **bin**\n- du **bist**\n- er/sie/es **ist**\n- wir **sind**\n- ihr **seid**\n- sie/Sie **sind**\n\n### **haben** (to have)\n- ich **habe**\n- du **hast**\n- er/sie/es **hat**\n- wir **haben**\n- ihr **habt**\n- sie/Sie **haben**\n\n### **werden** (to become / future auxiliary)\n- ich **werde**\n- du **wirst**\n- er/sie/es **wird**\n- wir **werden**\n- ihr **werdet**\n- sie/Sie **werden**\n\nIn addition, many verbs have a stem-vowel change (nehmen → du nimmst, er nimmt; fahren → du fährst, er fährt).\n\n> **Tip:** Learn the conjugation of **sein**, **haben**, and **werden** early on — they are used everywhere.',
    ruleType: 'verb_conjugation',
    targetForms: ['sein', 'haben', 'werden'],
    level: 'A1',
    dependencies: ['Personal Pronouns (Nominative)']
  },
  {
    title: 'Noun Gender (Genus)',
    description: 'Every German noun has a grammatical gender.',
    guide:
      '# Noun Gender (Genus)\n\nEvery German noun has a **grammatical gender**: masculine, feminine, or neuter. The gender determines the article and many endings.\n\n### Examples\n- **der** Mann (masculine)\n- **die** Frau (feminine)\n- **das** Kind (neuter)\n\n### Typical Endings\n- Often masculine: -er, -en, -ig (der Computer, der Garten)\n- Often feminine: -e, -heit, -keit, -ung, -schaft (die Blume, die Gesundheit)\n- Often neuter: -chen, -lein, -ment, -um (das Mädchen, das Instrument)\n\n> **Note:** Natural (biological) gender and grammatical gender do not always match (e.g. *das Mädchen*).',
    ruleType: 'noun_gender',
    targetForms: ['der', 'die', 'das'],
    level: 'A1',
    dependencies: []
  },
  {
    title: 'Definite Articles (Nominative)',
    description: 'The use of der, die, das in the nominative case.',
    guide:
      '# Definite Articles (Nominative)\n\nThe **definite article** corresponds to the English "the" and agrees with the gender and number of the noun.\n\n### Nominative Table\n| Gender | Singular | Plural |\n|---|---|---|\n| masculine | **der** Mann | **die** Männer |\n| feminine | **die** Frau | **die** Frauen |\n| neuter | **das** Kind | **die** Kinder |\n\n### Examples\n- **Der** Hund schläft.\n- **Die** Katze spielt.\n- **Das** Haus ist groß.',
    ruleType: 'article',
    targetForms: ['der', 'die', 'das'],
    level: 'A1',
    dependencies: ['Noun Gender (Genus)']
  },
  {
    title: 'Indefinite Articles (Nominative)',
    description: 'The use of ein, eine, kein in the nominative case.',
    guide:
      '# Indefinite Articles (Nominative)\n\nThe **indefinite article** usually corresponds to English "a/an". In the plural there is no indefinite article — the plural without an article or **keine** is used instead.\n\n### Forms\n| Gender | Singular | Negation |\n|---|---|---|\n| masculine | **ein** Mann | **kein** Mann |\n| feminine | **eine** Frau | **keine** Frau |\n| neuter | **ein** Kind | **kein** Kind |\n\n### Examples\n- Ich habe **ein** Auto.\n- Sie hat **eine** Frage.\n- Wir haben **keine** Zeit.\n\n> **Note:** **kein** is declined like **ein**, but combines the article and negation.',
    ruleType: 'article',
    targetForms: ['ein', 'eine', 'kein', 'keine'],
    level: 'A1',
    dependencies: ['Noun Gender (Genus)']
  },
  {
    title: 'Word Order - Main Clause (Hauptsatz)',
    description: 'The verb is always the second element in a standard declarative main clause.',
    guide:
      '# Word Order in the Main Clause (Verb-Second)\n\nIn a German declarative sentence the **conjugated verb always occupies the second position**. The first element can be the subject, an adverbial, or an object.\n\n### Examples\n- **Ich** (1) **gehe** (2) heute ins Kino.\n- **Heute** (1) **gehe** (2) ich ins Kino.\n\n> **Note:** Count clause elements, not individual words. First position (1) – verb (2) – rest.',
    ruleType: 'word_order',
    targetForms: ['verb-second'],
    level: 'A1',
    dependencies: ['Present Tense (Präsens) - Regular Verbs']
  },
  {
    title: 'Accusative Case (Akkusativ)',
    description: 'Direct objects. Note: only masculine articles change (der -> den, ein -> einen).',
    guide:
      '# Akkusativ – Direct Object\n\nThe **Akkusativ** marks the direct object. Between the Nominative and the Akkusativ, mainly the masculine forms change.\n\n### Article Overview (Singular)\n- der → **den**\n- ein → **einen**\n- die → **die**\n- eine → **eine**\n- das → **das**\n- ein → **ein**\n\n### Examples\n- Ich sehe **den** Hund.\n- Er kauft **einen** Computer.\n- Wir haben **eine** Frage.\n\n> **Tip:** Many verbs require the Akkusativ (sehen, kaufen, finden …).',
    ruleType: 'case_marking',
    targetForms: ['den', 'einen', 'keinen'],
    level: 'A1',
    dependencies: ['Definite Articles (Nominative)', 'Indefinite Articles (Nominative)']
  },
  {
    title: 'Negation with "nicht" and "kein"',
    description:
      '"Nicht" negates verbs, adjectives, and specific nouns; "kein" negates indefinite nouns (ein → kein). Placement rules differ.',
    guide:
      '# Negation with **nicht** and **kein**\n\nGerman uses different negation strategies:\n- **nicht** negates verbs, adjectives, or the entire sentence.\n- **kein** negates a noun that has an indefinite article or no article at all.\n\n### Examples with **nicht**\n- Ich komme **nicht**.\n- Das ist **nicht** interessant.\n\n### Examples with **kein**\n- Ich habe **kein** Auto.\n- Wir haben **keine** Zeit.\n\n> **Note:** **kein** = *nicht ein*. It is declined like **ein**.',
    ruleType: 'negation',
    targetForms: ['nicht', 'kein', 'keine'],
    level: 'A1',
    dependencies: ['Accusative Case (Akkusativ)']
  },
  {
    title: 'Yes/No Questions (Entscheidungsfragen)',
    description:
      'Questions answered with ja/nein are formed by placing the conjugated verb in first position (e.g., Sprichst du Deutsch?).',
    guide:
      '# Yes/No Questions (Entscheidungsfragen)\n\nIn **yes/no questions** the conjugated verb comes first.\n\n### Structure\n**Verb + Subject + Rest**\n\n### Examples\n- **Kommst** du heute?\n- **Hast** du Zeit?\n- **Wohnst** du in Berlin?\n\n> **Tip:** The answer usually begins with **ja** or **nein**.',
    ruleType: 'question_formation',
    targetForms: ['verb-first'],
    level: 'A1',
    dependencies: ['Word Order - Main Clause (Hauptsatz)']
  },
  {
    title: 'W-Questions (W-Fragen)',
    description:
      'Questions starting with a W-word (wer, was, wo, wann, warum, wie, etc.) with the verb in second position.',
    guide:
      '# W-Questions (W-Fragen)\n\n**W-questions** begin with a question word (wer, was, wo, wann, warum, wie, wohin, woher …). The conjugated verb occupies the second position.\n\n### Structure\n**Question word + Verb + Subject + Rest**\n\n### Examples\n- **Wo** wohnst du?\n- **Wann** kommst du?\n- **Warum** lernst du Deutsch?',
    ruleType: 'question_formation',
    targetForms: ['wer', 'was', 'wo', 'wann', 'warum', 'wie'],
    level: 'A1',
    dependencies: ['Word Order - Main Clause (Hauptsatz)']
  },
  {
    title: 'Possessive Articles (Possessivartikel)',
    description:
      'Words showing ownership: mein (my), dein (your), sein (his/its), ihr (her/their), unser (our), euer (your pl.), Ihr (formal your). Declined like "ein".',
    guide:
      '# Possessive Articles (Possessivartikel)\n\nPossessive articles indicate ownership or belonging and are declined like **ein**.\n\n### Base Forms\n- **mein(e)** – my\n- **dein(e)** – your (informal)\n- **sein(e)** – his/its\n- **ihr(e)** – her/their\n- **unser(e)** – our\n- **euer/eure** – your (plural, informal)\n- **Ihr(e)** – your (formal)\n\n### Examples\n- Das ist **mein** Auto.\n- Wo ist **deine** Tasche?\n- Wir besuchen **unsere** Freunde.',
    ruleType: 'possession',
    targetForms: ['mein', 'dein', 'sein', 'ihr', 'unser'],
    level: 'A1',
    dependencies: ['Indefinite Articles (Nominative)', 'Personal Pronouns (Nominative)']
  },
  {
    title: 'Sein, Haben, Werden - Conjugation',
    description: 'Core auxiliary verbs in German and their present tense forms.',
    guide:
      '# sein, haben, werden – Core Verbs\n\nThe verbs **sein**, **haben**, and **werden** are extremely common as both auxiliary and full verbs.\n\n### sein\nIch **bin**, du **bist**, er/sie/es **ist**, wir **sind**, ihr **seid**, sie/Sie **sind**.\n\n### haben\nIch **habe**, du **hast**, er/sie/es **hat**, wir **haben**, ihr **habt**, sie/Sie **haben**.\n\n### werden\nIch **werde**, du **wirst**, er/sie/es **wird**, wir **werden**, ihr **werdet**, sie/Sie **werden**.\n\nThey serve as auxiliary verbs for tenses (Perfekt, Futur) and the passive voice.',
    ruleType: 'verb_auxiliary',
    targetForms: ['bin', 'ist', 'sind', 'habe', 'hat', 'wird'],
    level: 'A1',
    dependencies: ['Present Tense (Präsens) - Irregular Verbs']
  },
  {
    title: 'Modal Verbs (Modalverben)',
    description:
      'Verbs expressing ability, obligation, permission, etc.: können, müssen, dürfen, sollen, wollen, mögen/möchten. The main verb goes to the end in infinitive form.',
    guide:
      '# Modal Verbs (Modalverben)\n\nModal verbs express ability, necessity, wish, or permission (können, müssen, dürfen, sollen, wollen, mögen/möchten). The modal verb is conjugated and occupies second position; the main verb appears as an **infinitive at the end of the sentence**.\n\n### Examples\n- Ich **kann** heute **kommen**.\n- Wir **müssen** viel **lernen**.\n- Sie **möchte** einen Kaffee **trinken**.\n\n> **Note:** Only the modal verb is conjugated — the main verb stays in the infinitive.',
    ruleType: 'modal_verb',
    targetForms: ['können', 'müssen', 'dürfen', 'sollen', 'wollen', 'möchten'],
    level: 'A1',
    dependencies: [
      'Present Tense (Präsens) - Irregular Verbs',
      'Word Order - Main Clause (Hauptsatz)'
    ]
  },
  {
    title: 'Separable Verbs (Trennbare Verben)',
    description:
      'Verbs with a separable prefix (e.g., anfangen, aufstehen, einkaufen). In main clauses, the prefix moves to the end of the sentence.',
    guide:
      '# Separable Verbs (Trennbare Verben)\n\nMany verbs have a prefix that is **detached** in a main clause (aufstehen, einkaufen, anrufen …).\n\n### Structure in the Main Clause\n- Ich **stehe** um 7 Uhr **auf**.\n- Er **ruft** seine Freundin **an**.\n\nIn the infinitive and in the Partizip II the prefix stays attached: **aufstehen**, **aufgestanden**.',
    ruleType: 'verb_separable',
    targetForms: ['prefix separation'],
    level: 'A1',
    dependencies: [
      'Present Tense (Präsens) - Regular Verbs',
      'Word Order - Main Clause (Hauptsatz)'
    ]
  },
  {
    title: 'Inseparable Verbs (Untrennbare Verben)',
    description:
      'Verbs with prefixes that never separate: be-, emp-, ent-, er-, ge-, miss-, ver-, zer- (e.g., verstehen, beginnen, empfehlen).',
    guide:
      '# Inseparable Verbs (Untrennbare Verben)\n\nCertain prefixes are **never** detached: be-, emp-, ent-, er-, ge-, miss-, ver-, zer-.\n\n### Examples\n- verstehen, bekommen, beginnen, verkaufen, erklären\n\nIn the Perfekt these verbs do not add an extra ge-: **verstehen → verstanden**, **bekommen → bekommen**.',
    ruleType: 'verb_separable',
    targetForms: ['be-', 'ver-', 'er-', 'ent-'],
    level: 'A1',
    dependencies: [
      'Present Tense (Präsens) - Regular Verbs',
      'Word Order - Main Clause (Hauptsatz)'
    ]
  },
  {
    title: 'Accusative Prepositions',
    description:
      'Prepositions that always take the accusative case: durch, für, gegen, ohne, um, bis, entlang.',
    guide:
      '# Prepositions with Akkusativ\n\nThese prepositions **always** require the Akkusativ: **durch, für, gegen, ohne, um, bis, entlang**.\n\n### Examples\n- Das Geschenk ist **für** meinen Bruder.\n- Wir gehen **durch** den Park.\n- Sie fährt **ohne** ihren Mann.',
    ruleType: 'preposition',
    targetForms: ['durch', 'für', 'gegen', 'ohne', 'um'],
    level: 'A1',
    dependencies: ['Accusative Case (Akkusativ)']
  },
  {
    title: 'Numbers and Time Expressions',
    description:
      'Cardinal numbers, ordinal numbers, telling time (Es ist drei Uhr / halb vier), days of the week, months.',
    guide:
      '# Numbers and Time Expressions\n\n### Cardinal Numbers\n0 null, 1 eins, 2 zwei, 3 drei …\n\n### Telling the Time\n- **Es ist drei Uhr.**\n- **Es ist halb vier.** (3:30)\n\n### Days of the Week & Months\nMontag, Dienstag, Mittwoch, Donnerstag, Freitag, Samstag/Sonnabend, Sonntag; Januar, Februar …\n\n> **Tip:** Time expressions often appear at position 1 or in the middle field of the sentence: *Heute gehe ich ins Kino.*',
    ruleType: 'time_expression',
    targetForms: ['um', 'am', 'im', 'Uhr'],
    level: 'A1',
    dependencies: []
  },
  {
    title: 'Imperative (Imperativ)',
    description:
      'Giving commands or instructions in du, ihr, and Sie forms (e.g., Komm!, Kommt!, Kommen Sie!).',
    guide:
      '# Imperative (Imperativ)\n\nThe imperative expresses requests and commands. There are forms for **du**, **ihr**, and **Sie**.\n\n### Examples\n- (du) **Komm!**\n- (ihr) **Kommt!**\n- (Sie) **Kommen Sie!**\n\n> **Note:** For many verbs the -st ending is dropped in the du-imperative: *du kommst → Komm!*',
    ruleType: 'imperative',
    targetForms: ['du-form', 'ihr-form', 'Sie-form'],
    level: 'A1',
    dependencies: ['Present Tense (Präsens) - Regular Verbs']
  },
  {
    title: 'Coordinating Conjunctions (Konjunktionen)',
    description:
      'Conjunctions that do not change word order: und (and), aber (but), oder (or), denn (because), sondern (but rather).',
    guide:
      '# Coordinating Conjunctions\n\nConjunctions such as **und, aber, oder, denn, sondern** connect two main clauses or clause elements without changing the word order (the verb stays in second position).\n\n### Examples\n- Ich gehe ins Kino, **aber** meine Freundin bleibt zu Hause.\n- Er lernt Deutsch **und** sie lernt Spanisch.',
    ruleType: 'conjunction',
    targetForms: ['und', 'aber', 'oder', 'denn', 'sondern'],
    level: 'A1',
    dependencies: ['Word Order - Main Clause (Hauptsatz)']
  },

  // ===== A2 Rules =====
  {
    title: 'Dative Case (Dativ)',
    description:
      'Indirect objects. Articles change: der/das -> dem, die -> der, plural -> den + n.',
    guide:
      '# Dativ – Indirect Object\n\nThe **Dativ** usually marks the indirect object (to whom?).\n\n### Article Overview (Singular)\n- der → **dem**\n- die → **der**\n- das → **dem**\n\nIn the plural an **-n** is usually added: *den Kindern*.\n\n### Examples\n- Ich gebe **dem Mann** das Buch.\n- Sie hilft **der Frau**.\n\n> Question word: **wem?** (to whom?)',
    ruleType: 'case_marking',
    targetForms: ['dem', 'der', 'einem', 'einer'],
    level: 'A2',
    dependencies: ['Accusative Case (Akkusativ)']
  },
  {
    title: 'Dative Prepositions',
    description:
      'Prepositions that always take the dative case (aus, außer, bei, mit, nach, seit, von, zu).',
    guide:
      '# Prepositions with Dativ\n\nThese prepositions **always** require the Dativ: **aus, außer, bei, mit, nach, seit, von, zu**.\n\n### Examples\n- Ich fahre **mit** dem Bus.\n- Er wohnt **bei** seinen Eltern.\n- Wir kommen **aus** der Stadt.',
    ruleType: 'preposition',
    targetForms: ['mit', 'von', 'zu', 'bei', 'nach', 'aus', 'seit'],
    level: 'A2',
    dependencies: ['Dative Case (Dativ)']
  },
  {
    title: 'Two-Way Prepositions (Wechselpräpositionen)',
    description:
      'Prepositions (in, an, auf, über, unter, vor, hinter, neben, zwischen) that take Accusative for movement/direction and Dative for static location.',
    guide:
      '# Two-Way Prepositions (Wechselpräpositionen)\n\nPrepositions such as **in, an, auf, über, unter, vor, hinter, neben, zwischen** can take either the Dativ or the Akkusativ.\n\n- **Akkusativ**: movement / direction (wohin? — where to?)\n- **Dativ**: location / position (wo? — where?)\n\n### Examples\n- Ich gehe **in die** Stadt. (Akk.)\n- Ich bin **in der** Stadt. (Dat.)',
    ruleType: 'preposition',
    targetForms: ['in', 'an', 'auf', 'über', 'unter', 'vor', 'hinter'],
    level: 'A2',
    dependencies: ['Accusative Prepositions', 'Dative Prepositions']
  },
  {
    title: 'Adjective Endings (Adjektivdeklination)',
    description:
      'The endings added to adjectives based on the gender, case, and type of article (definite, indefinite, or none).',
    guide:
      '# Adjective Endings (Adjektivdeklination)\n\nIn German, adjectives take **endings** that depend on gender, case, number, and article type.\n\n- After definite article: **der schöne Mann**\n- After indefinite article: **ein schöner Mann**\n- Without article: **schöner Mann**\n\n> **Strategy:** Learn the most common patterns first (Nominative/Akkusativ singular), then build up from there.',
    ruleType: 'adjective',
    targetForms: ['-e', '-en', '-er', '-em', '-es'],
    level: 'A2',
    dependencies: ['Accusative Case (Akkusativ)', 'Dative Case (Dativ)']
  },
  {
    title: 'Comparative and Superlative (Komparativ und Superlativ)',
    description:
      'Comparing things: Komparativ adds "-er" (schneller), Superlativ uses "am + -sten" (am schnellsten) or "der/die/das + -ste". Many common adjectives add an umlaut (alt → älter).',
    guide:
      '# Comparative and Superlative (Komparativ und Superlativ)\n\n- **Komparativ**: adjective + **-er** (schnell → schneller)\n- **Superlativ**: **am** + adjective + **-sten** or **der/die/das** + **-ste** (am schnellsten, der schnellste Läufer)\n\nMany adjectives add an umlaut: alt → älter, groß → größer.\n\n### Examples\n- Heute ist es **wärmer** als gestern.\n- Das ist **der beste** Film.',
    ruleType: 'comparison',
    targetForms: ['-er', 'am -sten', 'als'],
    level: 'A2',
    dependencies: ['Adjective Endings (Adjektivdeklination)']
  },
  {
    title: 'Reflexive Verbs',
    description: 'Verbs that require a reflexive pronoun (mich, dich, sich, uns, euch, sich).',
    guide:
      '# Reflexive Verbs\n\nReflexive verbs use a reflexive pronoun (mich, dich, sich, uns, euch, sich).\n\n### Examples\n- Ich **wasche mich**.\n- Du **ziehst dich** an.\n- Wir **freuen uns**.',
    ruleType: 'reflexive',
    targetForms: ['mich', 'dich', 'sich', 'uns', 'euch'],
    level: 'A2',
    dependencies: ['Accusative Case (Akkusativ)']
  },
  {
    title: 'Personal Pronouns in Accusative and Dative',
    description:
      'Pronoun forms change by case: ich → mich/mir, du → dich/dir, er → ihn/ihm, sie → sie/ihr, es → es/ihm, etc.',
    guide:
      '# Personal Pronouns in Accusative and Dative\n\n| Nominative | Akkusativ | Dativ |\n|---|---|---|\n| ich | mich | mir |\n| du | dich | dir |\n| er | ihn | ihm |\n| sie | sie | ihr |\n| es | es | ihm |\n| wir | uns | uns |\n| ihr | euch | euch |\n| sie/Sie | sie/Sie | ihnen/Ihnen |\n\n> **Tip:** Learn typical verbs that take the Dativ: *helfen, danken, gefallen*, etc.',
    ruleType: 'pronoun',
    targetForms: ['mich', 'mir', 'dich', 'dir', 'ihn', 'ihm'],
    level: 'A2',
    dependencies: ['Dative Case (Dativ)', 'Personal Pronouns (Nominative)']
  },
  {
    title: 'Subordinating Conjunctions (Subjunktionen)',
    description:
      'Conjunctions that send the verb to the end: weil (dass), wenn, ob, als, obwohl, damit.',
    guide:
      '# Subordinating Conjunctions (Subjunktionen)\n\nSubordinating conjunctions such as **weil, dass, wenn, ob, als, obwohl, damit** introduce subordinate clauses. In the subordinate clause the conjugated verb goes **to the end**.\n\n### Example\n- Ich bleibe zu Hause, **weil** ich krank **bin**.\n- Er sagt, **dass** er morgen **kommt**.',
    ruleType: 'conjunction',
    targetForms: ['weil', 'dass', 'wenn', 'ob', 'als', 'obwohl'],
    level: 'A2',
    dependencies: ['Word Order - Main Clause (Hauptsatz)']
  },
  {
    title: 'Temporal Prepositions (Temporale Präpositionen)',
    description: 'Prepositions for time expressions: am, im, um, von...bis, seit, vor.',
    guide:
      '# Temporal Prepositions\n\nCommon prepositions for time expressions:\n- **am** Montag, **im** Januar, **um** 8 Uhr\n- **von** 9 **bis** 17 Uhr\n- **seit** gestern, **vor** einer Woche\n\n### Examples\n- Ich arbeite **von** Montag **bis** Freitag.\n- **Seit** einem Jahr lerne ich Deutsch.',
    ruleType: 'time_expression',
    targetForms: ['am', 'im', 'um', 'seit', 'vor', 'bis'],
    level: 'A2',
    dependencies: ['Dative Prepositions', 'Numbers and Time Expressions']
  },
  {
    title: 'Verbs with Dative Objects',
    description:
      'Certain verbs that require a dative object instead of accusative: helfen, gefallen, gehören, etc.',
    guide:
      '# Verbs with a Dative Object\n\nCertain verbs require a Dative object instead of an Akkusativ: **helfen, danken, gefallen, gehören, gratulieren, schmecken** …\n\n### Examples\n- Ich **helfe** **dem Mann**.\n- Das Kleid **gefällt** **ihr**.',
    ruleType: 'verb_conjugation',
    targetForms: ['helfen', 'gefallen', 'gehören', 'danken'],
    level: 'A2',
    dependencies: ['Dative Case (Dativ)']
  },
  {
    title: 'Word Order with Two Objects',
    description: 'When a sentence has both dative and accusative objects.',
    guide:
      '# Word Order with Dative and Accusative Objects\n\nWhen both a Dative and an Akkusativ object appear in the same sentence, the **Dative usually comes before the Akkusativ** — especially with pronouns.\n\n### Examples\n- Ich gebe **dir** (Dat.) **das Buch** (Akk.).\n- Ich gebe **es** (Akk.) **dem Mann** (Dat.) when the Akkusativ object is a pronoun.',
    ruleType: 'word_order',
    targetForms: ['dative-before-accusative'],
    level: 'A2',
    dependencies: ['Verbs with Dative Objects', 'Accusative Case (Akkusativ)']
  },
  {
    title: 'Adverbs of Frequency and Time',
    description:
      'Common time adverbs and their placement: immer, oft, manchmal, selten, nie, schon, noch, gerade, bald.',
    guide:
      '# Adverbs of Frequency and Time\n\nCommon adverbs: **immer, oft, manchmal, selten, nie, schon, noch, gerade, bald**.\n\nThey typically appear in the middle field of the sentence, before the main verb or at the end.\n\n- Ich gehe **oft** ins Kino.\n- Er ist **nie** pünktlich.',
    ruleType: 'time_expression',
    targetForms: ['immer', 'oft', 'manchmal', 'selten', 'nie'],
    level: 'A2',
    dependencies: ['Word Order - Main Clause (Hauptsatz)']
  },
  {
    title: '"es gibt" Construction',
    description:
      '"Es gibt" + Accusative is used to express existence or availability (There is/are). E.g., Es gibt einen Park hier.',
    guide:
      '# The "es gibt" Construction\n\n**es gibt** + Akkusativ expresses existence or availability (there is/are).\n\n### Examples\n- **Es gibt** einen Park hier.\n- **Es gibt** viele gute Restaurants in der Stadt.',
    ruleType: 'verb_conjugation',
    targetForms: ['es gibt'],
    level: 'A2',
    dependencies: ['Accusative Case (Akkusativ)']
  },

  // ===== B1 Rules =====
  {
    title: 'Perfect Tense (Perfekt)',
    description:
      'Used for spoken past tense. Formed with "haben" or "sein" and the past participle.',
    guide:
      '# Perfekt\n\nThe **Perfekt** is the most important past tense in spoken German. It consists of an auxiliary verb (**haben/sein**) + Partizip II.\n\n### Examples\n- Ich **habe** das Buch **gelesen**.\n- Er **ist** nach Berlin **gefahren**.\n\n> **Note:** Verbs of motion and change of state mostly take **sein**; most other verbs take **haben**.',
    ruleType: 'verb_auxiliary',
    targetForms: ['haben + Partizip II', 'sein + Partizip II', 'ge-'],
    level: 'A2',
    dependencies: ['Sein, Haben, Werden - Conjugation', 'Separable Verbs (Trennbare Verben)']
  },
  {
    title: 'Simple Past (Präteritum)',
    description: 'Used primarily in written past tense for storytelling and formal reports.',
    guide:
      '# Präteritum (Simple Past)\n\nThe **Präteritum** is used primarily in written language (reports, stories). Some verbs (sein, haben, modal verbs) are also common in the Präteritum in everyday speech.\n\n### Examples\n- Er **war** müde.\n- Wir **hatten** keine Zeit.\n- Sie **konnte** gut schwimmen.',
    ruleType: 'verb_conjugation',
    targetForms: ['war', 'hatte', 'wurde', 'konnte'],
    level: 'B1',
    dependencies: ['Perfect Tense (Perfekt)']
  },
  {
    title: 'Subordinate Clauses (Nebensätze)',
    description:
      'Clauses introduced by conjunctions like "dass", "weil", "wenn", where the conjugated verb moves to the end.',
    guide:
      '# Subordinate Clauses (Nebensätze)\n\nSubordinate clauses are introduced by subordinating conjunctions (dass, weil, wenn, ob …). In subordinate clauses the **conjugated verb goes to the end**.\n\n- Ich glaube, **dass** er heute **kommt**.\n- Wir bleiben zu Hause, **weil** es **regnet**.',
    ruleType: 'word_order',
    targetForms: ['verb-final'],
    level: 'B1',
    dependencies: ['Subordinating Conjunctions (Subjunktionen)']
  },
  {
    title: 'Passive Voice (Passiv) - Present',
    description:
      'Focuses on the action rather than the doer. Formed with "werden" + past participle.',
    guide:
      '# Passive Voice – Present (Passiv Präsens)\n\nIn the **process passive** the action is in the foreground, not the actor.\n\n### Formation\n**werden** (conjugated) + Partizip II\n\n- Das Haus **wird gebaut**.\n- Die Briefe **werden geschrieben**.',
    ruleType: 'verb_auxiliary',
    targetForms: ['wird + Partizip II'],
    level: 'B1',
    dependencies: ['Sein, Haben, Werden - Conjugation', 'Perfect Tense (Perfekt)']
  },
  {
    title: 'Relative Clauses (Relativsätze)',
    description:
      'Clauses used to provide more info about a noun, using relative pronouns (der, die, das) with the verb at the end.',
    guide:
      '# Relative Clauses (Relativsätze)\n\nRelative clauses provide additional information about a noun. They are introduced by relative pronouns (der, die, das, dem, den …); the verb goes to the end.\n\n- Das ist der Mann, **der** neben mir **wohnt**.\n- Ich kenne die Frau, **die** dort **steht**.',
    ruleType: 'word_order',
    targetForms: ['der', 'die', 'das', 'dem', 'den'],
    level: 'B1',
    dependencies: ['Subordinate Clauses (Nebensätze)', 'Personal Pronouns in Accusative and Dative']
  },
  {
    title: 'Genitive Case (Genitiv)',
    description:
      'Used to show possession or after certain prepositions (wegen, während). Often replaced by "von + Dativ" in spoken German.',
    guide:
      '# Genitive Case (Genitiv)\n\nThe **Genitiv** expresses possession, but in spoken German it is often replaced by **von + Dativ**.\n\n- das Auto **des** Mannes (= das Auto von dem Mann)\n- das Ende **des** Tages',
    ruleType: 'case_marking',
    targetForms: ['des', 'der', '-s suffix'],
    level: 'B1',
    dependencies: ['Dative Case (Dativ)']
  },
  {
    title: 'Future I (Futur I)',
    description: 'Used for intentions and predictions. Formed with "werden" + infinitive.',
    guide:
      '# Future I (Futur I)\n\n**Futur I** expresses the future or assumptions.\n\n### Formation\n**werden** (conjugated) + Infinitive\n\n- Ich **werde** morgen arbeiten.\n- Er **wird** schon recht haben.',
    ruleType: 'verb_auxiliary',
    targetForms: ['werden + Infinitiv'],
    level: 'B1',
    dependencies: ['Sein, Haben, Werden - Conjugation']
  },
  {
    title: 'Infinitive Clauses with "zu" (Infinitivsätze)',
    description:
      'Clauses using "zu" + infinitive, often after verbs like versuchen, anfangen, aufhören, or with "um...zu" (in order to), "ohne...zu" (without), "anstatt...zu" (instead of).',
    guide:
      '# Infinitive Clauses with **zu**\n\nAfter certain verbs or phrases **zu + Infinitiv** is used. Also common in constructions such as **um ... zu**, **ohne ... zu**, **anstatt ... zu**.\n\n- Ich versuche, **mehr zu lernen**.\n- Er geht zur Arbeit, **ohne zu frühstücken**.',
    ruleType: 'word_order',
    targetForms: ['zu + Infinitiv', 'um...zu', 'ohne...zu'],
    level: 'B1',
    dependencies: ['Subordinate Clauses (Nebensätze)']
  },
  {
    title: 'Indirect Questions (Indirekte Fragen)',
    description:
      'Questions embedded in a sentence using "ob" (whether) or a W-word, with the verb at the end: Ich weiß nicht, ob er kommt.',
    guide:
      '# Indirect Questions\n\nIndirect questions are formed with an introductory word (**ob** or a W-word) followed by a subordinate clause with the verb at the end.\n\n- Ich weiß nicht, **ob** er **kommt**.\n- Kannst du mir sagen, **wann** der Zug **ankommt**?',
    ruleType: 'question_formation',
    targetForms: ['ob', 'W-word + verb-final'],
    level: 'B1',
    dependencies: ['W-Questions (W-Fragen)', 'Subordinate Clauses (Nebensätze)']
  },
  {
    title: 'Conjunctive Adverbs (Konjunktionaladverbien)',
    description:
      'Adverbs that connect clauses and cause verb-subject inversion: deshalb, trotzdem, deswegen, außerdem, stattdessen, dennoch.',
    guide:
      '# Conjunctive Adverbs (Konjunktionaladverbien)\n\nWords like **deshalb, trotzdem, deswegen, außerdem, dennoch** connect sentences and usually stand at position 1, followed by inversion (verb in second position, subject after).\n\n- Es regnet, **deshalb** bleibe ich zu Hause.\n- Er war müde, **trotzdem** ging er arbeiten.',
    ruleType: 'conjunction',
    targetForms: ['deshalb', 'trotzdem', 'deswegen', 'außerdem'],
    level: 'B1',
    dependencies: [
      'Coordinating Conjunctions (Konjunktionen)',
      'Word Order - Main Clause (Hauptsatz)'
    ]
  },
  {
    title: 'Passive Voice - Past Tenses (Passiv Perfekt/Präteritum)',
    description:
      'Passive in Perfekt: "sein" + past participle + "worden" (Es ist gebaut worden). Passive in Präteritum: "wurde" + past participle.',
    guide:
      '# Passive Voice – Past Tenses\n\n- **Perfekt**: sein (present) + Partizip II + **worden** → *Es ist gebaut worden.*\n- **Präteritum**: werden (Präteritum) + Partizip II → *Es wurde gebaut.*',
    ruleType: 'verb_auxiliary',
    targetForms: ['wurde + Partizip II', 'worden'],
    level: 'B1',
    dependencies: ['Passive Voice (Passiv) - Present', 'Simple Past (Präteritum)']
  },
  {
    title: 'Verbs with Prepositional Objects (Verben mit Präpositionalobjekt)',
    description:
      'Verbs requiring a specific preposition: warten auf, sich freuen über/auf, denken an, sich interessieren für, Angst haben vor, etc.',
    guide:
      '# Verbs with Prepositional Objects\n\nCertain verbs are fixed with a specific preposition: **warten auf, denken an, sich freuen über/auf, Angst haben vor**, etc.\n\n- Ich **warte auf** den Bus.\n- Sie **denkt an** ihre Freunde.',
    ruleType: 'preposition',
    targetForms: ['warten auf', 'denken an', 'sich freuen über'],
    level: 'B1',
    dependencies: ['Accusative Prepositions', 'Dative Prepositions']
  },
  {
    title: 'Da-Compounds (Da-Komposita)',
    description:
      'Replacing "preposition + pronoun" for things (not people) with da(r)- + preposition: darauf, damit, darüber, dafür, daran, etc.',
    guide:
      '# Da-Compounds (Da-Komposita)\n\nInstead of "preposition + es/das", **da(r) + preposition** is commonly used: **darauf, daran, damit, darüber** …\n\n- Ich warte **darauf**. (= auf das Ergebnis)\n- Er freut sich **darüber**.',
    ruleType: 'pronoun',
    targetForms: ['darauf', 'damit', 'darüber', 'dafür', 'daran'],
    level: 'B1',
    dependencies: ['Verbs with Prepositional Objects (Verben mit Präpositionalobjekt)']
  },
  {
    title: 'Wo-Compounds (Wo-Komposita)',
    description:
      'Question words for prepositional objects referring to things: worauf, womit, worüber, wofür, woran, etc.',
    guide:
      '# Wo-Compounds (Wo-Komposita)\n\nQuestions about prepositional objects referring to things are formed with **wo(r) + preposition**: **worauf, womit, woran, wofür** …\n\n- **Worauf** wartest du?\n- **Womit** fängst du an?',
    ruleType: 'question_formation',
    targetForms: ['worauf', 'womit', 'woran', 'wofür'],
    level: 'B1',
    dependencies: ['Da-Compounds (Da-Komposita)']
  },
  {
    title: 'Konjunktiv II - Common Forms',
    description:
      'Basic subjunctive for politeness and wishes: hätte, wäre, könnte, würde + infinitive. "Ich hätte gern..." / "Könnten Sie...?"',
    guide:
      '# Konjunktiv II – Common Forms\n\nThe **Konjunktiv II** expresses wishes, unreal situations, and politeness.\n\n- **hätte, wäre, könnte, müsste, dürfte, wollte, sollte**\n\n### Examples\n- Ich **hätte** gern einen Kaffee.\n- **Könnten** Sie mir helfen?',
    ruleType: 'verb_conjugation',
    targetForms: ['hätte', 'wäre', 'könnte', 'würde'],
    level: 'B1',
    dependencies: ['Simple Past (Präteritum)']
  },
  {
    title: '"lassen" (to let / to have something done)',
    description:
      'Used with an infinitive to mean "to let/allow" (Lass mich gehen) or "to have something done" (Ich lasse mein Auto reparieren).',
    guide:
      '# lassen\n\n**lassen** can mean:\n- to let / to allow: *Lass mich gehen!*\n- to have something done: *Ich lasse mein Auto reparieren.*\n\nStructure: **lassen** (conjugated) + object + infinitive.',
    ruleType: 'modal_verb',
    targetForms: ['lassen + Infinitiv'],
    level: 'B1',
    dependencies: ['Modal Verbs (Modalverben)']
  },
  {
    title: 'Genitive Prepositions',
    description:
      'Prepositions that take the genitive case: wegen, während, trotz, (an)statt, innerhalb, außerhalb, aufgrund.',
    guide:
      '# Genitive Prepositions\n\nThese prepositions require the **Genitiv**: **wegen, während, trotz, (an)statt, innerhalb, außerhalb, aufgrund**.\n\n- **Wegen** des Wetters bleiben wir zu Hause.\n- **Trotz** des Regens gehen wir spazieren.',
    ruleType: 'preposition',
    targetForms: ['wegen', 'während', 'trotz', 'statt', 'aufgrund'],
    level: 'B1',
    dependencies: ['Genitive Case (Genitiv)']
  },

  // ===== B2 Rules =====
  {
    title: 'Plusquamperfekt (Past Perfect)',
    description:
      'Used to describe an action that happened before another past action. Formed with Präteritum of "haben/sein" + past participle.',
    guide:
      '# Past Perfect (Plusquamperfekt)\n\nThe **Plusquamperfekt** expresses the past-before-the-past — something had already happened before something else occurred.\n\n### Formation\nPräteritum of **haben/sein** + Partizip II\n\n- Ich **hatte gegessen**, bevor ich ging.\n- Er **war angekommen**, als der Unterricht begann.',
    ruleType: 'verb_auxiliary',
    targetForms: ['hatte + Partizip II', 'war + Partizip II'],
    level: 'B2',
    dependencies: ['Simple Past (Präteritum)', 'Perfect Tense (Perfekt)']
  },
  {
    title: 'Konjunktiv II (Subjunctive II) - Present',
    description:
      'Used for unreal situations, wishes, and polite requests. Often formed with "würde" + infinitive.',
    guide:
      '# Konjunktiv II – Present\n\nExpresses unreal present situations or wishes.\n\n- **würde + Infinitiv** (würde machen, würde gehen)\n- distinct forms for strong verbs (käme, ginge, sähe …)\n\n*Wenn ich Zeit hätte, würde ich mehr lesen.*',
    ruleType: 'verb_conjugation',
    targetForms: ['würde + Infinitiv', 'käme', 'ginge'],
    level: 'B2',
    dependencies: ['Konjunktiv II - Common Forms']
  },
  {
    title: 'Konjunktiv II (Subjunctive II) - Past',
    description:
      'Expresses unreal conditions in the past: "hätte/wäre" + past participle. E.g., Wenn ich das gewusst hätte, wäre ich gekommen.',
    guide:
      '# Konjunktiv II – Past\n\nStructure: **hätte/wäre + Partizip II**\n\n- Wenn ich das **gewusst hätte**, **wäre** ich **gekommen**.\n\nExpresses unreal or missed possibilities in the past.',
    ruleType: 'verb_conjugation',
    targetForms: ['hätte + Partizip II', 'wäre + Partizip II'],
    level: 'B2',
    dependencies: ['Konjunktiv II (Subjunctive II) - Present', 'Plusquamperfekt (Past Perfect)']
  },
  {
    title: 'N-Declension (N-Deklination)',
    description:
      'Specific masculine nouns that take an "-n" or "-en" ending in all cases except Nominative singular.',
    guide:
      '# N-Declension (N-Deklination)\n\nCertain masculine nouns take a **-n/-en** ending in all cases except the Nominative singular: **der Student – des Studenten – dem Studenten – den Studenten**.\n\nOther examples: der Junge, der Kunde, der Kollege, der Herr.',
    ruleType: 'case_marking',
    targetForms: ['-en suffix masculine nouns'],
    level: 'B2',
    dependencies: ['Accusative Case (Akkusativ)', 'Dative Case (Dativ)']
  },
  {
    title: 'Modal Particles (Modalpartikeln)',
    description:
      'Small words (doch, ja, mal, halt, eben, schon, wohl) that convey emotion or emphasis but have no direct translation.',
    guide:
      '# Modal Particles (Modalpartikeln)\n\nWords such as **doch, ja, mal, halt, eben, schon, wohl** add emotional colouring to a statement but have no direct translation.\n\n- Komm **doch** mal her!\n- Das ist **ja** interessant.',
    ruleType: 'conjunction',
    targetForms: ['doch', 'ja', 'mal', 'halt', 'eben', 'wohl'],
    level: 'B2',
    dependencies: ['Word Order - Main Clause (Hauptsatz)']
  },
  {
    title: 'Future II (Futur II)',
    description:
      'Expresses a completed action in the future or a past assumption. Formed with "werden" + past participle + "haben/sein". E.g., Er wird das Buch gelesen haben.',
    guide:
      '# Future II (Futur II)\n\n**Futur II** expresses assumptions about the past or a completed action in the future.\n\n- Er **wird** das Buch bis morgen **gelesen haben**.',
    ruleType: 'verb_auxiliary',
    targetForms: ['werden + Partizip II + haben/sein'],
    level: 'B2',
    dependencies: ['Future I (Futur I)', 'Perfect Tense (Perfekt)']
  },
  {
    title: 'Passive with Modal Verbs',
    description:
      'Combining passive voice with modal verbs: modal + past participle + "werden". E.g., Das muss sofort erledigt werden (That must be taken care of immediately).',
    guide:
      '# Passive with Modal Verbs\n\nStructure: **modal verb (conjugated) + Partizip II + werden (infinitive)**\n\n- Das muss **sofort erledigt werden**.\n- Die Aufgabe kann **morgen gemacht werden**.',
    ruleType: 'verb_auxiliary',
    targetForms: ['modal + Partizip II + werden'],
    level: 'B2',
    dependencies: ['Passive Voice (Passiv) - Present', 'Modal Verbs (Modalverben)']
  },
  {
    title: 'Subjective Meaning of Modal Verbs',
    description:
      'Modal verbs used to express assumptions or probability: Er muss krank sein (He must be sick). Sie soll reich sein (She is said to be rich).',
    guide:
      '# Subjective Meaning of Modal Verbs\n\nModal verbs can also express assumptions:\n- Er **muss** krank sein. (strong assumption)\n- Er **kann** krank sein. (possibility)\n- Er **soll** reich sein. (it is said that …)',
    ruleType: 'modal_verb',
    targetForms: ['muss', 'kann', 'soll', 'dürfte'],
    level: 'B2',
    dependencies: ['Modal Verbs (Modalverben)']
  },
  {
    title: '"je...desto/umso" Comparisons',
    description:
      'Proportional comparison: "Je" + comparative + subordinate clause, "desto/umso" + comparative + main clause. E.g., Je mehr ich lerne, desto besser werde ich.',
    guide:
      '# je ... desto/umso\n\n**je ... desto/umso** expresses proportional comparisons.\n\n- **Je** mehr ich lerne, **desto** besser werde ich.\n- **Je** früher du kommst, **umso** mehr können wir vorbereiten.',
    ruleType: 'comparison',
    targetForms: ['je', 'desto', 'umso'],
    level: 'B2',
    dependencies: [
      'Comparative and Superlative (Komparativ und Superlativ)',
      'Subordinate Clauses (Nebensätze)'
    ]
  },
  {
    title: 'Double Connectors (Doppelkonjunktionen)',
    description:
      'Two-part connectors: sowohl...als auch, weder...noch, entweder...oder, nicht nur...sondern auch, zwar...aber.',
    guide:
      '# Double Connectors (Doppelkonjunktionen)\n\nCommon two-part connectors:\n- **sowohl ... als auch**\n- **weder ... noch**\n- **entweder ... oder**\n- **nicht nur ... sondern auch**\n- **zwar ... aber**\n\nThey connect two parallel clause elements or sentences.',
    ruleType: 'conjunction',
    targetForms: ['sowohl...als auch', 'weder...noch', 'entweder...oder'],
    level: 'B2',
    dependencies: ['Coordinating Conjunctions (Konjunktionen)']
  },
  {
    title: 'Extended Relative Clauses',
    description:
      'Relative clauses with "was" (after indefinite pronouns/superlatives), "wo" (for places), and "wer" (whoever).',
    guide:
      '# Extended Relative Clauses\n\nSpecial relative pronouns:\n- **was** after indefinite pronouns/superlatives (*alles, was …*; *das Beste, was …*)\n- **wer**, **wo** in certain fixed expressions.',
    ruleType: 'word_order',
    targetForms: ['was', 'wo', 'wer'],
    level: 'B2',
    dependencies: ['Relative Clauses (Relativsätze)']
  },
  {
    title: 'Statal Passive (Zustandspassiv)',
    description:
      'Describes a state resulting from a completed action, formed with "sein" + past participle: Die Tür ist geöffnet.',
    guide:
      '# Statal Passive (Zustandspassiv)\n\nDescribes a result or state: **sein + Partizip II**.\n\n- Die Tür **ist geöffnet**. (It is open.)\n- Das Fenster **ist geschlossen**.',
    ruleType: 'verb_auxiliary',
    targetForms: ['sein + Partizip II'],
    level: 'B2',
    dependencies: ['Passive Voice (Passiv) - Present']
  },
  {
    title: 'Verb-Noun Combinations (Nomen-Verb-Verbindungen)',
    description:
      'Fixed expressions where a noun and verb form a set phrase: eine Entscheidung treffen, in Betracht ziehen.',
    guide:
      '# Verb-Noun Combinations (Nomen-Verb-Verbindungen)\n\nFixed combinations such as **eine Entscheidung treffen, in Betracht ziehen, zur Verfügung stellen** are typical of formal language.\n\nThey often function like a simple verb (entscheiden, betrachten, bereitstellen).',
    ruleType: 'verb_conjugation',
    targetForms: ['eine Entscheidung treffen', 'in Betracht ziehen'],
    level: 'B2',
    dependencies: ['Verbs with Prepositional Objects (Verben mit Präpositionalobjekt)']
  },

  // ===== C1 Rules =====
  {
    title: 'Konjunktiv I (Subjunctive I)',
    description:
      'Used primarily in indirect speech (indirekte Rede), especially in journalism and formal writing.',
    guide:
      '# Konjunktiv I\n\nThe **Konjunktiv I** is used primarily in indirect speech to signal distance from the reported content.\n\n- Er sagt, er **habe** keine Zeit.\n- Sie behauptet, sie **sei** krank.',
    ruleType: 'verb_conjugation',
    targetForms: ['habe', 'sei', 'könne', 'werde'],
    level: 'C1',
    dependencies: ['Konjunktiv II (Subjunctive II) - Present']
  },
  {
    title: 'Partizipialattribute (Participial Attributes)',
    description:
      'Extended adjective phrases built from present or past participles, placed before the noun.',
    guide:
      '# Participial Attributes (Partizipialattribute)\n\nParticiples can stand before a noun like adjectives and form extended attributes:\n\n- der **in Berlin geborene** Schriftsteller\n- die **am Schalter wartenden** Kunden',
    ruleType: 'adjective',
    targetForms: ['present participle', 'past participle as adjective'],
    level: 'C1',
    dependencies: ['Relative Clauses (Relativsätze)', 'Adjective Endings (Adjektivdeklination)']
  },
  {
    title: 'Nominalization (Nominalisierung)',
    description:
      'Transforming verbs or adjectives into nouns, often used in scientific or formal language.',
    guide:
      '# Nominalization (Nominalisierung)\n\nVerbs and adjectives are turned into nouns, often in formal language:\n\n- **das Lesen** (from lesen)\n- **die Verbesserung** (from verbessern)\n- **die Schnelligkeit** (from schnell)',
    ruleType: 'noun_gender',
    targetForms: ['das + verb', '-ung', '-heit', '-keit'],
    level: 'C1',
    dependencies: ['Genitive Case (Genitiv)', 'Noun Gender (Genus)']
  },
  {
    title: 'Functional Verb Structures (Funktionsverbgefüge)',
    description: 'Fixed verb-noun combinations where the verb has a reduced meaning.',
    guide:
      '# Functional Verb Structures (Funktionsverbgefüge)\n\nConstructions such as **zur Anwendung kommen, in Kraft treten, eine Entscheidung treffen** combine a relatively content-light verb with a noun.\n\nThey are typical of official and technical language.',
    ruleType: 'verb_conjugation',
    targetForms: ['zur Anwendung kommen', 'in Kraft treten'],
    level: 'C1',
    dependencies: ['Verb-Noun Combinations (Nomen-Verb-Verbindungen)']
  },
  {
    title: 'Complex Sentence Connectors',
    description:
      'Advanced connectors for formal writing: indem, sofern, insofern als, es sei denn, geschweige denn.',
    guide:
      '# Complex Sentence Connectors\n\nConnectors such as **indem, sofern, insofern als, es sei denn, geschweige denn** allow precise logical relationships to be expressed.\n\n- **Indem** er viel liest, verbessert er sein Deutsch.',
    ruleType: 'conjunction',
    targetForms: ['indem', 'sofern', 'es sei denn', 'geschweige denn'],
    level: 'C1',
    dependencies: ['Subordinate Clauses (Nebensätze)']
  },
  {
    title: 'Passive Alternatives (Passiversatzformen)',
    description:
      'Structures that replace passive: "sich lassen" + infinitive, "sein + zu + Infinitiv", "-bar" adjectives.',
    guide:
      '# Passive Alternatives (Passiversatzformen)\n\nInstead of the passive, the following are commonly used:\n- **sein + zu + Infinitiv** (*Das ist zu vermeiden.*)\n- **sich lassen + Infinitiv** (*Die Tür lässt sich nicht öffnen.*)\n- **-bar/-lich** adjectives (*trinkbar, essbar*).',
    ruleType: 'verb_auxiliary',
    targetForms: ['sein + zu + Infinitiv', 'sich lassen', '-bar'],
    level: 'C1',
    dependencies: ['Passive Voice (Passiv) - Present']
  },
  {
    title: 'Subjective Modal Verbs in Past',
    description: 'Modal verbs expressing past assumptions: Er muss krank gewesen sein.',
    guide:
      '# Subjective Modal Verbs in the Past\n\nCombination of modal verb + **gewesen/gehabt** + Partizip II:\n- Er **muss krank gewesen sein**.\n- Sie **kann das gewusst haben**.',
    ruleType: 'modal_verb',
    targetForms: ['muss gewesen sein', 'kann gehabt haben'],
    level: 'C1',
    dependencies: ['Subjective Meaning of Modal Verbs', 'Plusquamperfekt (Past Perfect)']
  },
  {
    title: 'Concessive Clauses and Structures',
    description: 'Expressing concession beyond "obwohl": wenn...auch, so...auch, wie...auch immer.',
    guide:
      '# Concessive Structures\n\nBeyond **obwohl**, expressions such as **wenn auch, so ... auch, wie ... auch immer** are used to convey concession.\n\n- **Wenn auch** das Wetter schlecht ist, gehen wir spazieren.',
    ruleType: 'conjunction',
    targetForms: ['wenn auch', 'so...auch', 'wie...auch immer'],
    level: 'C1',
    dependencies: ['Subordinate Clauses (Nebensätze)']
  },
  {
    title: 'Appositional Constructions (Appositionen)',
    description:
      'Parenthetical explanations inserted into sentences. The apposition matches the case of the noun it modifies.',
    guide:
      '# Appositional Constructions (Appositionen)\n\nAn **apposition** is a supplementary phrase added to a noun and agrees with it in case:\n\n- Frau Müller, **unsere Nachbarin**, kommt mit.\n- Berlin, **die Hauptstadt Deutschlands**, ist groß.',
    ruleType: 'word_order',
    targetForms: ['comma-delimited apposition'],
    level: 'C1',
    dependencies: ['Relative Clauses (Relativsätze)']
  },
  {
    title: 'Expanded Prepositional Phrases',
    description: 'Complex prepositional expressions used in formal/academic language.',
    guide:
      '# Expanded Prepositional Phrases\n\nIn written language, complex prepositions appear: **im Hinblick auf, in Bezug auf, mit Hilfe von, im Rahmen von**, etc.\n\nThey structure texts and lines of argument.',
    ruleType: 'preposition',
    targetForms: ['im Hinblick auf', 'in Bezug auf', 'im Rahmen von'],
    level: 'C1',
    dependencies: ['Genitive Prepositions', 'Dative Prepositions']
  },

  // ===== C2 Rules =====
  {
    title: 'Konjunktiv I - Past (Vergangenheit)',
    description:
      'Past forms of Konjunktiv I for indirect speech: Er sagte, er habe das Buch gelesen.',
    guide:
      '# Konjunktiv I – Past\n\nIndirect speech in the past is often formed with the **Konjunktiv I** of *haben/sein* + Partizip II:\n\n- Er sagte, er **habe das Buch gelesen**.',
    ruleType: 'verb_conjugation',
    targetForms: ['habe + Partizip II', 'sei + Partizip II'],
    level: 'C2',
    dependencies: ['Konjunktiv I (Subjunctive I)']
  },
  {
    title: 'Archaic and Literary Konjunktiv II Forms',
    description:
      'Using original Konjunktiv II forms instead of "würde" + infinitive in literary contexts.',
    guide:
      '# Archaic and Literary Konjunktiv II\n\nIn literary language, original subjunctive forms appear instead of "würde + Infinitiv":\n\n- ich **führe**, ich **spräche**, ich **ginge** …',
    ruleType: 'verb_conjugation',
    targetForms: ['führe', 'spräche', 'ginge'],
    level: 'C2',
    dependencies: ['Konjunktiv II (Subjunctive II) - Present']
  },
  {
    title: 'Complex Participial Constructions',
    description: 'Heavily nested participial attributes common in academic/legal writing.',
    guide:
      '# Complex Participial Constructions\n\nEspecially in legal and academic texts, very long participial attributes are used to condense information.',
    ruleType: 'adjective',
    targetForms: ['nested participial attributes'],
    level: 'C2',
    dependencies: ['Partizipialattribute (Participial Attributes)']
  },
  {
    title: 'Rhetorical and Stylistic Devices',
    description:
      'Advanced rhetorical structures: inversion for emphasis, deliberate word-order variation.',
    guide:
      '# Rhetorical and Stylistic Devices\n\nTo vary style and effect, inversion, parallelism, repetition, and other devices are used. At C2 level these effects are employed deliberately.',
    ruleType: 'word_order',
    targetForms: ['inversion', 'parallelism'],
    level: 'C2',
    dependencies: ['Complex Sentence Connectors']
  },
  {
    title: 'Register and Style Variation',
    description:
      'Mastering transitions between registers: colloquial, standard, formal/written, and academic.',
    guide:
      '# Register and Style Variation\n\nAt C2 level one can switch flexibly between colloquial, standard, formal, and academic language, deliberately adapting style to the situation and audience.',
    ruleType: 'word_order',
    targetForms: ['register shift'],
    level: 'C2',
    dependencies: ['Rhetorical and Stylistic Devices']
  },
  {
    title: 'Idiomatic Expressions (Redewendungen)',
    description: 'Fixed idiomatic phrases whose meaning cannot be derived from individual words.',
    guide:
      '# Idiomatic Expressions (Redewendungen)\n\nFixed expressions such as **ins Bett gehen, auf dem Holzweg sein, jemandem die Daumen drücken** carry a figurative meaning that cannot be derived literally. They are characteristic of a very high language level.',
    ruleType: 'conjunction',
    targetForms: ['fixed idiom phrases'],
    level: 'C2',
    dependencies: ['Subordinate Clauses (Nebensätze)']
  }
];

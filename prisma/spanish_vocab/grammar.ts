export const spanishGrammarRules = [
  // ===== A1 Rules =====
  {
    title: 'Subject Pronouns (Pronombres Personales)',
    description: 'The use of yo, tú, él, ella, usted, nosotros, vosotros, ellos, ellas, ustedes.',
    guide:
      '# Subject Pronouns\n\nSubject pronouns replace the subject noun in a sentence. In Spanish, they are often omitted because the verb ending already indicates the subject.\n\n### Forms:\n*   **yo** (I)\n*   **tú** (you, informal singular)\n*   **él/ella/usted** (he/she/you formal singular)\n*   **nosotros/nosotras** (we)\n*   **vosotros/vosotras** (you all, informal plural - used mostly in Spain)\n*   **ellos/ellas/ustedes** (they/you all formal plural)\n\n### Examples:\n*   *(Yo) hablo español.* (I speak Spanish.)\n*   *¿(Tú) eres de México?* (Are you from Mexico?)',
    ruleType: 'pronoun',
    targetForms: ['yo', 'tú', 'él', 'ella', 'nosotros', 'ellos'],
    level: 'A1',
    dependencies: []
  },
  {
    title: 'Noun Gender and Plurals',
    description: 'Understanding masculine/feminine nouns and how to form plurals.',
    guide:
      '# Noun Gender and Plurals\n\n### Gender\nAll Spanish nouns have a grammatical gender: **masculine** or **feminine**.\n*   Generally, nouns ending in **-o** are masculine (el chico, el libro).\n*   Generally, nouns ending in **-a** are feminine (la chica, la mesa).\n*   Exceptions exist (el mapa, la mano, el problema).\n\n### Plurals\n*   If a noun ends in a vowel, add **-s** (chico → chicos).\n*   If a noun ends in a consonant, add **-es** (papel → papeles).\n*   If a noun ends in **-z**, change to **-c** and add **-es** (lápiz → lápices).',
    ruleType: 'noun_gender',
    targetForms: ['-o masculine', '-a feminine', '-s plural'],
    level: 'A1',
    dependencies: []
  },
  {
    title: 'Definite and Indefinite Articles',
    description: 'The use of el, la, los, las, un, una, unos, unas.',
    guide:
      '# Articles\n\nArticles agree in gender and number with the noun they modify.\n\n### Definite Articles (The)\n*   Masculine singular: **el**\n*   Feminine singular: **la**\n*   Masculine plural: **los**\n*   Feminine plural: **las**\n\n### Indefinite Articles (A/An/Some)\n*   Masculine singular: **un**\n*   Feminine singular: **una**\n*   Masculine plural: **unos**\n*   Feminine plural: **unas**\n\n### Examples:\n*   *el gato* (the cat)\n*   *una casa* (a house)',
    ruleType: 'article',
    targetForms: ['el', 'la', 'los', 'las', 'un', 'una'],
    level: 'A1',
    dependencies: ['Noun Gender and Plurals']
  },
  {
    title: 'Present Tense Regular Verbs (-ar, -er, -ir)',
    description: 'Conjugating regular verbs in the present tense.',
    guide:
      '# Present Tense Regular Verbs\n\nSpanish verbs belong to three categories based on their infinitive endings: **-ar**, **-er**, and **-ir**.\n\n### -AR verbs (e.g., hablar)\n*   yo habl**o**\n*   tú habl**as**\n*   él/ella/usted habl**a**\n*   nosotros habl**amos**\n*   vosotros habl**áis**\n*   ellos/ellas/ustedes habl**an**\n\n### -ER verbs (e.g., comer)\n*   yo com**o**\n*   tú com**es**\n*   él/ella/usted com**e**\n*   nosotros com**emos**\n*   vosotros com**éis**\n*   ellos/ellas/ustedes com**en**\n\n### -IR verbs (e.g., vivir)\n*   yo viv**o**\n*   tú viv**es**\n*   él/ella/usted viv**e**\n*   nosotros viv**imos**\n*   vosotros viv**ís**\n*   ellos/ellas/ustedes viv**en**',
    ruleType: 'verb_conjugation',
    targetForms: ['-ar', '-er', '-ir'],
    level: 'A1',
    dependencies: ['Subject Pronouns (Pronombres Personales)']
  },
  {
    title: 'Ser vs Estar',
    description: 'The two verbs for "to be" in Spanish.',
    guide:
      '# Ser vs Estar\n\nIn Spanish, there are two common verbs for "to be": **ser** and **estar**. They are both irregular in the present tense.\n\n### Ser (Permanent or Lasting)\n*   **Forms:** soy, eres, es, somos, sois, son\n*   **Uses (DOCTOR):** Description, Occupation, Characteristic, Time, Origin, Relationship.\n*   *Ejemplo:* Soy de España. (I am from Spain.)\n\n### Estar (Temporary or Location)\n*   **Forms:** estoy, estás, está, estamos, estáis, están\n*   **Uses (PLACE):** Position, Location, Action (present continuous), Condition, Emotion.\n*   *Ejemplo:* Estoy feliz hoy. (I am happy today.)',
    ruleType: 'verb_conjugation',
    targetForms: ['ser', 'estar', 'soy', 'estoy'],
    level: 'A1',
    dependencies: ['Subject Pronouns (Pronombres Personales)']
  },
  {
    title: 'Adjective Agreement',
    description: 'Making adjectives match the nouns they describe in gender and number.',
    guide:
      '# Adjective Agreement\n\nAdjectives must agree in **gender** (masculine/feminine) and **number** (singular/plural) with the noun they modify.\n\n*   Adjectives ending in **-o** have four forms: alto, alta, altos, altas.\n*   Adjectives ending in **-e** or a **consonant** usually have only two forms (singular/plural): inteligente, inteligentes; fácil, fáciles.\n*   Adjectives usually go **after** the noun.\n\n### Examples:\n*   el chico **alto** (the tall boy)\n*   las casas **blancas** (the white houses)',
    ruleType: 'adjective',
    targetForms: ['alto/alta', 'altos/altas'],
    level: 'A1',
    dependencies: ['Noun Gender and Plurals']
  },
  {
    title: 'Tener and Idioms with Tener',
    description: 'Conjugating the irregular verb "tener" and its special expressions.',
    guide:
      '# Tener (To Have)\n\nThe verb **tener** is irregular and very common. It is used to express possession, age, and various physical/emotional states.\n\n### Conjugation (Present):\n*   tengo, tienes, tiene, tenemos, tenéis, tienen\n\n### Idiomatic Expressions:\nIn English, we often use "to be" for these, but Spanish uses "tener" (to have):\n*   **tener años:** to be... years old (Tengo 20 años.)\n*   **tener hambre/sed:** to be hungry/thirsty\n*   **tener frío/calor:** to be cold/hot\n*   **tener miedo:** to be afraid\n*   **tener sueño:** to be sleepy',
    ruleType: 'verb_conjugation',
    targetForms: ['tengo', 'tienes', 'tiene', 'tener + noun'],
    level: 'A1',
    dependencies: ['Subject Pronouns (Pronombres Personales)']
  },
  {
    title: 'Ir and the Near Future (Ir + a + Infinitive)',
    description: 'The verb "ir" (to go) and expressing future plans.',
    guide:
      '# Ir (To Go) & Near Future\n\nThe verb **ir** is highly irregular.\n\n### Conjugation (Present):\n*   voy, vas, va, vamos, vais, van\n\n### Near Future (Ir + a + Infinitive)\nTo express something you are going to do in the future, use the formula:\n**[conjugated form of ir] + a + [infinitive verb]**\n\n### Examples:\n*   Voy al cine. (I am going to the movies.)\n*   **Voy a estudiar** mañana. (I am going to study tomorrow.)\n*   ¿Qué **vas a hacer**? (What are you going to do?)',
    ruleType: 'verb_auxiliary',
    targetForms: ['voy a', 'vas a', 'va a'],
    level: 'A1',
    dependencies: ['Present Tense Regular Verbs (-ar, -er, -ir)']
  },
  {
    title: 'Possessive Adjectives',
    description: 'Words showing ownership: mi, tu, su, nuestro, vuestro, su.',
    guide:
      '# Possessive Adjectives\n\nPossessive adjectives show ownership. They agree in number (and sometimes gender) with the **noun being possessed**, not the owner.\n\n*   **mi / mis** (my)\n*   **tu / tus** (your, informal)\n*   **su / sus** (his, her, your formal, their)\n*   **nuestro/a / nuestros/as** (our) - agrees in gender too!\n*   **vuestro/a / vuestros/as** (your all, informal) - agrees in gender too!\n\n### Examples:\n*   **Mi** libro (My book)\n*   **Mis** libros (My books)\n*   **Nuestra** casa (Our house)',
    ruleType: 'possession',
    targetForms: ['mi', 'tu', 'su', 'nuestro', 'vuestro'],
    level: 'A1',
    dependencies: ['Noun Gender and Plurals']
  },
  {
    title: 'Stem-Changing Verbs in the Present Tense',
    description: 'Verbs that have a vowel change in the stem (e→ie, o→ue, e→i).',
    guide:
      '# Stem-Changing Verbs\n\nSome verbs change a vowel in their stem in the present tense for all forms **except** nosotros and vosotros (often called "boot verbs").\n\n### 1. e → ie\n*   **Pensar** (to think): pienso, piensas, piensa, pensamos, pensáis, piensan\n*   *Other examples:* querer, cerrar, empezar, entender.\n\n### 2. o → ue\n*   **Poder** (to be able to): puedo, puedes, puede, podemos, podéis, pueden\n*   *Other examples:* dormir, volver, encontrar, jugar (u→ue).\n\n### 3. e → i\n*   **Pedir** (to ask for): pido, pides, pide, pedimos, pedís, piden\n*   *Other examples:* servir, repetir.',
    ruleType: 'verb_conjugation',
    targetForms: ['e→ie', 'o→ue', 'e→i'],
    level: 'A2',
    dependencies: ['Present Tense Regular Verbs (-ar, -er, -ir)']
  },
  {
    title: 'Reflexive Verbs',
    description: 'Verbs where the subject performs the action on itself (lavarse, levantarse).',
    guide:
      '# Reflexive Verbs\n\nReflexive verbs indicate that the subject does something to or for itself. They require reflexive pronouns.\n\n### Reflexive Pronouns:\n*   **me** (myself)\n*   **te** (yourself)\n*   **se** (himself, herself, yourself formal)\n*   **nos** (ourselves)\n*   **os** (yourselves)\n*   **se** (themselves, yourselves formal)\n\n### Conjugation (e.g., Lavarse - to wash oneself):\n*   yo **me** lavo\n*   tú **te** lavas\n*   él/ella/usted **se** lava\n*   nosotros **nos** lavamos\n*   vosotros **os** laváis\n*   ellos/ellas/ustedes **se** lavan\n\n*Note:* The pronoun goes before the conjugated verb.',
    ruleType: 'reflexive',
    targetForms: ['me', 'te', 'se', 'nos', 'os'],
    level: 'A2',
    dependencies: ['Present Tense Regular Verbs (-ar, -er, -ir)']
  },
  {
    title: 'Gustar and Similar Verbs',
    description: 'How to express likes and dislikes using "gustar".',
    guide:
      '# Gustar (To Like)\n\nThe verb **gustar** works differently than "to like" in English. It literally means "to be pleasing to".\n\nIt requires an Indirect Object Pronoun (me, te, le, nos, os, les).\n\n### Forms\n*   Use **gusta** for singular nouns or verbs (infinitives).\n*   Use **gustan** for plural nouns.\n\n### Examples:\n*   **Me gusta** la manzana. (The apple is pleasing to me / I like the apple.)\n*   **Te gustan** los libros. (The books are pleasing to you / You like the books.)\n*   **Nos gusta** cantar. (Singing is pleasing to us / We like to sing.)\n\n*Similar verbs:* encantar, importar, faltar.',
    ruleType: 'verb_conjugation',
    targetForms: ['me gusta', 'te gustan', 'le gusta', 'nos gustan'],
    level: 'A2',
    dependencies: ['Definite and Indefinite Articles', 'Subject Pronouns (Pronombres Personales)']
  },
  {
    title: 'Direct Object Pronouns (DOPs)',
    description: 'Replacing the direct object in a sentence (lo, la, los, las).',
    guide:
      '# Direct Object Pronouns\n\nA direct object receives the action of the verb directly. A Direct Object Pronoun (DOP) replaces it to avoid repetition.\n\n### Pronouns:\n*   **me** (me), **te** (you), **lo/la** (him, her, it, you formal), **nos** (us), **os** (you all), **los/las** (them, you all formal).\n\n### Placement:\n*   Before the conjugated verb.\n*   Attached to the end of an infinitive or present participle.\n\n### Examples:\n*   Compro *el libro*. → **Lo** compro. (I buy it.)\n*   Veo a *María*. → **La** veo. (I see her.)\n*   Quiero comer*lo*. (I want to eat it.)',
    ruleType: 'pronoun',
    targetForms: ['lo', 'la', 'los', 'las'],
    level: 'A2',
    dependencies: ['Present Tense Regular Verbs (-ar, -er, -ir)']
  },
  {
    title: 'Indirect Object Pronouns (IOPs)',
    description: 'Indicating to whom or for whom an action is done (le, les).',
    guide:
      '# Indirect Object Pronouns\n\nAn indirect object answers "to whom" or "for whom" the action is performed.\n\n### Pronouns:\n*   **me** (to/for me), **te** (to/for you), **le** (to/for him, her, it, you formal), **nos** (to/for us), **os** (to/for you all), **les** (to/for them, you all formal).\n\n### Examples:\n*   Yo **le** doy el regalo. (I give the gift to him/her.)\n*   Ella **nos** habla. (She speaks to us.)\n\n### Double Pronouns:\nWhen using both an IOP and DOP, the IOP goes first. If both start with \'l\' (e.g., le lo), the IOP changes to **se**.\n*   *Le doy el libro* → **Se lo** doy. (I give it to him.)',
    ruleType: 'pronoun',
    targetForms: ['me', 'te', 'le', 'nos', 'les'],
    level: 'A2',
    dependencies: ['Direct Object Pronouns (DOPs)']
  },
  {
    title: 'Saber vs Conocer',
    description: 'The two verbs for "to know".',
    guide:
      '# Saber vs Conocer\n\nSpanish has two verbs for "to know", each with distinct uses.\n\n### Saber\nTo know facts, information, or how to do something.\n*   Forms: sé, sabes, sabe, sabemos, sabéis, saben\n*   *Sé que Madrid es la capital.* (I know Madrid is the capital.)\n*   *Ella sabe nadar.* (She knows how to swim.)\n\n### Conocer\nTo know or be familiar with people, places, or things.\n*   Forms: conozco, conoces, conoce, conocemos, conocéis, conocen\n*   *Conozco a Juan.* (I know Juan.)\n*   *No conozco París.* (I don\'t know/am not familiar with Paris.)',
    ruleType: 'verb_conjugation',
    targetForms: ['saber', 'conocer', 'sé', 'conozco'],
    level: 'A2',
    dependencies: ['Present Tense Regular Verbs (-ar, -er, -ir)']
  },
  {
    title: 'Preterite Tense - Regular Verbs',
    description: 'Conjugating regular verbs in the past tense (completed actions).',
    guide:
      '# Preterite Tense (Regular)\n\nThe preterite tense is used for completed actions in the past with a definite beginning and end.\n\n### -AR Verbs (e.g., hablar)\n*   yo habl**é**\n*   tú habl**aste**\n*   él/ella/Ud. habl**ó**\n*   nosotros habl**amos**\n*   vosotros habl**asteis**\n*   ellos/ellas/Uds. habl**aron**\n\n### -ER / -IR Verbs (e.g., comer, vivir)\n*   yo com**í** / viv**í**\n*   tú com**iste** / viv**iste**\n*   él/ella/Ud. com**ió** / viv**ió**\n*   nosotros com**imos** / viv**imos**\n*   vosotros com**isteis** / viv**isteis**\n*   ellos/ellas/Uds. com**ieron** / viv**ieron**',
    ruleType: 'verb_conjugation',
    targetForms: ['-é', '-aste', '-ó', '-aron', '-ieron'],
    level: 'A2',
    dependencies: ['Present Tense Regular Verbs (-ar, -er, -ir)']
  },
  {
    title: 'Preterite Tense - Irregular Verbs',
    description: 'Common irregular verbs in the preterite (ir, ser, hacer, tener, estar).',
    guide:
      '# Preterite Tense (Irregular)\n\nMany common verbs are highly irregular in the preterite. They often share a set of irregular endings: -e, -iste, -o, -imos, -isteis, -ieron (no accents!).\n\n### Ser / Ir (Identical forms)\n*   fui, fuiste, fue, fuimos, fuisteis, fueron\n\n### Hacer (Stem: hic- / hiz-)\n*   hice, hiciste, hizo, hicimos, hicisteis, hicieron\n\n### Tener (Stem: tuv-)\n*   tuve, tuviste, tuvo, tuvimos, tuvisteis, tuvieron\n\n### Estar (Stem: estuv-)\n*   estuve, estuviste, estuvo, estuvimos, estuvisteis, estuvieron',
    ruleType: 'verb_conjugation',
    targetForms: ['fui', 'hice', 'tuve', 'estuve'],
    level: 'A2',
    dependencies: ['Preterite Tense - Regular Verbs']
  },
  {
    title: 'Imperfect Tense',
    description: 'The past tense used for ongoing actions, habits, and background descriptions.',
    guide:
      '# Imperfect Tense\n\nThe imperfect describes past habits, ongoing past actions (was/were doing), time, age, and background descriptions.\n\n### Regular -AR verbs (e.g., hablar)\n*   hablaba, hablabas, hablaba, hablábamos, hablabais, hablaban\n\n### Regular -ER/-IR verbs (e.g., comer)\n*   comía, comías, comía, comíamos, comíais, comían\n\n### Irregular Verbs (Only 3!)\n*   **Ser:** era, eras, era, éramos, erais, eran\n*   **Ir:** iba, ibas, iba, íbamos, ibais, iban\n*   **Ver:** veía, veías, veía, veíamos, veíais, veían',
    ruleType: 'verb_conjugation',
    targetForms: ['-aba', '-ía', 'era', 'iba'],
    level: 'B1',
    dependencies: ['Preterite Tense - Regular Verbs']
  },
  {
    title: 'Preterite vs Imperfect',
    description: 'Choosing between the two past tenses.',
    guide:
      '# Preterite vs Imperfect\n\nChoosing the correct past tense depends on the context.\n\n### Use Preterite for (SAFE):\n*   **S**pecific events or completed actions.\n*   **A**ction that interrupts an ongoing action.\n*   **F**ocus on beginning or end of an action.\n*   **E**nclosed amount of time.\n*   *Ayer fui a la tienda.* (Yesterday I went to the store.)\n\n### Use Imperfect for (WATERS):\n*   **W**eather.\n*   **A**ge.\n*   **T**ime.\n*   **E**motion/Condition.\n*   **R**epetition (Habits / "used to").\n*   **S**etting the scene / ongoing actions.\n*   *Hacía sol y yo estaba feliz.* (It was sunny and I was happy.)',
    ruleType: 'verb_conjugation',
    targetForms: ['preterite', 'imperfect', 'SAFE', 'WATERS'],
    level: 'B1',
    dependencies: ['Preterite Tense - Regular Verbs', 'Imperfect Tense']
  },
  {
    title: 'Por vs Para',
    description: 'The two prepositions translating to "for", "by", or "through".',
    guide:
      '# Por vs Para\n\nBoth mean "for," but they are not interchangeable.\n\n### Use PARA for (PERFECT):\n*   **P**urpose (in order to + infinitive)\n*   **E**xact date/deadline\n*   **R**ecipient (for someone)\n*   **F**uture destination\n*   **E**mployment\n*   **C**omparison\n*   **T**oward a specific place\n\n### Use POR for (ATTRACTED):\n*   **A**round a place\n*   **T**hrough a place\n*   **T**ransportation / communication (by bus, by phone)\n*   **R**eason or motive (because of)\n*   **A**fter / going to get something\n*   **C**ost / Exchange\n*   **T**hanks (Gracias por...)\n*   **E**xchange\n*   **D**uration of time',
    ruleType: 'preposition',
    targetForms: ['por', 'para'],
    level: 'B1',
    dependencies: ['Present Tense Regular Verbs (-ar, -er, -ir)']
  },
  {
    title: 'Formal Commands (Usted/Ustedes)',
    description: 'Giving orders or advice politely.',
    guide:
      '# Formal Commands (Usted/Ustedes)\n\nUsed to tell someone formally (usted/ustedes) to do or not do something.\n\n### Formation (Present Subjunctive forms):\n1.  Start with the "yo" form of the present tense (e.g., hablo, como).\n2.  Drop the -o.\n3.  Add the "opposite" ending:\n    *   **-AR verbs add **-e** (Ud.) or **-en** (Uds.).\n    *   **-ER/-IR verbs add **-a** (Ud.) or **-an** (Uds.).\n\n### Examples:\n*   Hablar → **Hable** Ud. / **Hablen** Uds.\n*   Comer → **Coma** Ud. / **Coman** Uds.\n*   Tener (tengo) → **Tenga** Ud. / **Tengan** Uds.\n\n*Negative commands:* Simply put "No" in front. (No hable Ud.)',
    ruleType: 'imperative',
    targetForms: ['-e Ud.', '-en Uds.', '-a Ud.', '-an Uds.'],
    level: 'B1',
    dependencies: [
      'Present Tense Regular Verbs (-ar, -er, -ir)',
      'Stem-Changing Verbs in the Present Tense'
    ]
  },
  {
    title: 'Informal Commands (Tú)',
    description: 'Giving orders to friends or peers.',
    guide:
      '# Informal Commands (Tú)\n\nUsed to tell a friend (tú) to do or not do something.\n\n### Affirmative Tú Commands:\nUse the **él/ella/usted** form of the present tense.\n*   Hablar → ¡**Habla**! (Speak!)\n*   Comer → ¡**Come**! (Eat!)\n*   *Irregular:* Ven, di, sal, haz, ten, ve, pon, sé.\n\n### Negative Tú Commands:\nUse the "tú" form of the Present Subjunctive (opposite endings).\n1. Yo form, drop -o.\n2. Add opposite ending + s: -AR adds **-es**, -ER/-IR adds **-as**.\n*   Hablar → ¡No **hables**! (Don\'t speak!)\n*   Comer → ¡No **comas**! (Don\'t eat!)',
    ruleType: 'imperative',
    targetForms: ['habla', 'come', 'no hables', 'no comas'],
    level: 'B1',
    dependencies: [
      'Present Tense Regular Verbs (-ar, -er, -ir)',
      'Stem-Changing Verbs in the Present Tense'
    ]
  },
  {
    title: 'Present Subjunctive Mood',
    description: 'Expressing doubt, desire, emotion, and recommendations.',
    guide:
      '# Present Subjunctive\n\nThe subjunctive is a mood used for subjectivity, doubt, wishes, and emotions. Often triggered by "WEIRDO" verbs (Wishes, Emotions, Impersonal expressions, Recommendations, Doubt, Ojalá) + "que".\n\n### Formation:\n1. Start with the "yo" form of the present indicative.\n2. Drop the -o.\n3. Add opposite endings:\n   *   **-AR:** -e, -es, -e, -emos, -éis, -en\n   *   **-ER/-IR:** -a, -as, -a, -amos, -áis, -an\n\n### Examples:\n*   (Hablar) Espero que tú **hables** español. (I hope that you speak Spanish.)\n*   (Comer) Quiero que ella **coma**. (I want her to eat.)',
    ruleType: 'verb_mood',
    targetForms: ['-e', '-es', '-a', '-amos', '-an'],
    level: 'B1',
    dependencies: [
      'Present Tense Regular Verbs (-ar, -er, -ir)',
      'Stem-Changing Verbs in the Present Tense'
    ]
  },
  {
    title: 'Future Tense',
    description: 'Conjugating verbs to express what "will" happen.',
    guide:
      '# Future Tense\n\nThe future tense is used to express what *will* happen. It is easier to form than other tenses because you keep the infinitive and add endings.\n\n### Regular Endings (Added to the INFINITIVE for all verbs):\n*   -é, -ás, -á, -emos, -éis, -án\n\n### Examples:\n*   **Hablar:** hablaré, hablarás, hablará...\n*   **Comer:** comeré, comerás, comerá...\n\n### Irregular Stems:\nSome verbs have irregular stems but use the same endings:\n*   Tener → **tendr-** (tendré)\n*   Hacer → **har-** (haré)\n*   Poder → **podr-** (podré)',
    ruleType: 'verb_conjugation',
    targetForms: ['-é', '-ás', '-á', '-emos', '-án'],
    level: 'B1',
    dependencies: ['Present Tense Regular Verbs (-ar, -er, -ir)']
  },
  {
    title: 'Conditional Tense',
    description: 'Expressing what "would" happen.',
    guide:
      '# Conditional Tense\n\nThe conditional is used to express what *would* happen under certain conditions, or to make polite requests.\n\n### Regular Endings (Added to the INFINITIVE for all verbs):\n*   -ía, -ías, -ía, -íamos, -íais, -ían\n\n### Examples:\n*   **Hablar:** hablaría, hablarías, hablaría...\n*   **Comer:** comería, comerías, comería...\n\n### Irregular Stems:\nThe conditional uses the *exact same irregular stems* as the future tense:\n*   Tener → **tendr-** (tendría)\n*   Hacer → **har-** (haría)\n*   Poder → **podr-** (podría)',
    ruleType: 'verb_conjugation',
    targetForms: ['-ía', '-ías', '-ía', '-íamos', '-ían'],
    level: 'B2',
    dependencies: ['Future Tense']
  },
  {
    title: 'Present Perfect (Pretérito Perfecto)',
    description: 'Expressing past events that are connected to the present (I have done...).',
    guide:
      '# Present Perfect\n\nThe present perfect is used to describe actions that "have happened" and are still relevant to the present.\n\n### Formation:\n**Present tense of "haber" + Past Participle**\n\n### Haber conjugations:\n*   he, has, ha, hemos, habéis, han\n\n### Past Participles:\n*   -AR verbs: drop -ar, add **-ado** (hablar → hablado)\n*   -ER/-IR verbs: drop -er/-ir, add **-ido** (comer → comido)\n\n### Example:\n*   **He comido** una manzana. (I have eaten an apple.)\n*   ¿**Has visitado** España? (Have you visited Spain?)',
    ruleType: 'verb_auxiliary',
    targetForms: ['he', 'has', 'ha', '-ado', '-ido'],
    level: 'B2',
    dependencies: ['Preterite Tense - Regular Verbs']
  },
  {
    title: 'Past Perfect (Pluscuamperfecto)',
    description: 'Expressing an action that "had happened" before another past action.',
    guide:
      '# Past Perfect (Pluscuamperfecto)\n\nUsed to express an action that happened *before* another action in the past (I had done...).\n\n### Formation:\n**Imperfect tense of "haber" + Past Participle**\n\n### Haber conjugations (Imperfect):\n*   había, habías, había, habíamos, habíais, habían\n\n### Example:\n*   Cuando llegué, ella ya **había salido**. (When I arrived, she had already left.)',
    ruleType: 'verb_auxiliary',
    targetForms: ['había', 'habías', 'había', '-ado', '-ido'],
    level: 'B2',
    dependencies: ['Present Perfect (Pretérito Perfecto)', 'Imperfect Tense']
  },
  {
    title: 'Imperfect Subjunctive',
    description: 'Subjunctive mood in the past tense.',
    guide:
      '# Imperfect Subjunctive\n\nUsed in the same situations as the present subjunctive (WEIRDO clauses), but when the main clause is in a past tense.\n\n### Formation:\n1. Find the "ellos" form of the preterite (e.g., hablaron, comieron, tuvieron).\n2. Drop the "-ron".\n3. Add the endings: **-ra, -ras, -ra, -\'ramos, -rais, -ran**.\n\n### Examples:\n*   Hablar → hablara, hablaras, hablara, habláramos, hablarais, hablaran.\n*   Tener → tuviera...\n\n*Example sentence:* Yo quería que tú **vinieras** a la fiesta. (I wanted you to come to the party.)',
    ruleType: 'verb_mood',
    targetForms: ['-ra', '-ras', '-ra', '-ramos'],
    level: 'B2',
    dependencies: ['Preterite Tense - Irregular Verbs', 'Present Subjunctive Mood']
  },
  {
    title: 'Yes/No and Wh- Questions in Spanish',
    description:
      'Forming sí/no questions and information questions with question words like qué, cuándo, dónde, por qué.',
    guide:
      '# Yes/No and Wh- Questions in Spanish\n\nSpanish questions use **inversion** and often a **question word**.\n\n### Yes/No Questions\nUsually just invert subject and verb or use rising intonation:\n*   **¿Hablas español?** (Do you speak Spanish?)\n*   **¿Comes carne?** (Do you eat meat?)\n\n### Wh- Questions (Information Questions)\nUse a question word + verb + subject:\n*   **¿Qué** comes? (What are you eating?)\n*   **¿Dónde** vives? (Where do you live?)\n*   **¿Cuándo** trabajas? (When do you work?)\n*   **¿Por qué** estudias español? (Why do you study Spanish?)\n\n> **Note:** Question words in Spanish always carry an accent in questions (qué, cuándo, dónde, cómo, por qué, etc.).',
    ruleType: 'question_formation',
    targetForms: ['¿qué?', '¿dónde?', '¿cuándo?', '¿por qué?'],
    level: 'A1',
    dependencies: [
      'Subject Pronouns (Pronombres Personales)',
      'Present Tense Regular Verbs (-ar, -er, -ir)'
    ]
  },
  {
    title: 'Present Progressive (Estar + Gerundio)',
    description: 'Describing actions that are happening right now using estar + gerund.',
    guide:
      '# Present Progressive (Estar + Gerundio)\n\nTo talk about actions happening **right now**, Spanish often uses **estar + gerundio** (similar to English "be + -ing").\n\n### Formation\n**Estar (present) + gerund**\n\n- AR verbs → -ando (hablar → hablando)\n- ER/IR verbs → -iendo (comer → comiendo, vivir → viviendo)\n\n### Examples\n*   **Estoy estudiando** español. (I am studying Spanish.)\n*   **Estamos comiendo** ahora. (We are eating now.)\n\n> It is less overused than the English -ing and not used for long-term habits.',
    ruleType: 'verb_auxiliary',
    targetForms: ['estoy', '-ando', '-iendo', 'estamos'],
    level: 'A2',
    dependencies: ['Ser vs Estar', 'Present Tense Regular Verbs (-ar, -er, -ir)']
  },
  {
    title: 'Comparatives and Superlatives in Spanish',
    description:
      'Forming comparisons with más/menos ... que and superlatives with el/la más ... de.',
    guide:
      '# Comparatives and Superlatives in Spanish\n\n### Comparatives\nTo compare two things, use **más/menos ... que** or **tan ... como**.\n\n*   Ella es **más alta que** su hermana. (She is taller than her sister.)\n*   Este libro es **menos interesante que** el otro. (This book is less interesting than the other.)\n*   Soy **tan paciente como** tú. (I am as patient as you.)\n\n### Superlatives\nUse **el/la/los/las más/menos + adjective + de**.\n\n*   Es **el más grande de** la clase. (He is the tallest in the class.)\n*   Son **las menos caras de** la tienda. (They are the least expensive in the store.)\n\nSome adjectives have irregular forms (bueno → mejor, malo → peor, grande → mayor, pequeño → menor).',
    ruleType: 'comparison',
    targetForms: ['más ... que', 'menos ... que', 'tan ... como', 'el más ... de'],
    level: 'A2',
    dependencies: ['Adjective Agreement']
  },
  {
    title: 'Adverbs ending in -mente',
    description: 'Forming manner adverbs like rápidamente, fácilmente from adjectives.',
    guide:
      '# -mente Adverbs\n\nMany adverbs of manner are formed from adjectives + **-mente** (like English "-ly").\n\n### Formation\n1. Take the feminine singular form of the adjective (if it has one).\n2. Add **-mente**.\n\n*   rápido → rápida → **rápidamente** (quick → quickly)\n*   feliz → feliz → **felizmente** (happy → happily)\n\n### Examples\n*   Habla **claramente**. (He speaks clearly.)\n*   Ella conduce **cuidadosamente**. (She drives carefully.)',
    ruleType: 'adjective',
    targetForms: ['-mente', 'rápidamente', 'claramente'],
    level: 'A2',
    dependencies: ['Adjective Agreement']
  },
  {
    title: 'Relative Clauses (Oraciones de Relativo)',
    description: 'Using que, quien, donde, cuyo to join sentences and describe nouns.',
    guide:
      '# Relative Clauses (Oraciones de Relativo)\n\nRelative clauses give extra information about a noun and are introduced by relative pronouns.\n\n### Common Pronouns\n*   **que** – that, who, which (most frequent)\n*   **quien(es)** – who (after prepositions / in nonessential clauses)\n*   **donde** – where\n*   **cuyo/a(s)** – whose (agrees with the thing possessed)\n\n### Examples\n*   El libro **que** compré es interesante. (The book that I bought is interesting.)\n*   La mujer **con quien** hablo es mi profesora. (The woman with whom I speak is my teacher.)\n*   La ciudad **donde** vivo es pequeña. (The city where I live is small.)',
    ruleType: 'conjunction',
    targetForms: ['que', 'quien', 'donde', 'cuyo'],
    level: 'B1',
    dependencies: [
      'Definite and Indefinite Articles',
      'Present Tense Regular Verbs (-ar, -er, -ir)'
    ]
  },
  {
    title: 'Impersonal and Passive "se"',
    description:
      'Using se for impersonal statements and passive-like constructions (Se habla español).',
    guide:
      '# Impersonal and Passive "se"\n\nSpanish often uses **se** to make general or passive-like statements without mentioning who does the action.\n\n### Impersonal se\nUsed for people in general (like English "one/you/they").\n*   **Se come** tarde en España. (People eat late in Spain.)\n\n### Passive se\nUsed with a direct object that becomes the grammatical subject. The verb agrees with the object.\n*   **Se venden** casas. (Houses are sold.)\n*   **Se habla** español aquí. (Spanish is spoken here.)',
    ruleType: 'reflexive',
    targetForms: ['se come', 'se venden', 'se habla'],
    level: 'B1',
    dependencies: ['Present Tense Regular Verbs (-ar, -er, -ir)', 'Reflexive Verbs']
  },
  {
    title: 'Periphrastic Constructions (Tener que, Acabar de, Volver a, Seguir + Gerund)',
    description:
      'Common verb + infinitive or gerund constructions that express obligation, recent past, repetition and continuation.',
    guide:
      '# Common Periphrastic Constructions\n\nSpanish uses many **verb + infinitive/gerund** combinations with special meanings.\n\n### Obligation\n*   **tener que + infinitive** – to have to do something:\n    *   Tengo que estudiar. (I have to study.)\n\n### Recent Past\n*   **acabar de + infinitive** – to have just done something:\n    *   Acabo de llegar. (I have just arrived.)\n\n### Repetition\n*   **volver a + infinitive** – to do something again:\n    *   Volvimos a intentarlo. (We tried again.)\n\n### Continuation\n*   **seguir + gerundio** – to keep doing something:\n    *   Sigo trabajando. (I keep working.)',
    ruleType: 'verb_auxiliary',
    targetForms: ['tener que', 'acabar de', 'volver a', 'seguir +'],
    level: 'B1',
    dependencies: [
      'Present Tense Regular Verbs (-ar, -er, -ir)',
      'Tener and Idioms with Tener',
      'Ir and the Near Future (Ir + a + Infinitive)'
    ]
  },
  {
    title: 'Subjunctive in Noun Clauses',
    description: 'Using the present subjunctive after WEIRDO verbs and expressions in que-clauses.',
    guide:
      '# Subjunctive in Noun Clauses\n\nNoun clauses are usually introduced by **que** and function as the object of a verb or expression. With WEIRDO triggers, they require the **subjunctive**.\n\n### Examples\n*   Quiero **que vengas**. (I want you to come.)\n*   Es importante **que estudies**. (It is important that you study.)\n*   Dudo **que sea** verdad. (I doubt it is true.)',
    ruleType: 'verb_mood',
    targetForms: ['que vengas', 'que estudies', 'que sea'],
    level: 'B2',
    dependencies: ['Present Subjunctive Mood']
  },
  {
    title: 'Subjunctive in Adverbial Clauses',
    description:
      'Using subjunctive after conjunctions like cuando, antes de que, para que, en caso de que.',
    guide:
      '# Subjunctive in Adverbial Clauses\n\nCertain conjunctions trigger the subjunctive because they introduce actions that are **hypothetical, future, or uncertain**.\n\n### Always Subjunctive\n*   para que (so that)\n*   a menos que (unless)\n*   en caso de que (in case)\n*   antes de que (before)\n\n### Time Conjunctions (cuando, hasta que, etc.)\nUse **subjunctive** if the action is in the future/unreal; **indicative** if it is habitual or in the past.\n\n*   Te llamaré cuando **llegue**. (I will call you when I arrive.)\n*   Siempre me llama cuando **llega**. (He always calls me when he arrives.)',
    ruleType: 'verb_mood',
    targetForms: ['para que', 'a menos que', 'cuando + subj', 'antes de que'],
    level: 'B2',
    dependencies: ['Present Subjunctive Mood', 'Preterite vs Imperfect']
  },
  {
    title: 'Future Perfect (Futuro Perfecto)',
    description: 'Expressing what will have happened by a certain point in the future.',
    guide:
      '# Future Perfect (Futuro Perfecto)\n\nUsed to express what **will have happened** by a certain moment in the future, or to speculate about the past.\n\n### Formation\n**Future of haber + past participle**\n*   habré, habrás, habrá, habremos, habréis, habrán + hablado/comido/vivido\n\n### Examples\n*   Para mañana, **habré terminado** el proyecto. (By tomorrow, I will have finished the project.)\n*   ¿Dónde está Juan? **Habrá salido**. (He must have gone out.)',
    ruleType: 'verb_auxiliary',
    targetForms: ['habré', 'habrás', 'habrá', '-ado/-ido'],
    level: 'B2',
    dependencies: ['Future Tense', 'Present Perfect (Pretérito Perfecto)']
  },
  {
    title: 'Conditional Perfect (Condicional Perfecto)',
    description:
      'Expressing what would have happened under different conditions (habría + participle).',
    guide:
      '# Conditional Perfect (Condicional Perfecto)\n\nUsed to express what **would have happened** under different conditions, often in third type si-clauses.\n\n### Formation\n**Conditional of haber + past participle**\n*   habría, habrías, habría, habríamos, habríais, habrían + hablado/comido/vivido\n\n### Example\n*   Yo **habría ido**, pero estaba enfermo. (I would have gone, but I was sick.)',
    ruleType: 'verb_auxiliary',
    targetForms: ['habría', 'habrías', 'habría', '-ado/-ido'],
    level: 'B2',
    dependencies: ['Conditional Tense', 'Past Perfect (Pluscuamperfecto)']
  },
  {
    title: 'Si Clauses (Conditionals)',
    description: 'Expressing "if... then..." statements.',
    guide:
      '# Si Clauses (If Clauses)\n\n"Si" means "if". Different tense combinations are used depending on the likelihood of the condition.\n\n### 1. Likely Situations (Present + Present/Future)\n*   Si **tengo** tiempo, **iré** al cine. (If I have time, I will go to the movies.)\n\n### 2. Unlikely/Unreal Present Situations (Imperfect Subjunctive + Conditional)\n*   Si **tuviera** dinero, **compraría** un coche. (If I had money, I would buy a car.)\n\n### 3. Impossible Past Situations (Past Perfect Subjunctive + Conditional Perfect)\n*   Si **hubiera estudiado**, **habría aprobado**. (If I had studied, I would have passed.)',
    ruleType: 'verb_mood',
    targetForms: ['si tengo ... iré', 'si tuviera ... compraría', 'si hubiera ... habría'],
    level: 'C1',
    dependencies: ['Conditional Tense', 'Imperfect Subjunctive']
  },
  {
    title: 'Passive Voice (Voz Pasiva)',
    description: 'Forming passive constructions with ser + past participle and using passive se.',
    guide:
      '# Passive Voice (Voz Pasiva)\n\nSpanish has two main ways to express passive meaning: the **ser passive** (pasiva con ser) and the **passive se** (pasiva refleja).\n\n### 1. Ser + Past Participle\nFormed with a conjugated form of **ser** + **past participle**. The participle agrees in gender and number with the subject.\n*   *El libro **fue escrito** por Cervantes.* (The book was written by Cervantes.)\n*   *Las cartas **fueron enviadas** ayer.* (The letters were sent yesterday.)\n*   *La casa **ser\u00e1 construida** el pr\u00f3ximo a\u00f1o.* (The house will be built next year.)\n\nThe agent (doer) is introduced with **por**.\n\n### 2. Passive Se (Pasiva Refleja)\nFormed with **se** + verb in third person (singular or plural). No agent is mentioned.\n*   *Se **habla** espa\u00f1ol aqu\u00ed.* (Spanish is spoken here.)\n*   *Se **venden** coches usados.* (Used cars are sold.)\n\n### When to Use Each\n*   **Ser passive:** More formal, used in written language, news, and when the agent is mentioned.\n*   **Passive se:** Far more common in everyday Spanish, used when the agent is unknown or unimportant.\n*   The ser passive is less frequent in spoken Spanish than in English \u2014 prefer passive se or active constructions in conversation.',
    ruleType: 'word_order',
    targetForms: ['fue escrito', 'fueron enviadas', 'se habla', 'se venden'],
    level: 'C1',
    dependencies: ['Present Perfect (Pret\u00e9rito Perfecto)', 'Preterite Tense - Regular Verbs']
  },
  {
    title: 'Past Subjunctive Perfect (Pluscuamperfecto de Subjuntivo)',
    description: 'Expressing hypothetical past situations using hubiera/hubiese + past participle.',
    guide:
      "# Past Subjunctive Perfect (Pluscuamperfecto de Subjuntivo)\n\nThe past subjunctive perfect expresses actions that **did not happen** in the past, often used in hypothetical or contrary-to-fact situations.\n\n### Formation\n**Imperfect subjunctive of haber** + **past participle**\n\n| Person | hubiera form | hubiese form |\n|---|---|---|\n| yo | hubiera | hubiese |\n| t\u00fa | hubieras | hubieses |\n| \u00e9l/ella/usted | hubiera | hubiese |\n| nosotros | hubi\u00e9ramos | hubi\u00e9semos |\n| vosotros | hubierais | hubieseis |\n| ellos/ustedes | hubieran | hubiesen |\n\nBoth forms (hubiera/hubiese) are interchangeable.\n\n### Uses\n\n#### 1. Si-clauses for Impossible Past Conditions\n*   *Si **hubiera sabido**, te habr\u00eda llamado.* (If I had known, I would have called you.)\n\n#### 2. After Past-tense Triggers Requiring Subjunctive\n*   *Dudaba que **hubieran llegado** a tiempo.* (I doubted they had arrived on time.)\n*   *No cre\u00eda que **hubieras dicho** eso.* (I didn't believe you had said that.)\n\n#### 3. Expressing Wishes About the Past\n*   *Ojal\u00e1 **hubi\u00e9ramos viajado** juntos.* (I wish we had traveled together.)",
    ruleType: 'verb_mood',
    targetForms: ['hubiera', 'hubieras', 'hubiera', 'hubiéramos'],
    level: 'C1',
    dependencies: ['Imperfect Subjunctive', 'Past Perfect (Pluscuamperfecto)']
  },
  {
    title: 'Future Subjunctive',
    description: 'The rarely used future subjunctive, found mainly in legal texts and proverbs.',
    guide:
      '# Future Subjunctive (Futuro de Subjuntivo)\n\nThe future subjunctive is **archaic** in modern Spanish and has been almost entirely replaced by the present subjunctive or present indicative. However, it survives in **legal language**, **proverbs**, and **set phrases**.\n\n### Formation\nTake the **ellos** form of the preterite, drop the **-ron** ending, and add the future subjunctive endings:\n\n| Person | Ending | hablar \u2192 | tener \u2192 |\n|---|---|---|---|\n| yo | -re | hablare | tuviere |\n| t\u00fa | -res | hablares | tuvieres |\n| \u00e9l/ella/usted | -re | hablare | tuviere |\n| nosotros | -remos | habl\u00e1remos | tuvi\u00e9remos |\n| vosotros | -reis | hablareis | tuviereis |\n| ellos/ustedes | -ren | hablaren | tuvieren |\n\n### Examples in Legal Language\n*   *El que **infringiere** esta ley ser\u00e1 sancionado.* (Whoever violates this law shall be penalized.)\n*   *Si el acusado **no compareciere**, se dictar\u00e1 sentencia en rebeld\u00eda.* (If the accused does not appear, judgment shall be rendered in absentia.)\n\n### Set Phrases and Proverbs\n*   *Sea lo que **fuere**.* (Be that as it may.)\n*   *Donde **fueres**, haz lo que **vieres**.* (When in Rome, do as the Romans do.)\n*   *Venga lo que **viniere**.* (Come what may.)\n\n### Note\nIn contemporary spoken and written Spanish, use the **present subjunctive** instead. The future subjunctive appears only in formal legal documents and traditional expressions.',
    ruleType: 'verb_mood',
    targetForms: ['-re', '-res', '-re', '-ren'],
    level: 'C1',
    dependencies: ['Present Subjunctive Mood', 'Preterite Tense - Irregular Verbs']
  },
  {
    title: 'Nominalization (Lo + Adjective)',
    description:
      'Using the neuter article "lo" with adjectives and clauses to create abstract noun phrases.',
    guide:
      '# Nominalization with Lo\n\nThe neuter article **lo** does not refer to a specific noun \u2014 it creates **abstract noun phrases** from adjectives, clauses, and other elements.\n\n### 1. Lo + Adjective (Abstract Concepts)\nTurns an adjective into an abstract noun meaning "the ... thing/part".\n*   *Lo **importante** es estudiar.* (The important thing is to study.)\n*   *Lo **bueno** de vivir aqu\u00ed es el clima.* (The good thing about living here is the weather.)\n*   *Lo **malo** fue el precio.* (The bad part was the price.)\n\n### 2. Lo que + Clause (What / That which)\nIntroduces noun clauses meaning "what" or "that which".\n*   *Lo que **quiero** es descansar.* (What I want is to rest.)\n*   *No entiendo lo que **dices**.* (I don\'t understand what you\'re saying.)\n\n### 3. Lo de + Noun/Pronoun (The matter of)\nRefers to a situation or topic.\n*   *Lo de **ayer** fue incre\u00edble.* (What happened yesterday was incredible.)\n*   *\u00bfQu\u00e9 pas\u00f3 con lo de **tu trabajo**?* (What happened with the matter of your job?)\n\n### 4. Lo + Adjective + que (Emphasis)\nExpresses emphasis, similar to "how ... something is".\n*   *No sabes lo **dif\u00edcil** que es.* (You don\'t know how difficult it is.)\n*   *Me sorprende lo **r\u00e1pido** que aprendes.* (It surprises me how fast you learn.)\n\n### Note\n**Lo** is neuter and never changes form \u2014 it does not agree in gender or number with anything. Do not confuse it with **el** (masculine definite article).',
    ruleType: 'article',
    targetForms: ['lo importante', 'lo que', 'lo de', 'lo + adj + que'],
    level: 'C1',
    dependencies: ['Adjective Agreement', 'Definite and Indefinite Articles']
  }
];

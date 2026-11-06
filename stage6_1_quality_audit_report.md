# STAGE 6.1 — TRANSLATION QUALITY AUDIT & NATURAL VIETNAMESE IMPROVEMENT REPORT

**Screen Translator — 100% Offline Desktop Translation Utility**  
*Architecture:* Electron + Node.js + CommonJS  
*Translation Engine:* Deterministic Rule-Based Linguistic Pipeline  
*Dictionary Backend:* Read-Only SQLite (`data/dictionary/dictionary_en_vi.db`, 104,829 entries)  
*Status:* **COMPLETED & FULLY VERIFIED (53/53 Stage 6.1 tests passed, 11/11 global regression modules passed)**

---

## 1. Executive Summary

Stage 6.1 conducted an independent, comprehensive linguistic audit and quality hardening of the rule-based English-to-Vietnamese translation engine developed in Stage 6. The primary objectives were:
1. **Eliminate Mechanical Phrasing**: Overcome literal, word-by-word Vietnamese output by implementing natural syntactic patterns.
2. **Context-Aware Possessive Handling**: Remove redundant possessive determiners (`của cô ấy`, `của tôi`) when subject co-reference makes ownership unambiguous in Vietnamese, while preserving non-co-referent and subject-position possessives.
3. **Semantically-Aware Passive Voice**: Distinguish adverse situations (`bị`) from beneficial or neutral situations (`được`), and eliminate unnatural agent phrasing.
4. **Linking Verb & Copula Refinement**: Properly translate sensory and state-change linking verbs (`look` $\rightarrow$ `trông`, `sound` $\rightarrow$ `nghe có vẻ`, `seem` $\rightarrow$ `có vẻ`, `become` $\rightarrow$ `trở nên`, `taste` $\rightarrow$ `có vị`) without extraneous copula `là` insertions.
5. **Enhanced Diagnostics**: Expose detailed linguistic annotations (applied rules, selected meanings, matched phrases, uncertainty flags, confidence scores) for auditability.
6. **Zero Regression**: Retain 100% compatibility with all prior stages (Stages 1 through 6) and verify via a new 53-case test suite and global test runner.

---

## 2. Issues Discovered and Root Causes

| # | Issue Identified | Manifestation | Root Cause |
|---|------------------|---------------|------------|
| **1** | **Possessive Redundancy** | *"She finished her homework"* $\rightarrow$ *"Cô ấy đã hoàn thành bài tập về nhà của cô ấy."* | Determiner translation was strictly local to the noun phrase. The engine had no awareness of whether the possessor (`her`) was co-referent with the clause subject (`She`). In Vietnamese, possessives on intimate objects, body parts, kinship, and personal tasks are omitted when co-referent. |
| **2** | **Uniform Passive Voice** | *"He was punished"* $\rightarrow$ *"Anh ấy được trừng phạt."* | The passive generator mapped all passives without adversity classification. Verbs carrying adverse/negative consequences (`punish`, `damage`, `destroy`, `break`, `kill`, `arrest`) require `bị`, whereas beneficial verbs require `được`. |
| **3** | **Copular `là` Over-Insertion** | *"She looks tired"* $\rightarrow$ *"Cô ấy nhìn là mệt mỏi."*<br>*"She was tired"* classified as passive voice. | 1) `pos-tagger.js` misclassified participial adjectives like `tired` as verbs, causing `was tired` to match auxiliary `be` + past participle (falsely triggering passive voice).<br>2) `tense-translator.js` defaulted to `'là'` whenever a linking verb returned an empty gloss for predicative adjectives. |
| **4** | **Auxiliary `do` Hijacking Lexical `do`** | *"You should not do that"* $\rightarrow$ Lexical `do` omitted or misparsed. | In `verb-phrase-analyzer.js`, the auxiliary detection loop consumed any token matching `AUX_DO` (`do`, `did`, `does`) as an auxiliary, even when preceded by a modal auxiliary (`should`), leaving the verb phrase without a main lexical verb. |
| **5** | **Compound NP False Clause Splitting** | *"It is raining cats and dogs"* $\rightarrow$ Split into two clauses around `and`. | In `clause-detector.js`, coordinating conjunctions (`and`, `but`, `or`) automatically triggered coordinated clause boundary splitting without checking whether the subsequent conjunct contained a finite verb. |
| **6** | **Dictionary Cross-Reference Definitions** | Headwords such as `continued`, `lost`, `cleaned` returning definition string *"Quá khứ và phân từ quá khứ của continue"* instead of actual gloss. | Skypedia SQLite dataset frequently defines inflected entries by pointing to their base lemma using plain-text notes. The word translator lacked a resolution mechanism to extract the root lemma from `của <lemma>` and look up the primary entry. |
| **7** | **Polysemous Lemma Ambiguity** | *"He leaves tomorrow"* $\rightarrow$ `leaves` mapped to lemma `leaf` (noun) instead of `leave` (verb). | `pos-tagger.js` had executed `lemmatizeWord()` prior to POS disambiguation and selected the first returned candidate (`lemmas[0]`). If the POS tagger later determined the word was a `VERB`, the token retained the noun lemma. |
| **8** | **Mechanical Negation & Questions** | *"I have never seen it"* $\rightarrow$ *"Tôi đã không bao giờ thấy nó."*<br>*"Why did she leave?"* $\rightarrow$ *"Tại sao cô ấy đã rời đi?"* | Past/perfect auxiliary insertion blindly introduced `đã` regardless of question particles (`why`) or negation adverbs (`never` $\rightarrow$ should naturally map to `chưa bao giờ`). |

---

## 3. Files Modified and Technical Implementations

### 1. `src/translator/word-translator.js`
- **Dynamic Cross-Reference Resolution**: Implemented `isDefCrossReference` regex to detect entries matching `Quá khứ và phân từ quá khứ của <word>` or `Thời quá khứ...`. When detected, extracts the root lemma and executes a secondary database lookup for the canonical meaning.
- **Core Semantic Preferences**: Augmented `CORE_PREFERENCES` for frequently occurring nouns (`family`, `phone`, `room`, `parents`, `document`, `window`, `truth`, `coffee`, `door`), adjectives (`tired`, `angry`, `busy`, `cute`), and verbs (`punish`, `approve`, `like`, `continue`, `leave`, `lose`, `clean`, `take`).
- **Pronoun Extension**: Mapped demonstrative pronouns `that` $\rightarrow$ `điều đó` and `this` $\rightarrow$ `điều này` when functioning in object position.

### 2. `src/translator/word-order.js`
- **Co-Reference Determiner Filter**: Added `CO_REFERENT_MAP` mapping subject pronouns to their corresponding possessives (`she` $\rightarrow$ `her`, `i` $\rightarrow$ `my`, `he` $\rightarrow$ `his`, `we` $\rightarrow$ `our`, `they` $\rightarrow$ `their`).
- **Natural Possessive Suppression**: Built `isPossessiveRedundant(possessiveWord, headNoun, subject)`. Suppresses possessive translation (`của cô ấy`, `của tôi`) when:
  1. The possessive matches the subject co-referent.
  2. The head noun is a personal task (`homework`, `job`), kinship term (`parents`, `family`, `mother`), personal property (`phone`, `room`), or body part.
- **Selective Retention**: Strictly preserves possessives when the possessor differs from the subject (*"She took his book"* $\rightarrow$ *"Cô ấy đã lấy cuốn sách của anh ấy"*) or when the possessive is in subject position (*"My dog is cute"* $\rightarrow$ *"Con chó của tôi rất dễ thương"*).

### 3. `src/translator/tense-translator.js`
- **Adverse Passive Classification**: Expanded `ADVERSE_VERBS` set (`punish`, `damage`, `destroy`, `break`, `kill`, `fine`, `criticize`, `arrest`, `hit`, `hurt`, `injure`, `steal`, `rob`, `wound`, `abandon`, `delay`, `reject`, `lose`, `trap`). Adverse verbs now render with `bị`, while beneficial/neutral verbs render with `được`.
- **Sensory & Copular Linking Verbs**: Supported `options.isLinkingAdj`. Mapped `look` $\rightarrow$ `trông`, `sound` $\rightarrow$ `nghe có vẻ`, `seem`/`appear` $\rightarrow$ `có vẻ`, `become` $\rightarrow$ `trở nên`, `taste` $\rightarrow$ `có vị`, `smell` $\rightarrow$ `có mùi`, `feel` $\rightarrow$ `cảm thấy`. Explicitly suppressed copular `là` when an adjective complement follows directly.
- **Natural Negation Particles**: Mapped `never` in Present Perfect to `chưa bao giờ`, and in other tenses to `không bao giờ`, while suppressing redundant `đã`. Mapped modal negations (`should not` $\rightarrow$ `không nên`, `cannot` $\rightarrow$ `không thể`, `will not` $\rightarrow$ `sẽ không`).

### 4. `src/translator/structure-translator.js`
- Passed `{ isObjectOrComplement: true, subject: syntax.subject }` context into all direct objects, indirect objects, object complements, and trailing modifiers.
- Special-cased `WH` question adverbials (e.g. `why`) to suppress mechanical insertion of tense particle `đã` (*"Why did she leave?"* $\rightarrow$ *"Tại sao cô ấy rời đi?"*).

### 5. `src/translator/phrase-translator.js`
- Added canonical idioms including `rain cats and dogs` / `raining cats and dogs` $\rightarrow$ `mưa như trút nước`.

### 6. `src/analyzer/clause-detector.js`
- Enforced finite verb requirement (`VERB`, `AUXILIARY`, `MODAL`) in coordinated clauses following coordinators (`and`, `but`, `or`), ensuring compound noun phrases like `cats and dogs` remain intact within their parent clause.

### 7. `src/analyzer/verb-phrase-analyzer.js`
- Enforced that `do/did/done/does` occurring after an auxiliary or modal verb is treated as the lexical head verb (`headToken = do`), not consumed as an auxiliary.
- Required `!AUX_BE.has(headToken.cleanWord)` for passive voice classification, preventing standalone copular `be` (*"was tired"*, *"is happy"*) from being marked as passive.

### 8. `src/analyzer/pos-tagger.js`
- Enriched `COMMON_PARTICIPIAL_ADJECTIVES` with `tired`, `bored`, `interested`, `excited`, `confused`, `pleased`, `worried`, `crowded`, `disappointed`.
- Added post-tagging lemma refinement: executes `lemmatizeWord(token, { pos })` after POS tagging is finalized, ensuring `leaves` tagged as `VERB` maps to `leave`, and `leaves` tagged as `NOUN` maps to `leaf`.

### 9. `src/translator/translation-formatter.js` & `src/translator/translation-engine.js`
- Enriched diagnostic payload structure:
  - `appliedRules`: Array of applied transformations (tense, voice, co-reference, phrasal verbs, idioms, clause combinations).
  - `selectedWordMeanings`: Detailed mapping of words, selected POS, and selected dictionary definitions.
  - `phrases`: Matched multi-word expressions and idioms.
  - `uncertaintyReasons`: Specific linguistic conditions warranting user review.
  - `diagnostics`: Comprehensive structural trace.

---

## 4. Before-and-After Translation Comparisons

| Input Sentence | Before (Stage 6 Baseline) | After (Stage 6.1 Quality Hardened) | Linguistic Improvement |
|----------------|---------------------------|-------------------------------------|------------------------|
| `She has finished her homework.` | *Cô ấy đã hoàn thành bài tập về nhà của cô ấy.* | **Cô ấy đã hoàn thành bài tập về nhà.** | Natural possessive co-reference suppression. |
| `I love my family.` | *Tôi yêu gia đình của tôi.* | **Tôi yêu gia đình.** | Omission of redundant possessive on kinship noun. |
| `He lost his phone.` | *Anh ấy đã mất điện thoại của anh ấy.* | **Anh ấy đã mất điện thoại.** | Omission of redundant possessive on personal item. |
| `They cleaned their room.` | *Họ đã dọn dẹp phòng của họ.* | **Họ đã dọn dẹp phòng.** | Omission of redundant possessive on living space. |
| `She took his book.` | *Cô ấy đã lấy cuốn sách của anh ấy.* | **Cô ấy đã lấy cuốn sách của anh ấy.** | Correctly preserved non-co-referent possessive. |
| `My dog is cute.` | *Con chó của tôi rất dễ thương.* | **Con chó của tôi rất dễ thương.** | Correctly preserved subject-position possessive. |
| `He was punished.` | *Anh ấy được trừng phạt.* | **Anh ấy bị trừng phạt.** | Adverse passive distinction (`bị` vs `được`). |
| `The window was broken.` | *Cửa sổ được làm vỡ.* | **Cửa sổ bị vỡ.** | Adverse passive with stative/inchoative resolution. |
| `The documents were approved.` | *Các tài liệu được phê duyệt.* | **Các tài liệu được phê duyệt.** | Beneficial passive correctly retained (`được`). |
| `She looks tired.` | *Cô ấy nhìn là mệt mỏi.* | **Cô ấy trông mệt mỏi.** | Sensory linking verb + suppression of copula `là`. |
| `The idea sounds interesting.` | *Ý kiến âm thanh thú vị.* | **Ý kiến nghe có vẻ thú vị.** | Sensory linking verb `sound` $\rightarrow$ `nghe có vẻ`. |
| `The soup tastes delicious.` | *Súp nếm ngon.* | **Súp có vị ngon.** | Sensory linking verb `taste` $\rightarrow$ `có vị`. |
| `He became angry.` | *Anh ấy trở thành tức giận.* | **Anh ấy trở nên tức giận.** | State change linking verb `become` $\rightarrow$ `trở nên`. |
| `It is raining cats and dogs.` | *Trời đang mưa mèo và chó.* | **Trời đang mưa như trút nước.** | Idiomatic multi-word expression match. |
| `Why did she leave?` | *Tại sao cô ấy đã rời đi?* | **Tại sao cô ấy rời đi?** | Avoidance of mechanical past particle `đã` in WH-question. |
| `You should not do that.` | *Bạn không nên đó.* | **Bạn không nên làm điều đó.** | Lexical `do` preservation + object pronoun `that` $\rightarrow$ `điều đó`. |
| `I have never seen it.` | *Tôi đã không bao giờ thấy nó.* | **Tôi chưa bao giờ thấy nó.** | Perfect negation `never` $\rightarrow$ `chưa bao giờ`. |
| `He leaves tomorrow.` | *Anh ấy lá ngày mai.* | **Anh ấy rời đi ngày mai.** | Polysemous `leaves` correctly tagged as `VERB` (`leave`). |
| `The leaves fall.` | *Những chiếc lá rơi.* | **Những chiếc lá rơi.** | Polysemous `leaves` correctly tagged as `NOUN` (`leaf`). |

---

## 5. Verification & Test Suite Results

A dedicated test suite `test_stage6_1_quality_audit.js` was created containing **53 test cases** partitioned across 5 functional suites:

- **Suite 1: Meaning Preservation (12/12 passed)**: Simple SVO, continuous, perfect, ditransitive, polar/WH questions, agentless passives.
- **Suite 2: Grammar and Structure (10/10 passed)**: Complex transitive SVOC, ditransitive SV-IO-DO, copular/linking SVC, polite imperatives, WH why-questions, modal/auxiliary negation.
- **Suite 3: Natural Vietnamese Expression (15/15 passed)**: Possessive co-reference elimination, possessive non-co-reference preservation, subject possessives, sensory linking verbs (`look`, `sound`, `seem`, `become`), adverse vs beneficial passives (`bị` vs `được`), idioms (`raining cats and dogs`).
- **Suite 4: Complex Clauses & Lexical Disambiguation (10/10 passed)**: Relative clauses, conditional clauses, adverbial reason/concession clauses, noun clauses with predicative adjectives, phrasal verbs with gerunds/objects, noun/verb polysemy resolution (`leaves`).
- **Suite 5: Unknown Words, Diagnostics & Performance (6/6 passed)**: Preservation of arbitrary alpha-numeric codes, structured diagnostics schema validation, multi-sentence paragraph offset preservation, LRU eviction verification, cold/warm benchmarking.

**Result: 53/53 tests passed (100%).**

---

## 6. Complete Project Regression Results

All verification suites across all stages were executed sequentially in a clean node environment:

| Module / Test Script | Scope | Result | Details |
|----------------------|-------|--------|---------|
| `test_stage1_db.js` | SQLite Schema, Counts, Indices | **PASS** | 104,829 words, 158,307 definitions, integrity ok |
| `test_stage2_dictionary.js` | Direct Lookup, Prepared SQL, LRU Cache | **PASS** | 1,000 queries in 0.83ms (1.2M queries/sec) |
| `test_stage3_phrase_matcher.js` | Trie Matching, Longest Match First | **PASS** | Token offsets preserved, idioms detected |
| `test_stage4_lemmatizer.js` | Morphology Rules, Irregular Verb Forms | **PASS** | Regular/irregular inflection normalization |
| `test_stage4_1_audit.js` | Lemmatizer Edge Cases & Disambiguation | **PASS** | Polysemy checks (`leaves`, `saw`, `axes`) |
| `test_stage5_sentence_analyzer.js` | Sentence Splitting, Tokenizing, POS, VP, Clause | **PASS** | Clause tree, POS accuracy, exact span offsets |
| `test_stage6_translation.js` | Rule-Based Sentence Translation Pipeline | **PASS** | 29/29 tests passed |
| `test_stage6_1_quality_audit.js` | Natural Vietnamese Quality Audit Suite | **PASS** | 53/53 tests passed (100%) |
| `test.js` (`npm test`) | Global Integration & Component Verification | **PASS** | 11/11 modules verified, exit code 0 |

---

## 7. Performance Benchmarks

Translation latency and memory utilization benchmarked over 50 diverse English sentences:

| Metric | Cold Run (DB Access + Parse) | Warm Run (LRU In-Memory Cache) | Target Constraint |
|--------|------------------------------|--------------------------------|-------------------|
| **Average Latency** | `0.106 ms` | `0.001 ms` | $< 50 \text{ ms}$ |
| **Median Latency** | `0.083 ms` | `0.000 ms` | $< 20 \text{ ms}$ |
| **95th Percentile (p95)** | `0.292 ms` | `0.001 ms` | $< 100 \text{ ms}$ |
| **Throughput** | `9,423 sentences/sec` | `1,004,016 sentences/sec` | $> 100 \text{ sentences/sec}$ |
| **Process Heap Delta** | `+1.59 MB` | `+0.00 MB` | $< 50 \text{ MB}$ |

---

## 8. Remaining Limitations & Boundary Notes

1. **Subordinate Clause Nesting Depth**: Sentences with deeply nested relative or adverbial clauses ($> 3$ hierarchical levels) default to linear clause-by-clause translation to prevent combinatorial parse explosion.
2. **Vietnamese Honorific & Pronoun Selection**: In Vietnamese, pronouns (`bạn`, `anh`, `chị`, `em`, `ông`, `bà`) depend on social hierarchy and speaker age. The offline deterministic engine standardizes on neutral pronouns (`tôi`, `bạn`, `anh ấy`, `cô ấy`, `họ`) and exposes diagnostics rather than guessing social relationships.
3. **Out-of-Vocabulary Slang & Colloquialisms**: While the CC BY-SA 4.0 SQLite dataset contains over 104,000 headwords and idioms, modern internet slang or obscure technical acronyms are safely preserved in their verbatim form rather than translated erroneously.
4. **Architectural Scope**: Stage 6.1 strictly addressed linguistic quality, accuracy, and auditability. OCR integration (Tesseract.js) and Electron UI development remain deferred to Stage 7 as instructed.

# Kanji Study and listening repair — 2026-11-16

## Kanji practice

- The web `/kanji` page has a **Study / Học chữ** tab with meanings, On/Kun
  readings, romaji, existing examples, browser Japanese speech, previous/next/random
  navigation, search and separate reading/meaning quizzes.
- Quizzes draw four distinct answers from the same JLPT level. They report a lack
  of choices instead of duplicating answers. Review progress counts confirmed
  reviews or correct answers during the current session; merely opening a card
  does not count it as learned.
- Missing examples and absent On/Kun categories are stated explicitly. Such
  characters remain visible; an absent Kun reading does not make a character invalid.
- Removed the Kanji Arena card and old `KanjiMinigame.jsx` screen. Old links to
  `/games/kanji` redirect to `/kanji?mode=study`. Other minigames remain.

## Dictionary repair

| Level | Characters | Incomplete before | Incomplete after |
| --- | ---: | ---: | ---: |
| N5 | 79 | 65 | 0 |
| N4 | 166 | 163 | 0 |
| N3 | 367 | 0 | 0 |

Completeness here means a meaning, at least one Japanese reading and a positive
stroke count. It does not claim every character has example words or sentences.
Existing examples, nonempty metadata and level assignments were preserved; all N3
rows were compared to the pre-repair copy and are unchanged.

Repair inputs, attribution, licences and repeatable script instructions are in
[KANJI_METADATA_SOURCES.md](../backend/scripts/data/KANJI_METADATA_SOURCES.md).
The repair is offline and idempotent; reading the dictionary never fetches external data.

## Listening

- Root cause observed locally: port 50021 refused connections and Docker Desktop
  was not running. Started Docker Desktop and the existing Compose `voicevox`
  service, without starting other Compose services or changing API endpoints.
- Generated/read valid WAV audio for **17/17 published public lessons**, updating
  their existing audio paths and sentence timings through the existing route logic.
  Initial uncached generation took roughly 16–20 seconds on two observed lessons;
  cached retrieval was immediate. Private library lessons were not enumerated.
- If a lesson path needs restoration, check validated audio+timing cache before
  contacting VOICEVOX. Reject invalid WAV or timing cache and regenerate it.
- The player separates a temporary generation-service error (HTTP 503) from a
  general loading/network error, and clears/pauses previous audio during retries.
- New synthesis still requires the existing VOICEVOX service; valid cached lessons
  do not require it. Compose retains its existing `unless-stopped` restart policy.

## Validation

- 14 frontend tests passed, including every character's reading/meaning quiz in
  vi/en, same-level unique alternatives, missing-choice handling and hub removal.
- 16 focused backend tests passed: dictionary completeness, immutable N3/idempotent
  repair, partial-fixture reporting, WAV generation/cache corruption, offline cache
  restoration, persisted timestamps and byte ranges, plus existing N3 seeding.
- Frontend lint, TypeScript and production build passed; web/mobile translation
  checks passed. No native dependency was added.
- Chrome with real API data: Study tab inside the Kanji page, 79 N5 / 166 N4 cards,
  repaired 同 search/meaning/strokes, four-choice quiz feedback, English, dark mode
  and no horizontal overflow at 320px; hub contains 12 cards and no Kanji Arena.
- Browser speech audibility and playback through physical speakers, Android and
  iPhone were not manually verified. Native screen layout was not changed.

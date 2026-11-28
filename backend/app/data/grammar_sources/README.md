# Bundled Japanese grammar sources

These files are intentionally versioned in Git. Keep this directory with the application when committing, building Docker images or packaging the backend. It contains public learning content only, not a database dump, accounts, tokens or learner progress.

## Attribution and licenses

| Source | Pinned version | Original entries | License |
| --- | --- | ---: | --- |
| [Hanabira](https://hanabira.org), [Japanese content repository](https://github.com/tristcoil/hanabira.org-japanese-content) | `1462bb37f0eb229fea58a18eb4855428bdbffa25` | 828 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), copyright hanabira.org |
| [OpenJLPT](https://github.com/evanclan/OpenJLPT/releases/tag/v0.2.0) | v0.2.0, `c42fd9fa3777bfc1775446f7c418d549dfd6e4cf` | 100 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |

The Hanabira link originally supplied (`github.com/hanabira`) is an empty GitHub profile. The content repository above is linked by the official [Hanabira application repository](https://github.com/tristcoil/hanabira.org), whose software MIT license is separate from its content license. Use the content CC BY license, not the application MIT license, for these files.

The original JSON files are included byte-for-byte, together with the upstream licenses and notices. `manifest.json` records each original URL, immutable revision, byte count, record count and SHA-256. Consult [OpenJLPT's full upstream attribution](openjlpt/NOTICE.md), including EDRDG, Jonathan Waller and Tatoeba, before redistributing its dataset. Hanabira's attribution explicitly includes a link to https://hanabira.org.

The adapted combined lesson catalog generated from these sources is distributed under **CC BY-SA 4.0**. Adaptations made by SenpaiAI: mapping source fields to the existing lesson schema; removing trailing romanization from the pattern field while preserving the title; normalization of Unicode, spaces and placeholder tildes; merging exact normalized pattern/level matches; combining distinct examples and preserving alternate wording; adding source metadata and deterministic lesson keys. This data licensing statement does not change the license of unrelated application code or user-provided content. Each original snapshot retains its own license.

Source explanations and example translations are **English**, with Japanese examples. No Vietnamese translation is claimed. JLPT labels are learning references, not official lists or calibrated assessment content. Imported examples never become graded questions automatically.

## Offline operation

The backend reads the committed snapshots and validates their checksums locally. Startup never contacts GitHub, Hanabira, an LLM or an embedding service to import these lessons. No new Python/npm dependency is needed.

```bash
# From backend; validate snapshots, no database connection required
python -m scripts.seed_grammar_lessons --check

# After configuring DATABASE_URL for this project's database
python -m alembic upgrade head
python -m scripts.seed_grammar_lessons
```

The normal backend startup also calls the same importer with `SEED_BUNDLED_GRAMMAR=true` (the default). Set it to `false` to manage lesson imports manually. Repeated startup/import retains lesson/rule IDs, account progress and question-bank answers. Custom lessons are preserved. An existing custom lesson on an identical normalized rule causes the bundled entry to be skipped and reported. Managed bundled lesson content is reconciled with this snapshot on startup; edit the source/import process for intentional changes rather than modifying managed rows manually. Removed source entries are not deleted automatically.

To intentionally re-fetch the exact pinned snapshots during maintenance, run `python -m scripts.sync_grammar_sources`; this needs network access. To upgrade sources, review and edit the pinned revisions in that script, regenerate the manifest, inspect the data/license differences, update count tests and commit the complete change. Team members do **not** need to run this download command.

Current adapted counts: N5 **156**, N4 **144**, N3 **139**, N2 **200**, N1 **265**; **904** total from 928 source records. Only exact normalized pattern/level matches are merged; similar grammatical meanings or different levels are not silently combined.

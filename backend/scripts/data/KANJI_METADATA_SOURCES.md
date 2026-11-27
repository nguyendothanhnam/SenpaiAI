# N5/N4 dictionary repair sources

`kanji_n5_n4_metadata.json` is a 245-character subset of
[David Gouveia's kanji-data](https://github.com/davidluzgouveia/kanji-data), downloaded
on 2026-11-16 from `master/kanji.json`. Only stroke count, grade, frequency,
English meanings and Japanese readings are retained. Upstream source SHA-256:
`561b72ea9df703c58fae0c68585812e172aaa7611d2fcee6719d55fd2dfd4fa4`.

The underlying readings, meanings and counts come from **KANJIDIC**, copyright
James William BREEN and the Electronic Dictionary Research and Development Group.
Dictionary data and adaptations are available under **CC BY-SA 4.0**:
[EDRDG documentation and licence](https://www.edrdg.org/edrdg/licence.html),
[KANJIDIC project](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project),
[licence text](https://creativecommons.org/licenses/by-sa/4.0/legalcode).

`kanji_n5_n4_vi.json` supplies Vietnamese meanings for previously blank entries.
These descriptions were added for SenpaiAI; they are not claimed to be translations
provided by KANJIDIC. The repair preserves every existing JLPT label and nonempty
meaning, reading, example and stroke count; it does not invent missing examples.
Run `python backend/scripts/repair_kanji_n5_n4.py` to preview changes and add
`--write` to apply. Repeating the repair is idempotent. N3 is unchanged.

For future refreshes, download the upstream JSON, retain only the same dictionary
characters and six fields, update the checksum/date above, review the diff and run
the dictionary tests. Do not replace SenpaiAI's JLPT classifications with upstream
classifications.

## N5/N4 audit and stroke import — 2026-11-25

The repair preview, write and repeated preview each reported **0 changed entries**.
The main dictionary already contains the supplemental metadata; it remains byte-identical.
N5/N4 core metadata completeness is 79/79 and 166/166. This does not include examples:
only 39 N5 and 6 N4 entries have all example fields populated, and those examples repeat
the character gloss and require human review. No meanings, readings or examples were invented.
The 200 missing-example entries and 45 review entries are recorded in
[`docs/ket_qua/kanji_n5_n4.json`](../../../docs/ket_qua/kanji_n5_n4.json).

Official KanjiVG source: [KanjiVG/kanjivg](https://github.com/KanjiVG/kanjivg),
commit `9d7220dfca09107dca2e0b0e45f90f696185e3c3` (2026-11-18), downloaded 2026-11-25.
[Pinned archive](https://codeload.github.com/KanjiVG/kanjivg/zip/9d7220dfca09107dca2e0b0e45f90f696185e3c3),
24,094,864 bytes, SHA-256 `d72cc091482dce754e57e074eb0755d0f056f2bfae22369c20805c06fbf42ba2`.
245 canonical SVGs were selected; the existing importer produced a staging JSON.
Only 234 missing records (68 N5, 166 N4) were appended to the main stroke JSON;
all 378 previous records, all N3 data and the local SVG checkout were preserved.
The JSON now contains all 612 dictionary characters. Repeating the merge adds zero records.
No N5/N4 dictionary/path stroke-count discrepancy was found.

KanjiVG is copyright **Ulrich Apel**, licensed **CC BY-SA 3.0**:
[project attribution](https://kanjivg.tagaini.net/),
[licence](https://creativecommons.org/licenses/by-sa/3.0/),
[upstream COPYING](https://github.com/KanjiVG/kanjivg/blob/9d7220dfca09107dca2e0b0e45f90f696185e3c3/COPYING).
SVG paths were converted to JSON and enriched with dictionary metadata. Retain the
KanjiVG attribution/licence for those paths and the separate KANJIDIC attribution/licence
for dictionary metadata; the existing per-record source/licence fields were not renamed.
The source download includes COPYING and README.md in the local staging directory.
This attribution does not license the CNN model, fonts or personal handwriting samples.

Vietnamese report, complete missing-character lists, download/import commands and checks:
[`docs/KANJI_RECOGNITION_DIAGNOSIS.md`](../../../docs/KANJI_RECOGNITION_DIAGNOSIS.md).

## kanji-data repository licence

MIT License

Copyright (c) 2019 David Gouveia

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

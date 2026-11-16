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

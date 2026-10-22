export const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const

// The local kanji dictionary currently contains entries through N3.
export const KANJI_DICTIONARY_LEVELS = JLPT_LEVELS.slice(0, 3)

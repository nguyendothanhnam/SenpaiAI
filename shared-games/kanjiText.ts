export interface TextRun { text: string; han: boolean }

/** Preserve every code point and group adjacent non-Han text into one run. */
export function splitKanjiText(text: string): TextRun[] {
  const result: TextRun[] = []
  let ordinary = ''
  for (const character of text) {
    if (/\p{Script=Han}/u.test(character)) {
      if (ordinary) result.push({ text: ordinary, han: false })
      ordinary = ''
      result.push({ text: character, han: true })
    } else ordinary += character
  }
  if (ordinary) result.push({ text: ordinary, han: false })
  return result
}

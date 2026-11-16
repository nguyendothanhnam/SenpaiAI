import { toHiragana } from '../../data/kanjiDataset'
interface StudyItem { kanji: string; jlpt_level: string; onyomi: string[]; kunyomi: string[]; meaning_vi: string; meaning_en: string }
export function makeStudyQuestion(items: StudyItem[], target: StudyItem, mode: string, language: string, random = Math.random) {
  const value = (item: StudyItem) => mode === 'reading' ? toHiragana(item.onyomi[0] || item.kunyomi[0] || '') : language === 'en' ? item.meaning_en || item.meaning_vi : item.meaning_vi || item.meaning_en
  const correct = value(target)
  const alternatives = [...new Set(items.filter(item => item.kanji !== target.kanji && item.jlpt_level === target.jlpt_level).map(value))].filter(answer => answer && answer !== correct)
  if (!correct || alternatives.length < 3) return null
  const shuffle = (values: string[]) => { const result = [...values]; for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]] } return result }
  return { correct, options: shuffle([correct, ...shuffle(alternatives).slice(0, 3)]) }
}

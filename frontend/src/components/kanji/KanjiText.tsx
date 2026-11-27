import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { splitKanjiText } from '../../../../shared-games/kanjiText'
import { useKanjiLookup } from './KanjiLookupScope'

export function KanjiText({ text }: { text: string }) {
  const open = useKanjiLookup()
  const { t } = useTranslation('common')
  const runs = useMemo(() => splitKanjiText(text), [text])
  return <>{runs.map((run, index) => run.han && open ? <span key={index} role="button" tabIndex={0} aria-label={t('kanjiLookup.openCharacter', { kanji: run.text })} className="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--primary)]" onClick={event => { if (window.getSelection()?.toString()) return; event.stopPropagation(); open(run.text) }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(run.text) } }}>{run.text}</span> : run.text)}</>
}

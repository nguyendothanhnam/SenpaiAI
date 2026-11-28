import { useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { filterCharacters, gridNavigationIndex, recentCharacters, suggestCharacters, writingStatus, WRITING_LEVELS } from '../../features/kanjiWriting/practice'
import type { PracticeCharacter } from '../../features/kanjiWriting/practice'
import type { WritingHistory } from '../../services/kanjiWriting'

export default function WritingCharacterPicker({items,history,kanji,level,onLevel,onSelect,disabled}:{items:PracticeCharacter[];history?:WritingHistory[];kanji:string;level:string;onLevel:(level:string)=>void;onSelect:(kanji:string)=>void;disabled:boolean}){
  const {t}=useTranslation('common'),[search,setSearch]=useState(''),grid=useRef<HTMLDivElement>(null)
  const panelId=useId()
  const [focused,setFocused]=useState(kanji)
  const visible=useMemo(()=>filterCharacters(items,level,search),[items,level,search])
  const records=useMemo(()=>new Map(history?.map(h=>[h.kanji,h])),[history])
  const suggested=useMemo(()=>history?suggestCharacters(items.filter(i=>i.level===level),history):[],[items,level,history])
  const recent=useMemo(()=>history?recentCharacters(items,history):[],[items,history])
  const selected=visible.findIndex(item=>item.kanji===kanji),focusedIndex=visible.findIndex(item=>item.kanji===focused)
  const tabStop=focusedIndex>=0?focusedIndex:Math.max(0,selected)
  const choose=(value:string)=>{if(!disabled){setFocused(value);onSelect(value)}}
  return <details className="theme-card writing-picker p-4">
    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3"><span className="flex items-center gap-4"><strong className="japanese-text text-5xl" aria-label={t('writing.target')}>{kanji}</strong><span><span className="block font-bold">{t('writingUI.chooseCharacter')}</span><span className="text-sm text-[color:var(--text-muted)]">{t('writingUI.available',{count:items.length})}</span></span></span><span className="btn btn-outline px-3 py-2">{t('writingUI.openPicker')}</span></summary>
    <div className="mt-4 space-y-3">
      <div role="tablist" aria-label={t('writingUI.levels')} className="flex flex-wrap gap-2">{WRITING_LEVELS.map((value,index)=><button type="button" role="tab" id={`${panelId}-${value}`} aria-selected={level===value} aria-controls={panelId} tabIndex={level===value?0:-1} key={value} className="writing-level" disabled={disabled} onClick={()=>{onLevel(value);setSearch('')}} onKeyDown={event=>{
        const next=event.key==='ArrowRight'?(index+1)%WRITING_LEVELS.length:event.key==='ArrowLeft'?(index+WRITING_LEVELS.length-1)%WRITING_LEVELS.length:event.key==='Home'?0:event.key==='End'?WRITING_LEVELS.length-1:-1
        if(next>=0){event.preventDefault();onLevel(WRITING_LEVELS[next]);setSearch('');event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus()}
      }}>{value} <span className="text-xs">({items.filter(i=>i.level===value).length})</span></button>)}</div>
      <div id={panelId} role="tabpanel" aria-labelledby={`${panelId}-${level}`} className="space-y-3">
      <label className="block text-sm font-semibold">{t('writingUI.search')}<input type="search" className="input mt-1 min-h-[44px] w-full" value={search} onChange={e=>setSearch(e.target.value)} placeholder={t('writingUI.searchPlaceholder')}/></label>
      <p className="text-xs text-[color:var(--text-muted)]">{t('writingUI.keyboard')}</p>
      <p className="text-xs text-[color:var(--text-muted)]">{t('writingUI.masteryHelp')}</p>
      <p role="status" aria-live="polite" className="text-xs text-[color:var(--text-muted)]">{t('writingUI.grid',{level,count:visible.length})}</p>
      <div ref={grid} role="group" aria-label={t('writingUI.grid',{level,count:visible.length})} className="writing-character-grid" onKeyDown={event=>{
        const buttons=Array.from(grid.current?.querySelectorAll<HTMLButtonElement>('button')||[]),index=buttons.indexOf(event.target as HTMLButtonElement)
        if(index<0)return
        const columns=grid.current?getComputedStyle(grid.current).gridTemplateColumns.split(' ').length:1
        const next=gridNavigationIndex(event.key,index,buttons.length,columns)
        if(next>=0){event.preventDefault();buttons[next].focus();buttons[next].scrollIntoView({block:'nearest'})}
      }}>
        {visible.map((item,index)=>{const status=history?writingStatus(records.get(item.kanji)):'unknown';return <button type="button" key={item.kanji} className="writing-character" disabled={disabled} aria-pressed={kanji===item.kanji} aria-label={`${item.kanji} · ${item.meaning_vi||''} · ${t(`writingUI.states.${status}`)}`} tabIndex={index===tabStop?0:-1} onFocus={()=>setFocused(item.kanji)} onClick={()=>choose(item.kanji)}><span className="japanese-text text-3xl">{item.kanji}</span><span className="writing-state text-[10px]">{t(`writingUI.states.${status}`)}</span></button>})}
        {!visible.length&&<p className="col-span-full p-4 text-sm">{t(items.some(i=>i.level===level)?'writingUI.noMatches':'writingUI.noLevelData',{level})}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{(['previous','next','random'] as const).map(action=><button type="button" key={action} className="btn btn-outline min-h-[44px] px-3" disabled={disabled||!visible.length} onClick={()=>{
        const index=visible.findIndex(item=>item.kanji===kanji)
        const pool=visible.length>1?visible.filter(i=>i.kanji!==kanji):visible
        const item=action==='random'?pool[Math.floor(Math.random()*pool.length)]:visible[index<0?0:(index+(action==='next'?1:visible.length-1))%visible.length]
        if(item)choose(item.kanji)
      }}>{t(`writingUI.${action}`)}</button>)}</div>
      {suggested.length>0&&<div><p className="text-sm font-semibold">{t('writingUI.suggestions')}</p><div className="flex flex-wrap gap-2">{suggested.map(item=><button type="button" disabled={disabled} key={item.kanji} className="writing-chip" onClick={()=>choose(item.kanji)}>{item.kanji}</button>)}</div></div>}
      {recent.length>0&&<div><p className="text-sm font-semibold">{t('writingUI.recent')}</p><div className="flex flex-wrap gap-2">{recent.map(item=><button type="button" disabled={disabled} key={item.kanji} className="writing-chip" onClick={()=>choose(item.kanji)}>{item.kanji}</button>)}</div></div>}
      </div>
    </div>
  </details>
}

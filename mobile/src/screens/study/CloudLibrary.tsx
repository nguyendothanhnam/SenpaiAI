import { useState } from 'react'
import { Alert, View } from 'react-native'
import { useQuery, useQueryClient } from 'react-query'
import { AppText, Badge, Button, Card, Loading, Muted, Progress, Screen, Title, styles } from '../../components/ui'
import { flashcardsAPI as api } from '../../api/flashcards'
import { useStudy } from '../../features/study/useStudy'
import { legacyCloudDeck } from '../../features/flashcards/helpers'
import { CloudBack, CloudError, CloudSelect, CloudSpeech, go, useCloudWords, useCloudWork } from '../../features/flashcards/ui'
import { useFlashcardSpeech } from '../../features/flashcards/useSpeech'
import { Field, StudyList } from './shared'
const levels=['N5','N4','N3','N2','N1']

export function CloudLibrary({account}:{account:number}){
  const{f,s,language}=useCloudWords(),work=useCloudWork(),cache=useQueryClient(),local=useStudy()
  const[search,setSearch]=useState(''),[level,setLevel]=useState(''),[topic,setTopic]=useState(''),[sort,setSort]=useState('recent'),[transferred,setTransferred]=useState(false)
  const list=useQuery(['cloud-flashcards',account,'list',search,level,topic,sort],()=>api.list({search,...(level?{level}:{}),...(topic?{topic}:{}),sort}))
  const stats=useQuery(['cloud-flashcards',account,'stats'],()=>api.stats())
  const legacy=local.sets.filter(set=>set.kind==='flashcard')
  const refresh=()=>cache.invalidateQueries(['cloud-flashcards',account])
  const transfer=()=>Alert.alert(f('legacyTitle'),f('transferConfirm'),[{text:s('cancel'),style:'cancel'},{text:f('transfer'),onPress:()=>void work.run(async()=>{
    let batch:ReturnType<typeof legacyCloudDeck>[]=[],count=0
    for(const set of legacy){if(count+set.cards.length>10000){await api.transfer(batch);batch=[];count=0}batch.push(legacyCloudDeck(set));count+=set.cards.length}
    if(batch.length)await api.transfer(batch)
    setTransferred(true);await refresh()
  })}])
  return <StudyList data={list.data?.items||[]} keyExtractor={d=>String(d.id)} refreshing={list.isRefetching} onRefresh={()=>void refresh()} header={<View style={{gap:14}}><Title>{f('title')}</Title><Muted>{f('subtitle')}</Muted><View style={styles.row}><Button title={f('create')} onPress={()=>go('editor')}/><Button secondary title={f('today',{count:stats.data?.due_today||0})} onPress={()=>go('flip')}/><Button secondary title={s('statistics')} onPress={()=>go('stats')}/></View>
    {!!legacy.length&&<Card><Title>{f('legacyTitle')}</Title><Muted>{f('legacyInfo',{count:legacy.length})}</Muted>{legacy.map(set=><AppText key={set.id}>{set.name} · {set.cards.length}</AppText>)}<Button title={f('transfer')} disabled={work.busy||!local.writable} onPress={transfer}/><Muted>{f(transferred?'transferDone':'localKept')}</Muted></Card>}
    {local.query.data?.warning&&<Muted>{f('legacyInvalid')}</Muted>}<Field label={f('search')} value={search} onChange={setSearch} limit={160}/><CloudSelect label={f('level')} value={level} options={['',...levels].map(v=>({value:v,label:v||f('all')}))} onChange={setLevel}/><Field label={f('topic')} value={topic} onChange={setTopic} limit={100}/><CloudSelect label={f('sort')} value={sort} options={['recent','name','progress'].map(v=>({value:v,label:f(v)}))} onChange={setSort}/><CloudError error={work.error||list.error||stats.error} retry={()=>void refresh()}/>{list.isLoading&&<Loading/>}{list.data?.total===0&&<Muted>{f('empty')}</Muted>}
    </View>} renderItem={({item:deck})=><Card style={{marginTop:12}}><Title>{deck.title}</Title><View style={styles.row}><Badge>{deck.jlpt_level||f('mixed')}</Badge><Muted>{deck.topic}</Muted></View><AppText>{f('cardCount',{count:deck.stats.total})}</AppText><Progress current={deck.stats.mastered_percent} total={100}/><Muted>{f('masteredPercent',{value:deck.stats.mastered_percent})}</Muted><Muted>{f('lastStudy')}: {deck.stats.last_studied_at?new Date(deck.stats.last_studied_at).toLocaleDateString(language):f('notYet')}</Muted><View style={styles.row}><Button title={f('open')} onPress={()=>go('detail',deck.id)}/><Button secondary title={f('duplicate')} disabled={work.busy} onPress={()=>void work.run(async()=>{await api.duplicate(deck.id);await refresh()})}/><Button secondary title={f('delete')} disabled={work.busy} onPress={()=>Alert.alert(f('delete'),f('deleteConfirm'),[{text:s('cancel'),style:'cancel'},{text:f('delete'),style:'destructive',onPress:()=>void work.run(async()=>{await api.remove(deck.id);await refresh()})}])}/></View></Card>}/>
}

export function CloudDetail({account,id}:{account:number;id?:number}){
  const{f,s}=useCloudWords(),speech=useFlashcardSpeech(),work=useCloudWork(),cache=useQueryClient()
  const query=useQuery(['cloud-flashcards',account,'detail',id],()=>api.detail(id!),{enabled:!!id})
  if(query.isLoading)return <Loading/>
  if(!query.data)return <Screen><CloudError error={query.error||new Error('flashcards.notFound')} retry={()=>void query.refetch()}/><CloudBack/></Screen>
  const deck=query.data
  return <StudyList data={deck.cards} keyExtractor={card=>String(card.id)} header={<View style={{gap:14}}><Title>{deck.title}</Title>{!!deck.description&&<AppText>{deck.description}</AppText>}<Muted>{deck.jlpt_level||f('mixed')} · {deck.topic}</Muted><Progress current={deck.stats.mastered_percent} total={100}/><Muted>{f('masteredPercent',{value:deck.stats.mastered_percent})}</Muted><View style={styles.row}>{(['new','learning','mastered']as const).map(state=><Badge key={state}>{f(state)}: {deck.stats[state]||0}</Badge>)}</View><View style={styles.row}>{(['flip','learn','test','stats','editor']as const).map(view=><Button key={view} secondary={view!=='flip'} title={view==='flip'?f('flipMode'):view==='editor'?f('edit'):s(view==='stats'?'statistics':view)} onPress={()=>go(view,id)}/>)}</View><CloudSpeech speech={speech}/><CloudError error={work.error}/><CloudBack/></View>} renderItem={({item:card})=><Card style={{marginTop:12}}><Title>{card.front}</Title>{!!card.reading&&<AppText>{card.reading}</AppText>}<AppText>{card.back}</AppText>{!!card.note&&<Muted>{card.note}</Muted>}<Muted>{f(card.progress?.state||'new')}</Muted><View style={styles.row}><Button secondary title={f('star',{front:card.front})+(card.progress?.starred?' ★':' ☆')} disabled={work.busy} onPress={()=>void work.run(async()=>{await api.star(id!,card.id!,!card.progress?.starred);await cache.invalidateQueries(['cloud-flashcards',account])})}/><Button secondary title={f('listen')} disabled={!speech.available||!speech.enabled} onPress={()=>void speech.speak(card)}/></View></Card>}/>
}

export function CloudStatistics({account,id}:{account:number;id?:number}){
  const{s,language}=useCloudWords(),[offset,setOffset]=useState(0)
  const stats=useQuery(['cloud-flashcards',account,'stats',id],()=>api.stats(id))
  const history=useQuery(['cloud-flashcards',account,'history',id,offset],()=>api.history(id,offset))
  return <Screen><Title>{s('statistics')}</Title><CloudError error={stats.error||history.error} retry={()=>{void stats.refetch();void history.refetch()}}/>{stats.isLoading&&<Loading/>}{stats.data&&<Card>{(['new','learning','mastered','accuracy','review_streak','due_today']as const).map(key=><AppText key={key}>{s(key)}: {stats.data[key]||0}{key==='accuracy'?'%':''}</AppText>)}</Card>}<Title>{s('history')}</Title>{history.data?.total===0&&<Muted>{s('noHistory')}</Muted>}{history.data?.items.map(row=><Card key={row.id}><AppText>{s(row.mode)} · {new Date(row.created_at).toLocaleString(language)}</AppText><AppText>{s('result',{...row})}</AppText><Button secondary title={s('review')} onPress={()=>go(row.mode==='learn'?'learn':'test',row.deck_id,row.id)}/></Card>)}<View style={styles.row}><Button secondary title={s('previous')} disabled={!offset} onPress={()=>setOffset(v=>Math.max(0,v-20))}/><Button secondary title={s('next')} disabled={offset+20>=(history.data?.total||0)} onPress={()=>setOffset(v=>v+20)}/></View><CloudBack id={id}/></Screen>
}

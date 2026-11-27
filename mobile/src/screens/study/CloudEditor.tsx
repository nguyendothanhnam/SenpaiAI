import { useEffect, useRef, useState } from 'react'
import { Alert, View } from 'react-native'
import { router } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as DocumentPicker from 'expo-document-picker'
import { File, Paths } from 'expo-file-system'
import { useQuery, useQueryClient } from 'react-query'
import { AppText, Button, Card, Loading, Muted, Screen, Title, styles } from '../../components/ui'
import { flashcardsAPI as api } from '../../api/flashcards'
import type { DeckInput, FlashCard, TextPreview } from '../../../../shared-games/flashcard-types'
import { flashcardDraftKey, validateCloudDeck } from '../../features/flashcards/helpers'
import { CloudBack, CloudError, CloudSelect, useCloudWords, useCloudWork } from '../../features/flashcards/ui'
import { Field, StudyList, useLeaveGuard } from './shared'
import { utf8Bytes } from '../../features/study/validation'

const blank=():FlashCard=>({front:'',back:'',reading:'',note:''})
const empty=():DeckInput=>({title:'',description:'',jlpt_level:null,topic:'',cards:[]})
export function CloudEditor({account,id}:{account:number;id?:number}){
  const{f,s}=useCloudWords(),work=useCloudWork(),cache=useQueryClient(),key=flashcardDraftKey(account,id)
  const[form,setForm]=useState<DeckInput>(empty),[ready,setReady]=useState(false),[saved,setSaved]=useState(false),[draft,setDraft]=useState('draftSaving')
  const[text,setText]=useState(''),[field,setField]=useState('\t'),[separator,setSeparator]=useState('\n'),[preview,setPreview]=useState<TextPreview|null>(null),[bulk,setBulk]=useState(false)
  const initialized=useRef(false),alive=useRef(true),savedRef=useRef(false),draftQueue=useRef(Promise.resolve())
  const loaded=useQuery(['cloud-flashcards',account,'detail',id],()=>api.detail(id!),{enabled:!!id})
  const disableGuard=useLeaveGuard(ready&&!saved&&!!(form.title||form.cards.length),work.busy&&!saved)
  useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
  useEffect(()=>{
    if(initialized.current||id&&!loaded.data)return
    initialized.current=true
    const base:DeckInput=loaded.data?{title:loaded.data.title,description:loaded.data.description,jlpt_level:loaded.data.jlpt_level,topic:loaded.data.topic,cards:loaded.data.cards}:empty()
    void AsyncStorage.getItem(key).then(raw=>{if(!alive.current)return;const value=raw?JSON.parse(raw):base;if(!value||typeof value.title!=='string'||typeof value.description!=='string'||typeof value.topic!=='string'||!Array.isArray(value.cards)||value.cards.length>500||!value.cards.every((c:FlashCard)=>c&&['front','back','reading','note'].every(k=>typeof c[k as keyof FlashCard]==='string')))throw Error('draft');setForm(value);setReady(true)}).catch(()=>{if(alive.current){setForm(base);setReady(true);setDraft('draftError')}})
  },[id,loaded.data,key])
  useEffect(()=>{
    if(!ready||saved)return
    setDraft('draftSaving')
    const timer=setTimeout(()=>{const raw=JSON.stringify(form);if(utf8Bytes(raw)>1536*1024){setDraft('draftError');return}draftQueue.current=draftQueue.current.catch(()=>undefined).then(async()=>{if(savedRef.current||!alive.current)return;await AsyncStorage.setItem(key,raw);if(alive.current&&!savedRef.current)setDraft('draftSaved')}).catch(()=>{if(alive.current)setDraft('draftError')})},600)
    return()=>clearTimeout(timer)
  },[ready,form,key,saved])
  async function save(){
    const invalid=validateCloudDeck(form);if(invalid)throw Error(`flashcards.${invalid}`)
    const deck=await api.save(id,{...form,cards:form.cards.map(c=>({id:c.id,front:c.front,back:c.back,reading:c.reading,note:c.note}))})
    savedRef.current=true;await draftQueue.current
    try{await AsyncStorage.removeItem(key)}catch{/* Account copy is saved. */}
    if(!alive.current)return
    setSaved(true);disableGuard();await cache.invalidateQueries(['cloud-flashcards',account]);router.replace({pathname:'/study/flashcard-detail',params:{id:String(deck.id)}})
  }
  async function pickFile(){
    let file:File|undefined
    try{
      const result=await DocumentPicker.getDocumentAsync({type:'*/*',multiple:false,copyToCacheDirectory:true})
      if(result.canceled||!alive.current)return
      const asset=result.assets[0];file=new File(asset.uri)
      if(!/\.(csv|json|xlsx|xls)$/i.test(asset.name))throw Error('flashcards.fileError')
      const size=file.exists?file.size:asset.size
      if(!size||size>5*1024*1024)throw Error('flashcards.fileTooLarge')
      const resultData=await api.importFile({...asset,size})
      if(alive.current)setPreview({cards:resultData.cards.map(c=>({...blank(),...c})),errors:[]})
    }finally{if(file?.uri.startsWith(Paths.cache.uri)){try{file.delete()}catch{/* OS cache only. */}}}
  }
  function change(index:number,side:'front'|'back'|'reading'|'note',value:string){setForm(current=>({...current,cards:current.cards.map((c,i)=>i===index?{...c,[side]:value}:c)}))}
  function move(index:number,delta:number){setForm(current=>{const cards=[...current.cards];[cards[index],cards[index+delta]]=[cards[index+delta],cards[index]];return{...current,cards}})}
  if(loaded.isError)return <Screen><CloudError error={loaded.error} retry={()=>void loaded.refetch()}/><CloudBack/></Screen>
  if(!ready)return <Loading/>
  return <StudyList data={form.cards.map((card,index)=>({card,index}))} keyExtractor={({card,index})=>String(card.id||`new-${index}`)} header={<View style={{gap:14}}><Title>{f(id?'edit':'create')}</Title><Field label={f('deckTitle')} value={form.title} limit={160} onChange={title=>setForm({...form,title})} disabled={work.busy}/><Field label={f('description')} value={form.description} limit={2000} multiline onChange={description=>setForm({...form,description})} disabled={work.busy}/><CloudSelect label={f('level')} value={form.jlpt_level||''} options={['','N5','N4','N3','N2','N1'].map(value=>({value,label:value||f('mixed')}))} onChange={jlpt_level=>setForm({...form,jlpt_level:jlpt_level||null})}/><Field label={f('topic')} value={form.topic} limit={100} onChange={topic=>setForm({...form,topic})} disabled={work.busy}/><Muted>{f(draft)}</Muted><CloudError error={work.error}/>
    <Button secondary title={f('bulkImport')} disabled={work.busy} onPress={()=>setBulk(v=>!v)}/>{bulk&&<Card><Muted>{f('bulkHelp')}</Muted><CloudSelect label={f('fieldSeparator')} value={field} options={['\t',';',',','::'].map(value=>({value,label:value==='\t'?f('tab'):value}))} onChange={value=>{setField(value);setPreview(null)}}/><CloudSelect label={f('cardSeparator')} value={separator} options={['\n','|','\n\n'].map(value=>({value,label:value==='\n'?f('newline'):value==='\n\n'?f('blankLine'):value}))} onChange={value=>{setSeparator(value);setPreview(null)}}/><Field label={f('paste')} value={text} limit={500000} multiline onChange={value=>{setText(value);setPreview(null)}} disabled={work.busy}/><Button secondary title={f('preview')} disabled={work.busy} onPress={()=>void work.run(async()=>setPreview(await api.preview(text,field,separator)))}/><Button secondary title={f('file')} disabled={work.busy} onPress={()=>void work.run(pickFile)}/>{preview&&<><AppText>{f('cardCount',{count:preview.cards.length})}</AppText>{preview.errors.map((e,i)=><AppText key={i} accessibilityRole="alert">{f('lineError',{line:e.line})}: {f(e.code==='duplicate'?'duplicateCard':e.code)}</AppText>)}{preview.cards.slice(0,20).map((c,i)=><AppText key={i}>{c.front} → {c.back}</AppText>)}{preview.cards.length>20&&<Muted>{s('previewLimit')}</Muted>}<Button title={f('append')} disabled={work.busy||!!preview.errors.length||!preview.cards.length} onPress={()=>{const next={...form,cards:[...form.cards,...preview.cards.map(c=>({...blank(),...c,id:undefined}))]},invalid=validateCloudDeck({...next,title:next.title||'_'});if(invalid){work.setError(Error(`flashcards.${invalid}`));return}setForm(next);setPreview(null)}}/></>}</Card>}
  </View>} renderItem={({item:{card,index}})=><Card style={{marginTop:14}}><Title>{f('cardNumber',{number:index+1})}</Title>{(['front','back','reading','note']as const).map(side=><Field key={side} label={f(side)} value={card[side]} limit={{front:1000,back:2000,reading:500,note:2000}[side]} multiline onChange={value=>change(index,side,value)} disabled={work.busy}/>)}<View style={styles.row}><Button secondary title={f('moveUp',{number:index+1})} disabled={work.busy||index===0} onPress={()=>move(index,-1)}/><Button secondary title={f('moveDown',{number:index+1})} disabled={work.busy||index===form.cards.length-1} onPress={()=>move(index,1)}/><Button secondary title={f('deleteCard',{number:index+1})} disabled={work.busy} onPress={()=>setForm(current=>({...current,cards:current.cards.filter((_,i)=>i!==index)}))}/></View></Card>}
    footer={<View style={{gap:12,marginTop:14}}><Button secondary title={f('addCard')} disabled={work.busy||form.cards.length>=500} onPress={()=>setForm(current=>({...current,cards:[...current.cards,blank()]}))}/><Button title={f(work.busy?'saving':'save')} disabled={work.busy} onPress={()=>void work.run(save)}/><Button secondary title={f('discard')} disabled={work.busy} onPress={()=>Alert.alert(f('discard'),f('discardConfirm'),[{text:s('cancel'),style:'cancel'},{text:f('discard'),style:'destructive',onPress:()=>void work.run(async()=>{savedRef.current=true;await draftQueue.current;await AsyncStorage.removeItem(key);setSaved(true);disableGuard();router.back()})}])}/><CloudError error={work.error}/></View>}/>
}

import { useEffect, useRef, useState } from 'react'
import { Switch, View } from 'react-native'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { AppText, Button, Card, Muted, styles } from '../../components/ui'
import { ChoiceSheet } from '../../components/ChoiceSheet'
import { useTheme } from '../../theme/ThemeProvider'
export const cloudRoutes={library:'/study/flashcard',detail:'/study/flashcard-detail',editor:'/study/flashcard-editor',flip:'/study/flashcard-play',learn:'/study/flashcard-learn',test:'/study/flashcard-test',stats:'/study/flashcard-stats'} as const
export type CloudView=keyof typeof cloudRoutes
export function go(view:CloudView,id?:number,attempt?:string){router.push({pathname:cloudRoutes[view],params:{...(id?{id:String(id)}:{}),...(attempt?{attempt}:{})}})}
export function useCloudWords(){const{t,i18n}=useTranslation('common');return{f:(key:string,values?:Record<string,unknown>)=>String(t(`flashcardsManager.${key}`,values)),s:(key:string,values?:Record<string,unknown>)=>String(t(`flashcardsStudy.${key}`,values)),language:i18n.language}}
export function CloudToggle({label,value,onChange,disabled=false}:{label:string;value:boolean;onChange:(value:boolean)=>void;disabled?:boolean}){const{colors}=useTheme();return <View style={styles.row}><Switch accessibilityLabel={label} value={value} disabled={disabled} onValueChange={onChange} trackColor={{true:colors.primary,false:colors.border}}/><AppText style={{flex:1}}>{label}</AppText></View>}
export function CloudSelect({label,value,options,onChange}:{label:string;value:string;options:{value:string;label:string}[];onChange:(value:string)=>void}){const[open,setOpen]=useState(false);return <><Button secondary title={`${label}: ${options.find(o=>o.value===value)?.label||value}`} onPress={()=>setOpen(true)}/><ChoiceSheet animationType="none" visible={open} title={label} value={value} options={options} onClose={()=>setOpen(false)} onSelect={onChange}/></>}
export function CloudError({error,retry}:{error:unknown;retry?:()=>void}){
  const{f}=useCloudWords();if(!error)return null
  const detail=(error as {response?:{data?:{detail?:unknown}}})?.response?.data?.detail
  const raw=typeof detail==='string'?detail:error instanceof Error?error.message:''
  return <Card><AppText accessibilityRole="alert">{raw.startsWith('flashcards.')?f(raw.slice(11)):f('error')}</AppText>{retry&&<Button secondary title={f('retry')} onPress={retry}/>}</Card>
}
export function useCloudWork(){
  const lock=useRef(false),alive=useRef(true),[busy,setBusy]=useState(false),[error,setError]=useState<unknown>()
  useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
  async function run(action:()=>Promise<void>){if(lock.current||!alive.current)return;lock.current=true;setBusy(true);setError(undefined);try{await action()}catch(e){if(alive.current)setError(e)}finally{lock.current=false;if(alive.current)setBusy(false)}}
  return{busy,error,setError,run}
}
export function CloudBack({id}:{id?:number}){const{f}=useCloudWords();return <Button secondary title={f(id?'open':'title')} onPress={()=>go(id?'detail':'library',id)}/>}
export function CloudSpeech({speech}:{speech:{enabled:boolean;available:boolean;toggle:(value:boolean)=>void}}){const{f}=useCloudWords();return <><CloudToggle label={f('speech')} value={speech.enabled} onChange={speech.toggle} disabled={!speech.available}/>{!speech.available&&<Muted>{f('noVoice')}</Muted>}</>}

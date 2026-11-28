import { useCallback, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, AppState, PanResponder, Pressable, View } from 'react-native'
import { useQuery, useQueryClient } from 'react-query'
import { AppText, Button, Card, Loading, Muted, Progress, Screen, Title, styles } from '../../components/ui'
import { flashcardsAPI as api } from '../../api/flashcards'
import type { FlashCard, ReviewPayload } from '../../../../shared-games/flashcard-types'
import { selectFlipCards, flashcardRequestKey } from '../../features/flashcards/helpers'
import { useFlashcardSpeech } from '../../features/flashcards/useSpeech'
import { CloudBack, CloudError, CloudSelect, CloudSpeech, CloudToggle, useCloudWords, useCloudWork } from '../../features/flashcards/ui'
import { Field, useLeaveGuard } from './shared'

export function CloudFlip({account,id}:{account:number;id?:number}){
  const{f,s}=useCloudWords(),work=useCloudWork(),speech=useFlashcardSpeech(),cache=useQueryClient()
  const source=useQuery(['cloud-flashcards',account,'flipSource',id],()=>id?api.detail(id).then(d=>({cards:d.cards,title:d.title,total:d.cards.length})):api.queue().then(q=>({cards:q.items,title:'',total:q.total})))
  const[starred,setStarred]=useState(false),[shuffle,setShuffle]=useState(false),[tracking,setTracking]=useState(true),[first,setFirst]=useState('front'),[seconds,setSeconds]=useState('5'),[auto,setAuto]=useState(false)
  const[cards,setCards]=useState<FlashCard[]|null>(null),[index,setIndex]=useState(0),[flipped,setFlipped]=useState(false),[marks,setMarks]=useState<Record<number,boolean>>({}),[done,setDone]=useState(false),[saved,setSaved]=useState(false)
  const[reduce,setReduce]=useState(true),rotation=useRef(new Animated.Value(0)).current,[heights,setHeights]=useState({front:260,back:260})
  const side=useRef<boolean[]>([]),payload=useRef<ReviewPayload|null>(null),request=useRef(flashcardRequestKey()),start=useRef(Date.now()),marking=useRef(false)
  useLeaveGuard(!!cards&&!done||done&&tracking&&!saved,work.busy)
  useEffect(()=>{let alive=true;void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(alive)setReduce(value)});const listener=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduce);return()=>{alive=false;listener.remove()}},[])
  useEffect(()=>{if(reduce){rotation.setValue(flipped?1:0);return}const animation=Animated.timing(rotation,{toValue:flipped?1:0,duration:260,useNativeDriver:true});animation.start();return()=>animation.stop()},[flipped,reduce,rotation])
  useEffect(()=>{marking.current=false},[index,cards])
  const move=useCallback((next:number)=>{setFlipped(false);rotation.setValue(0);setIndex(next)},[rotation])
  const mark=useCallback((correct:boolean)=>{
    if(!cards||done||marking.current)return
    marking.current=true;const updated={...marks,[cards[index].id!]:correct};setMarks(updated);setFlipped(false)
    if(index+1<cards.length)move(index+1)
    else{const missing=cards.findIndex(c=>updated[c.id!]===undefined);if(missing>=0)move(missing);else{setDone(true);setAuto(false)}}
  },[cards,done,marks,index,move])
  const pan=PanResponder.create({onMoveShouldSetPanResponder:(_,g)=>!work.busy&&!done&&Math.abs(g.dx)>25&&Math.abs(g.dy)<20,onPanResponderRelease:(_,g)=>{if(Math.abs(g.dx)>70&&Math.abs(g.dy)<50)mark(g.dx>0)}})
  useEffect(()=>{
    if(!auto||!cards||done)return
    const timer=setInterval(()=>{if(AppState.currentState!=='active')return;if(!flipped)setFlipped(true);else if(index+1<cards.length)move(index+1);else setAuto(false)},Math.max(2,Math.min(60,Number(seconds)||5))*1000)
    return()=>clearInterval(timer)
  },[auto,cards,done,flipped,index,seconds,move])
  const correct=Object.values(marks).filter(Boolean).length,total=Object.keys(marks).length,wrong=total-correct,accuracy=total?Math.round(correct/total*100):0
  async function save(){
    if(!tracking||saved||!total)return
    if(!payload.current)payload.current={request_id:request.current,mode:'flip',duration_seconds:Math.min(14400,Math.round((Date.now()-start.current)/1000)),results:Object.entries(marks).map(([card_id,value])=>({card_id:Number(card_id),correct:value}))}
    await api.review(payload.current);setSaved(true);await cache.invalidateQueries(['cloud-flashcards',account])
  }
  useEffect(()=>{if(done&&tracking&&total)void work.run(save)
    // Freeze the completed batch. Retry is explicit and keeps the same key/body.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[done])
  function begin(repeat=false){const selected=repeat?cards?.filter(c=>marks[c.id!]===false)||[]:selectFlipCards(source.data?.cards||[],starred,shuffle);side.current=selected.map(()=>first==='random'?Math.random()<.5:first==='back');setCards(selected);setMarks({});setDone(false);setSaved(false);payload.current=null;request.current=flashcardRequestKey();start.current=Date.now();marking.current=false;move(0)}
  if(source.isLoading)return <Loading/>
  if(source.isError)return <Screen><CloudError error={source.error} retry={()=>void source.refetch()}/><CloudBack id={id}/></Screen>
  if(!cards)return <Screen><Title>{source.data?.title||f('todayTitle')}</Title><Muted>{f('cardCount',{count:source.data?.cards.length||0})}</Muted>{(source.data?.total||0)>500&&<Muted>{f('queueLimit')}</Muted>}<CloudToggle label={f('starredOnly')} value={starred} onChange={setStarred}/><CloudToggle label={f('shuffle')} value={shuffle} onChange={setShuffle}/><CloudToggle label={f('tracking')} value={tracking} onChange={setTracking}/><Muted>{f('trackingHelp')}</Muted><CloudSelect label={f('firstSide')} value={first} options={['front','back','random'].map(value=>({value,label:f(value)}))} onChange={setFirst}/><CloudSpeech speech={speech}/><Button title={f('start')} disabled={!selectFlipCards(source.data?.cards||[],starred,false).length} onPress={()=>begin()}/><CloudBack id={id}/></Screen>
  if(done)return <Screen><Title>{f('summary')}</Title><Card><AppText>{f('sessionSummary',{total,correct,wrong,accuracy})}</AppText><Muted>{f(!tracking?'untracked':saved?'saved':work.busy?'saving':'notSaved')}</Muted></Card><CloudError error={work.error}/>{tracking&&!saved&&<Button title={f('retry')} disabled={work.busy} onPress={()=>void work.run(save)}/>}<Button secondary title={f('repeatWrong')} disabled={!wrong||work.busy||(tracking&&!saved)} onPress={()=>begin(true)}/><CloudBack id={id}/></Screen>
  const card=cards[index],front=side.current[index]?card.back:card.front,back=side.current[index]?card.front:card.back
  return <Screen solid><Title>{source.data?.title||f('todayTitle')}</Title><Muted>{f('position',{current:index+1,total:cards.length,remaining:cards.length-total})}</Muted><Progress current={total} total={cards.length}/><Pressable {...pan.panHandlers} accessibilityRole="button" accessibilityLabel={`${f('flip')}: ${flipped?back:front}`} style={{minHeight:Math.max(heights.front,heights.back)}} onPress={()=>setFlipped(v=>!v)}>
    <Animated.View accessibilityElementsHidden={flipped} importantForAccessibility={flipped?'no-hide-descendants':'auto'} onLayout={e=>{const height=e.nativeEvent.layout.height;setHeights(current=>current.front===height?current:{...current,front:height})}} style={{backfaceVisibility:'hidden',transform:[{perspective:1000},{rotateY:rotation.interpolate({inputRange:[0,1],outputRange:['0deg','180deg']})}]}}><Card style={{minHeight:260,justifyContent:'center'}}><Muted>{f(side.current[index]?'back':'front')}</Muted><AppText style={{fontSize:28,lineHeight:38}}>{front}</AppText></Card></Animated.View>
    <Animated.View accessibilityElementsHidden={!flipped} importantForAccessibility={!flipped?'no-hide-descendants':'auto'} onLayout={e=>{const height=e.nativeEvent.layout.height;setHeights(current=>current.back===height?current:{...current,back:height})}} style={{position:'absolute',top:0,left:0,right:0,backfaceVisibility:'hidden',transform:[{perspective:1000},{rotateY:rotation.interpolate({inputRange:[0,1],outputRange:['180deg','360deg']})}]}}><Card style={{minHeight:260,justifyContent:'center'}}><AppText style={{fontSize:28,lineHeight:38}}>{back}</AppText>{!!card.reading&&<AppText>{card.reading}</AppText>}{!!card.note&&<Muted>{card.note}</Muted>}</Card></Animated.View>
    </Pressable><Muted>{s('swipeHelp')}</Muted><View style={styles.row}><Button title={f('remembered')} onPress={()=>mark(true)}/><Button secondary title={f('stillLearning')} onPress={()=>mark(false)}/></View><View style={styles.row}><Button secondary title={f('previous')} disabled={!index} onPress={()=>move(index-1)}/><Button secondary title={f('next')} disabled={index===cards.length-1} onPress={()=>move(index+1)}/><Button secondary title={f('listen')} disabled={!speech.enabled||!speech.available} onPress={()=>void speech.speak(card)}/></View><CloudSpeech speech={speech}/><CloudToggle label={f('auto')} value={auto} onChange={setAuto}/><Field label={f('seconds')} value={seconds} onChange={setSeconds} limit={2}/><Muted>{f('autoHelp')}</Muted><Button secondary title={f('finish')} disabled={!total} onPress={()=>{setDone(true);setAuto(false)}}/><CloudError error={work.error}/></Screen>
}

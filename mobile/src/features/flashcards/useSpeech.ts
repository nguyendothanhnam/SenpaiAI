import { useEffect, useState } from 'react'
import { AppState } from 'react-native'
import * as Speech from 'expo-speech'
import type { FlashCard } from '../../../../shared-games/flashcard-types'
export function useFlashcardSpeech(){
  const[voice,setVoice]=useState<string>(),[enabled,setEnabled]=useState(false),[failed,setFailed]=useState(false)
  useEffect(()=>{
    let alive=true
    void Speech.getAvailableVoicesAsync().then(voices=>{if(alive)setVoice(voices.find(v=>v.language.toLowerCase().startsWith('ja'))?.identifier)}).catch(()=>{if(alive)setFailed(true)})
    const listener=AppState.addEventListener('change',state=>{if(state!=='active')void Speech.stop().catch(()=>undefined)})
    return()=>{alive=false;listener.remove();void Speech.stop().catch(()=>undefined)}
  },[])
  async function speak(card:FlashCard){
    if(!enabled||!voice||failed)return
    try{await Speech.stop();Speech.speak((card.reading||(/[\u3040-\u30ff\u3400-\u9fff]/.test(card.front)?card.front:card.back)).slice(0,Speech.maxSpeechInputLength),{voice,language:'ja-JP',onError:()=>setFailed(true)})}catch{setFailed(true)}
  }
  return{enabled,available:!!voice&&!failed,toggle:(value:boolean)=>{setEnabled(value);if(!value)void Speech.stop().catch(()=>undefined)},speak}
}

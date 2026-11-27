import { useLocalSearchParams } from 'expo-router'
import { useAuth } from '../../auth/AuthProvider'
import { Muted, Screen } from '../../components/ui'
import { useCloudWords, type CloudView } from '../../features/flashcards/ui'
import { CloudLibrary, CloudDetail, CloudStatistics } from './CloudLibrary'
import { CloudEditor } from './CloudEditor'
import { CloudFlip } from './CloudFlip'
import { CloudAssessment } from './CloudAssessment'
export function CloudFlashcardsScreen({view}:{view:CloudView}){
  const{user}=useAuth(),{f}=useCloudWords(),params=useLocalSearchParams<{id?:string;attempt?:string}>()
  const id=params.id&&/^\d+$/.test(params.id)?Number(params.id):undefined
  if(!user)return <Screen><Muted>{f('signIn')}</Muted></Screen>
  const props={account:user.id,id},key=`${user.id}:${view}:${id||'new'}:${params.attempt||''}`
  if(params.id&&!id)return <Screen><Muted>{f('notFound')}</Muted></Screen>
  if(view==='library')return <CloudLibrary key={key} account={user.id}/>
  if(view==='detail')return <CloudDetail key={key} {...props}/>
  if(view==='editor')return <CloudEditor key={key} {...props}/>
  if(view==='flip')return <CloudFlip key={key} {...props}/>
  if(view==='stats')return <CloudStatistics key={key} {...props}/>
  return <CloudAssessment key={key} {...props} mode={view} attempt={params.attempt}/>
}

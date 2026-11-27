import { useLocalSearchParams } from 'expo-router'
import { StudyImportScreen } from '../../src/screens/study/StudyImportScreen'
import { CloudFlashcardsScreen } from '../../src/screens/study/CloudFlashcardsScreen'
export default function Import(){const{kind}=useLocalSearchParams<{kind?:string}>();return kind==='flashcard'?<CloudFlashcardsScreen view="editor"/>:<StudyImportScreen/>}

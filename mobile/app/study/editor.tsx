import { useLocalSearchParams } from 'expo-router'
import { StudyEditorScreen } from '../../src/screens/study/StudyEditorScreen'
import { CloudFlashcardsScreen } from '../../src/screens/study/CloudFlashcardsScreen'
export default function Editor(){const{kind}=useLocalSearchParams<{kind?:string}>();return kind==='flashcard'?<CloudFlashcardsScreen view="editor"/>:<StudyEditorScreen/>}

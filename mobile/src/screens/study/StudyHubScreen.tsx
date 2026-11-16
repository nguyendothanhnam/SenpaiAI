import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Button, Card, Muted, Screen, Title } from '../../components/ui'

export function StudyHubScreen() {
  const { t } = useTranslation('mobile')
  return <Screen solid><Title>{t('phase4.hub')}</Title><Muted>{t('phase4.localNotice')}</Muted><Card><Title>{t('phase4.quiz')}</Title><Muted>{t('phase4.quizHint')}</Muted><Button title={t('phase4.openQuiz')} onPress={() => router.push('/study/quiz')} /></Card><Card><Title>{t('phase4.flashcard')}</Title><Muted>{t('phase4.flashHint')}</Muted><Button title={t('phase4.openFlashcard')} onPress={() => router.push('/study/flashcard')} /></Card><Card><Title>{t('phase3.kanjiQuiz')}</Title><Button title={t('phase3.kanjiQuiz')} onPress={() => router.push('/kanji-quiz')} /></Card></Screen>
}

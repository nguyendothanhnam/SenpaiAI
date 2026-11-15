import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Button, Card, Muted, Screen, Title } from '../components/ui'
export function PracticeScreen() { const { t } = useTranslation('mobile'); return <Screen><Title>{t('practice')}</Title><Card><Title>{t('phase2.grammar')}</Title><Muted>{t('phase2.grammarHint')}</Muted><Button title={t('phase2.openGrammar')} onPress={() => router.push('/grammar')} /></Card><Card><Title>{t('phase3.kanji')}</Title><Muted>{t('phase3.kanjiHint')}</Muted><Button title={t('phase3.openKanji')} onPress={() => router.push('/kanji')} /></Card><Card><Title>{t('phase4.hub')}</Title><Muted>{t('phase4.localNotice')}</Muted><Button title={t('phase4.openHub')} onPress={() => router.push('/study')} /></Card></Screen> }

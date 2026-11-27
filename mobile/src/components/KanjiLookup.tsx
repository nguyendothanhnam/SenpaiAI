import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'
import { splitKanjiText } from '@games/kanjiText'
import { kanjiAPI } from '../api/phase3'
import { useTheme } from '../theme/ThemeProvider'

const Context = createContext<((value: string) => void) | null>(null)
export function KanjiText({ text }: { text: string }) {
  const open = useContext(Context)
  const { t } = useTranslation('common')
  const runs = useMemo(() => splitKanjiText(text), [text])
  return <>{runs.map((run, index) => run.han && open ? <Text key={index} accessibilityRole="button" accessibilityLabel={t('kanjiLookup.openCharacter', { kanji: run.text })} onPress={() => open(run.text)}>{run.text}</Text> : run.text)}</>
}

export function KanjiLookupProvider({ children }: { children: ReactNode }) {
  const [character, setCharacter] = useState('')
  const { colors } = useTheme()
  const { t } = useTranslation('common')
  const query = useQuery(['kanji-detail', character], () => kanjiAPI.detail(character), { enabled: !!character, staleTime: 3600000, retry: false })
  const item = query.data
  const close = () => setCharacter('')
  return <Context.Provider value={setCharacter}>{children}<Modal transparent visible={!!character} animationType="slide" onRequestClose={close}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim }}>
      <Pressable style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={t('kanjiLookup.close')} onPress={close} />
      <SafeAreaView edges={['bottom']} accessibilityViewIsModal style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%', padding: 20 }}>
        <ScrollView><Text accessibilityRole="header" style={{ color: colors.primary, fontSize: 56, textAlign: 'center' }}>{character}</Text>
          {query.isLoading ? <Text style={{ color: colors.text }}>{t('kanjiLookup.loading')}</Text> : query.isError ? <Text accessibilityRole="alert" style={{ color: colors.text }}>{(query.error as { response?: { status?: number } })?.response?.status === 404 ? t('kanjiLookup.unknown') : t('kanjiLookup.loadError')}</Text> : item && <View style={{ gap: 8 }}>
            {!!(item.meaning_vi || item.meaning) && <Text style={{ color: colors.text }}>{item.meaning_vi || item.meaning}</Text>}
            {!!item.onyomi?.length && <Text style={{ color: colors.text }}>{t('kanjiLookup.onyomi')}: {item.onyomi.join('、')}</Text>}
            {!!item.kunyomi?.length && <Text style={{ color: colors.text }}>{t('kanjiLookup.kunyomi')}: {item.kunyomi.join('、')}</Text>}
            {!!(item.stroke_count || item.strokes) && <Text style={{ color: colors.text }}>{t('kanjiLookup.strokeCount', { count: item.stroke_count || item.strokes })}</Text>}
            {!!item.jlpt && <Text style={{ color: colors.text }}>{item.jlpt}</Text>}
            {item.examples?.slice(0, 3).map((example, index) => <Text key={index} style={{ color: colors.text }}>{[example.word, example.reading, example.meaning].filter(Boolean).join(' · ')}</Text>)}
          </View>}
        </ScrollView>
        <Pressable accessibilityRole="button" onPress={() => { const value = character; close(); router.push({ pathname: '/kanji/[character]', params: { character: value } }) }} style={{ padding: 12 }}><Text style={{ color: colors.primary, textAlign: 'center' }}>{t('kanjiLookup.viewDetails')}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={close} style={{ padding: 12 }}><Text style={{ color: colors.primary, textAlign: 'center' }}>{t('kanjiLookup.close')}</Text></Pressable>
      </SafeAreaView>
    </View>
  </Modal></Context.Provider>
}

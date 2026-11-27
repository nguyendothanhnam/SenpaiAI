import { View } from 'react-native'
import { answerLines, inlineParts } from '../features/phase2/messageFormatting'
import { AppText } from './ui'
import { KanjiText } from './KanjiLookup'

export function ChatAnswer({ text }: { text: string }) {
  return <View style={{ gap: 4 }}>{answerLines(text).map((line, index) => line.text.trim()
    ? <AppText key={index} selectable style={{ lineHeight: 27, fontWeight: line.heading ? '700' : '400' }}>
      {inlineParts(line.text).map((part, n) => <AppText key={n} style={{ lineHeight: 27, fontWeight: part.bold || line.heading ? '700' : '400' }}><KanjiText text={part.text} /></AppText>)}
    </AppText>
    : <View key={index} style={{ height: 6 }} />)}</View>
}

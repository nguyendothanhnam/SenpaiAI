import { useState } from 'react'
import { Alert, View } from 'react-native'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { AppText, Badge, Button, Card, Loading, Muted, Title, styles } from '../../components/ui'
import { ChoiceSheet } from '../../components/ChoiceSheet'
import { NameDialog } from '../../components/NameDialog'
import { studyStore, useStudy } from '../../features/study/useStudy'
import type { StudyKind, StudySet } from '../../features/study/types'
import { Field, Issues, StorageNotice, StudyList, useWork } from './shared'

export function StudyLibraryScreen({ kind }: { kind: StudyKind }) {
  const { t, i18n } = useTranslation('mobile'), library = useStudy(), work = useWork()
  const [search, setSearch] = useState(''), [level, setLevel] = useState(''), [category, setCategory] = useState(''), [source, setSource] = useState('')
  const [picker, setPicker] = useState<'level' | 'category' | 'source'>(), [naming, setNaming] = useState<{ set: StudySet; copy: boolean }>()
  const sets = library.sets.filter(set => set.kind === kind)
  const visible = sets.filter(set => (!level || set.jlpt_level === level) && (!category || set.category === category) && (!source || set.source === source) && `${set.name} ${set.file_name}`.toLowerCase().includes(search.trim().toLowerCase()))
  const options = [{ value: '', label: t('phase4.all') }, ...(picker === 'source' ? ['manual', 'imported'] : [...new Set(sets.map(set => picker === 'level' ? set.jlpt_level : set.category).filter(Boolean))]).map(value => ({ value, label: picker === 'source' ? t(`phase4.${value}`) : value }))]
  const locked = work.busy || !library.writable
  const recent = [...sets].filter(set => set.last_studied_at && set.last_accuracy !== null).sort((a, b) => b.last_studied_at!.localeCompare(a.last_studied_at!))[0]
  function remove(set: StudySet) { Alert.alert(t('phase4.delete'), t('phase4.deleteConfirm', { name: set.name }), [{ text: t('phase4.cancel'), style: 'cancel' }, { text: t('phase4.delete'), style: 'destructive', onPress: () => void work.run(async () => { await studyStore.remove(library.account!, set.id); await library.refresh() }) }]) }
  return <>
    <StudyList data={visible} keyExtractor={set => set.id} onRefresh={() => void library.query.refetch()} refreshing={library.query.isRefetching} header={<View style={{ gap: 14 }}>
      <Title>{t(`phase4.${kind}`)}</Title><StorageNotice library={library} />
      <View style={styles.row}><Button title={t('phase4.create')} disabled={locked} onPress={() => router.push({ pathname: '/study/editor', params: { kind } })} /><Button secondary title={t('phase4.import')} disabled={locked} onPress={() => router.push({ pathname: '/study/import', params: { kind } })} /></View>
      {kind === 'flashcard' && <Card><AppText>{t('phase4.libraryStats', { sets: sets.length, cards: sets.reduce((n, set) => n + set.cards.length, 0) })}</AppText><Muted>{t('phase4.recentAccuracy', { value: recent?.last_accuracy === null || recent?.last_accuracy === undefined ? '—' : `${recent.last_accuracy}%` })}</Muted></Card>}
      <Field label={t('phase4.search')} value={search} onChange={setSearch} limit={120} />
      <View style={styles.row}><Button secondary title={`${t('phase4.level')}: ${level || t('phase4.all')}`} onPress={() => setPicker('level')} /><Button secondary title={`${t('phase4.category')}: ${category || t('phase4.all')}`} onPress={() => setPicker('category')} /><Button secondary title={`${t('phase4.source')}: ${source ? t(`phase4.${source}`) : t('phase4.all')}`} onPress={() => setPicker('source')} /></View>
      <Button secondary title={t('phase4.clearFilters')} onPress={() => { setSearch(''); setLevel(''); setCategory(''); setSource('') }} />
      <Issues error={work.error || library.query.error} />{library.query.isLoading && <Loading />}{!library.query.isLoading && !visible.length && <Card><Muted>{t(sets.length ? 'phase4.noMatches' : 'phase4.emptyLibrary')}</Muted></Card>}
    </View>} renderItem={({ item: set }) => <Card style={{ marginTop: 12 }}><Title>{set.name}</Title><View style={styles.row}><Badge>{set.jlpt_level || t('phase4.mixed')}</Badge><Badge>{t(`phase4.${set.source}`)}</Badge></View><Muted>{set.category || t('phase4.mixed')}</Muted><AppText>{t('phase4.itemCount', { count: kind === 'quiz' ? set.questions.length : set.cards.length })}</AppText><Muted>{new Date(set.created_at).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'vi-VN')}</Muted>{!!set.file_name && <Muted>{set.file_name}</Muted>}
      {kind === 'flashcard' && <AppText>{t('phase4.savedStats', { ...set.stats })}</AppText>}
      <View style={styles.row}><Button title={t('phase4.play')} disabled={locked} onPress={() => router.push({ pathname: kind === 'quiz' ? '/study/quiz-play' : '/study/flashcard-play', params: { id: set.id } })} /><Button secondary title={t('phase4.edit')} disabled={locked} onPress={() => router.push({ pathname: '/study/editor', params: { kind, id: set.id } })} /><Button secondary title={t('phase4.rename')} disabled={locked} onPress={() => setNaming({ set, copy: false })} /><Button secondary title={t('phase4.duplicate')} disabled={locked} onPress={() => setNaming({ set, copy: true })} /><Button secondary title={t('phase4.delete')} disabled={locked} onPress={() => remove(set)} /></View>
    </Card>} />
    <ChoiceSheet visible={!!picker} title={t(`phase4.${picker || 'level'}`)} value={picker === 'level' ? level : picker === 'category' ? category : source} options={options} onClose={() => setPicker(undefined)} onSelect={value => { if (picker === 'level') setLevel(value); else if (picker === 'category') setCategory(value); else setSource(value); setPicker(undefined) }} />
    <NameDialog title={t(naming?.copy ? 'phase4.duplicate' : 'phase4.rename')} value={naming ? naming.copy ? t('phase4.copyName', { name: naming.set.name }).slice(0, 120) : naming.set.name : null} limit={120} onClose={() => setNaming(undefined)} onSave={name => { const request = naming!; void work.run(async () => { if (request.copy) await studyStore.duplicate(library.account!, request.set.id, name); else await studyStore.rename(library.account!, request.set.id, name); await library.refresh() }) }} />
  </>
}

import { useState } from 'react'
import { Alert, FlatList, View } from 'react-native'
import { useMutation, useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { chatAPI, type Folder } from '../api/phase2'
import { queryClient } from '../api/services'
import { useAuth } from '../auth/AuthProvider'
import { AppText, Button, Card, ErrorNotice, Title, styles } from '../components/ui'
import { NameDialog } from '../components/NameDialog'
import { useTheme } from '../theme/ThemeProvider'
import { getErrorMessage } from '../utils/getErrorMessage'
export function ChatFoldersScreen() {
  const { user } = useAuth(); const { t, i18n } = useTranslation('mobile'); const { colors } = useTheme()
  const query = useQuery(['chat-folders', user?.id], chatAPI.folders)
  const [editing, setEditing] = useState<Folder | 'new'>()
  const action = useMutation((work: () => Promise<unknown>) => work(), { onSuccess: () => { void queryClient.invalidateQueries(['chat-folders', user?.id]); void queryClient.invalidateQueries(['chat-list', user?.id]) } })
  function remove(folder: Folder) { Alert.alert(t('phase2.deleteFolder'), folder.name, [{ text: t('phase2.cancel'), style: 'cancel' }, { text: t('phase2.keepConversations'), onPress: () => action.mutate(() => chatAPI.removeFolder(folder.id, false)) }, { text: t('phase2.deleteWithConversations'), style: 'destructive', onPress: () => Alert.alert(t('phase2.delete'), t('phase2.deleteAllConfirm'), [{ text: t('phase2.cancel'), style: 'cancel' }, { text: t('phase2.delete'), style: 'destructive', onPress: () => action.mutate(() => chatAPI.removeFolder(folder.id, true)) }]) }]) }
  return <View style={{ flex: 1, backgroundColor: colors.screen }}><FlatList data={query.data || []} keyExtractor={f => f.id} contentContainerStyle={styles.screen} refreshing={query.isRefetching} onRefresh={() => void query.refetch()} ListHeaderComponent={<View style={{ gap: 14 }}><Title>{t('phase2.manageFolders')}</Title><Button title={t('phase2.newFolder')} disabled={action.isLoading} onPress={() => setEditing('new')} />{(query.isError || action.isError) && <ErrorNotice message={getErrorMessage(query.error || action.error, i18n)} retry={() => void query.refetch()} />}</View>} renderItem={({ item }) => <Card style={{ marginTop: 12 }}><AppText>{item.name} · {item.conversation_count}</AppText><Button secondary title={t('phase2.rename')} disabled={action.isLoading} onPress={() => setEditing(item)} /><Button secondary title={t('phase2.delete')} disabled={action.isLoading} onPress={() => remove(item)} /></Card>} /><NameDialog title={t(editing === 'new' ? 'phase2.newFolder' : 'phase2.rename')} value={editing === 'new' ? '' : editing?.name ?? null} limit={60} onClose={() => setEditing(undefined)} onSave={name => action.mutate(() => editing === 'new' ? chatAPI.createFolder(name) : chatAPI.renameFolder(editing!.id, name))} /></View>
}

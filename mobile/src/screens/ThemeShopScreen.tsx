import { useEffect, useMemo, useRef, useState } from 'react'
import { Image, Modal, View } from 'react-native'
import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { shopAPI } from '../api/shop'
import { queryClient, session } from '../api/services'
import { useAuth } from '../auth/AuthProvider'
import { AppText, Badge, Button, Card, ErrorNotice, Muted, Title, styles } from '../components/ui'
import { KeyboardFlatList as FlatList, KeyboardLayout, KeyboardScrollView } from '../components/KeyboardLayout'
import { SkeletonList } from '../components/SkeletonList'
import { ShopActions, ShopError, errorCode, type Quote } from '../features/shop/actions'
import { accountAppearance, mergeCatalog, mobilePalette, nativeThemes, type CatalogEntry } from '../features/shop/catalog'
import type { ShopItem, ShopItemType } from '../features/shop/types'
import { themeImages } from '../theme/assets'
import { useTheme } from '../theme/ThemeProvider'
import { imageOverlay } from '../theme/nativeStyle'
import { getErrorMessage } from '../utils/getErrorMessage'

const imagePaths = new Set(Object.keys(themeImages))
export function ThemeShopScreen() {
  const { t, i18n } = useTranslation('mobile'), { t: common } = useTranslation('common'), { user } = useAuth()
  const account = user?.id, { colors, resolvedMode, setAccountAppearance, activeBackground } = useTheme()
  // The legacy cache held themes[]; keep the complete catalog in a new key.
  const shop = useQuery(['shop-catalog', account], shopAPI.catalog, { enabled: account !== undefined })
  const rewards = useQuery(['rewards', account], shopAPI.profile, { enabled: account !== undefined })
  const [tab, setTab] = useState<ShopItemType>('theme'), [quote, setQuote] = useState<Quote | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(), [notice, setNotice] = useState('')
  const lock = useRef(false), mounted = useRef(true), currentAccount = useRef(account)
  currentAccount.current = account
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const actions = useMemo(() => new ShopActions(shopAPI, snapshot => {
    if (account === undefined || session.getSnapshot().user?.id !== account) return
    void queryClient.cancelQueries(['shop-catalog', account])
    void queryClient.cancelQueries(['rewards', account])
    queryClient.setQueryData(['shop-catalog', account], snapshot.catalog)
    queryClient.setQueryData(['rewards', account], snapshot.profile)
    const next = accountAppearance(snapshot.profile)
    setAccountAppearance(account, next.themeId, next.backgroundId)
  }), [account, setAccountAppearance])
  const all = mergeCatalog(shop.data || { themes: [], backgrounds: [] }, resolvedMode, imagePaths)
  const entries = all.filter(entry => entry.item.item_type === tab)
  const balance = rewards.data?.points_balance
  const mutationBlocked = busy || actions.hasUncertainPurchase || !shop.data || !rewards.data
  function itemName(item: ShopItem) {
    const key = `${item.item_type === 'theme' ? 'themes' : 'backgrounds'}.${item.id}.name`
    return i18n.exists(key, { ns: 'common' }) ? common(key) : t('shop.unknownName', { id: item.id })
  }
  function itemDescription(item: ShopItem) {
    const key = `${item.item_type === 'theme' ? 'themes' : 'backgrounds'}.${item.id}.description`
    return i18n.exists(key, { ns: 'common' }) ? common(key) : t('shop.unknownDescription')
  }
  async function run(work: () => Promise<void>) {
    if (lock.current || account === undefined) return
    const owner = account
    lock.current = true; setBusy(true); setError(undefined); setNotice('')
    try { await work() } catch (error) { if (mounted.current && currentAccount.current === owner) setError(error) }
    finally { lock.current = false; if (mounted.current && currentAccount.current === owner) setBusy(false) }
  }
  function message(error: unknown) {
    const code = error instanceof ShopError ? error.code : errorCode(error)
    if (code === 'insufficient_points') return common('themeShop.missingPoints', { count: error instanceof ShopError ? Number(error.values.missing || 0) : Math.max(0, (quote?.item.price || 0) - (balance || 0)) })
    return code && i18n.exists(`shop.${code}`, { ns: 'mobile' }) ? t(`shop.${code}`) : getErrorMessage(error, i18n)
  }
  function refresh() { void run(async () => { await actions.refresh() }) }
  return <>
    <KeyboardLayout style={{ backgroundColor: colors.screen }}>
    <FlatList style={{ backgroundColor: colors.screen }} contentContainerStyle={styles.screen} data={entries} keyExtractor={entry => `${entry.item.item_type}:${entry.item.id}`} refreshing={busy || shop.isRefetching || rewards.isRefetching} onRefresh={refresh}
      ListHeaderComponent={<View style={{ gap: 14 }}><Title>{common('themeShop.title')}</Title><Muted>{common('themeShop.subtitle')}</Muted><Badge>{balance === undefined ? t('phase3.unknown') : common('themeShop.points', { count: balance })}</Badge>
        <View style={styles.row}>{(['theme', 'background'] as const).map(type => <Button key={type} title={`${common(type === 'theme' ? 'themeShop.themes' : 'themeShop.backgrounds')} (${all.filter(entry => entry.item.item_type === type).length})`} secondary={tab !== type} selected={tab === type} disabled={busy} onPress={() => setTab(type)} />)}</View>
        {!!notice && <Card accessibilityLiveRegion="polite"><AppText>{t(notice)}</AppText></Card>}
        {actions.hasUncertainPurchase && <ErrorNotice message={t('shop.uncertain')} retry={refresh} />}
        {!!(error || shop.error || rewards.error) && <ErrorNotice message={message(error || shop.error || rewards.error)} retry={refresh} />}
        {tab === 'background' && <Button secondary title={t('shop.defaultBackground')} disabled={mutationBlocked || activeBackground === null} onPress={() => void run(async () => { await actions.equip('background', null); setNotice('shop.applied') })} />}
      </View>}
      ListEmptyComponent={shop.isLoading || rewards.isLoading ? <SkeletonList /> : <Card><Muted>{t('shop.empty')}</Muted></Card>}
      renderItem={({ item: entry }) => {
        const item = entry.item, missing = balance === undefined ? 0 : Math.max(0, item.price - balance)
        return <Card style={{ marginTop: 14 }}><Title>{itemName(item)}</Title><Muted>{itemDescription(item)}</Muted><ShopPreview key={`${item.item_type}:${item.id}`} entry={entry} />
          <AppText>{item.price === 0 ? common('themeShop.free') : common('themeShop.points', { count: item.price })}</AppText><Badge>{common(item.equipped ? 'themeShop.equipped' : item.owned ? 'themeShop.owned' : 'themeShop.price', { count: item.price })}</Badge>
          {!entry.supported && <Muted>{t('shop.unsupported')}</Muted>}{entry.mascotMissing && <Muted>{t('shop.mascotMissing')}</Muted>}
          {!item.owned && missing > 0 && <AppText>{common('themeShop.missingPoints', { count: missing })}</AppText>}
          {item.owned ? <Button title={common(item.equipped ? 'themeShop.equipped' : 'themeShop.use')} disabled={mutationBlocked || item.equipped || !entry.supported} onPress={() => void run(async () => { await actions.equip(item.item_type, item.id); setNotice('shop.applied') })} /> : <Button title={common(busy ? 'themeShop.buying' : 'themeShop.price', { count: item.price })} disabled={mutationBlocked || !!quote || !entry.supported || missing > 0} onPress={() => void run(async () => { const next = await actions.quote(item.item_type, item.id); if (mounted.current && currentAccount.current === account) setQuote(next) })} />}
        </Card>
      }} />
    </KeyboardLayout>
    <Modal transparent visible={!!quote} animationType="fade" onRequestClose={() => { if (!busy) setQuote(null) }}><KeyboardLayout safeTop style={{ backgroundColor: colors.scrim }}><KeyboardScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}><Card>
      <Title>{t('shop.confirmTitle')}</Title>{quote && <><AppText>{itemName(quote.item)}</AppText><AppText>{t('shop.confirmPrice', { price: quote.item.price })}</AppText><AppText>{t('shop.confirmBalance', { before: quote.before, after: quote.after })}</AppText><Muted>{t('shop.confirmApply')}</Muted></>}
      <Button title={common(busy ? 'themeShop.buying' : 'themeShop.price', { count: quote?.item.price || 0 })} disabled={busy || !quote} onPress={() => { const accepted = quote!; void run(async () => { try { await actions.buy(accepted); setNotice('shop.purchased') } finally { if (mounted.current) setQuote(null) } }) }} /><Button secondary title={t('phase2.cancel')} disabled={busy} onPress={() => setQuote(null)} />
    </Card></KeyboardScrollView></KeyboardLayout></Modal>
  </>
}

function ShopPreview({ entry }: { entry: CatalogEntry }) {
  const { t } = useTranslation('common'), { t: mobile } = useTranslation('mobile'), { resolvedMode, activeTheme } = useTheme()
  const [mode, setMode] = useState<'light' | 'dark'>(resolvedMode)
  const palette = mobilePalette(entry.item.item_type === 'theme' ? entry.item.id : activeTheme, mode)
  const path = entry.item.item_type === 'theme' ? entry.supported ? nativeThemes[entry.item.id].background[mode] : null : entry.imagePath
  const image = path ? themeImages[path] : undefined
  return <View style={{ gap: 10 }}><View style={styles.row}>{(['light', 'dark'] as const).map(value => <Button key={value} secondary={mode !== value} selected={mode === value} title={t(`themeShop.${value}`)} onPress={() => setMode(value)} />)}</View><View style={{ borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: palette.border, backgroundColor: palette.bg }}>
    {image && <><Image source={image} resizeMode="cover" style={{ position: 'absolute', width: '100%', height: '100%' }} /><View style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: imageOverlay(palette, mode) }} /></>}
    <View style={{ padding: 16, gap: 10 }}><AppText style={{ color: palette.text, fontWeight: '700' }}>{t('themeShop.preview')}</AppText><AppText style={{ color: palette.textMuted }}>{mobile('shop.previewText')}</AppText><View style={{ backgroundColor: palette.card, borderColor: palette.border, borderWidth: 1, borderRadius: 12, padding: 12 }}><AppText style={{ color: palette.text }}>{t('themeShop.brandTagline')}</AppText></View><View style={{ backgroundColor: palette.primary, padding: 12, borderRadius: 12 }}><AppText style={{ color: palette.primaryContrast }}>{t('themeShop.dailyTask')}</AppText></View></View>
  </View></View>
}

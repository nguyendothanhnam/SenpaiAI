import { useLayoutEffect } from 'react'
import { useQuery } from 'react-query'
import { shopAPI } from '../api/shop'
import { accountAppearance } from '../features/shop/catalog'
import { useAuth } from '../auth/AuthProvider'
import { useTheme } from '../theme/ThemeProvider'
export function AccountThemeBridge() {
  const { user } = useAuth(); const { setAccountAppearance } = useTheme()
  const rewards = useQuery(['rewards', user?.id], shopAPI.profile, { enabled: !!user })
  useLayoutEffect(() => {
    const appearance = accountAppearance(user ? rewards.data : undefined)
    setAccountAppearance(user?.id ?? null, appearance.themeId, appearance.backgroundId)
  }, [user, rewards.data, setAccountAppearance])
  return null
}

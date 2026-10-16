import { useQuery } from 'react-query'
import { rewardsAPI, RewardsMe, ShopItem } from './api'

export const rewardsMeKey = (userId?: number) => ['rewards', 'me', userId]
export const rewardsShopKey = (userId?: number) => ['rewards', 'shop', userId]

function cacheKey(kind: string, userId: number) {
  return `senpai-ai-${kind}-v1:${userId}`
}

function readCache<T>(kind: string, userId?: number): T | undefined {
  if (!userId) return undefined
  try {
    const value = localStorage.getItem(cacheKey(kind, userId))
    return value ? JSON.parse(value) as T : undefined
  } catch {
    return undefined
  }
}

function writeCache(kind: string, userId: number | undefined, value: unknown) {
  if (!userId) return
  try {
    localStorage.setItem(cacheKey(kind, userId), JSON.stringify(value))
  } catch {
    // The server query remains authoritative when browser storage is unavailable.
  }
}

export function useRewardsMe(userId?: number) {
  return useQuery<RewardsMe>(rewardsMeKey(userId), async () => {
    const { data } = await rewardsAPI.getMe()
    writeCache('rewards-me', userId, data)
    return data
  }, {
    enabled: Boolean(userId),
    initialData: () => readCache<RewardsMe>('rewards-me', userId),
    staleTime: 0,
    refetchOnMount: 'always',
  })
}

export function useRewardsShop(userId?: number) {
  return useQuery<{ themes: ShopItem[]; backgrounds: ShopItem[] }>(rewardsShopKey(userId), async () => {
    const { data } = await rewardsAPI.getShop()
    writeCache('rewards-shop', userId, data)
    return data
  }, {
    enabled: Boolean(userId),
    initialData: () => readCache('rewards-shop', userId),
    staleTime: 0,
    refetchOnMount: 'always',
  })
}

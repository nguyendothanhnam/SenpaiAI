import { api } from './services'
import type { EquipPayload, Equipped, PurchaseResult, ShopCatalog, ShopItemType, ShopProfile, ShopSnapshot } from '../features/shop/types'

export const shopAPI = {
  catalog: () => api.get<ShopCatalog>('/rewards/shop').then(response => response.data),
  profile: () => api.get<ShopProfile>('/rewards/me').then(response => response.data),
  purchase: (item_type: ShopItemType, item_id: string) => api.post<PurchaseResult>('/rewards/shop/purchase', { item_type, item_id, equip: true }).then(response => response.data),
  equip: (payload: EquipPayload) => api.put<Equipped>('/rewards/equip', payload).then(response => response.data),
  async snapshot(): Promise<ShopSnapshot> {
    const [catalog, profile] = await Promise.all([shopAPI.catalog(), shopAPI.profile()])
    return { catalog, profile }
  },
}

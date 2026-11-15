import type { Rewards } from '../../api/types'
export type ShopItemType = 'theme' | 'background'
export interface ShopItem {
  id: string; name: string; price: number; item_type: ShopItemType
  image?: string; owned: boolean; equipped: boolean
}
export interface ShopCatalog { themes: ShopItem[]; backgrounds: ShopItem[] }
export interface ShopProfile extends Rewards {
  active_theme_id: string; active_background_id: string | null
  unlocked: { themes: string[]; backgrounds: string[] }
}
export interface ShopSnapshot { catalog: ShopCatalog; profile: ShopProfile }
export interface PurchaseResult {
  points_balance: number
  purchased: { item_type: ShopItemType; item_id: string; price_paid: number; equipped: boolean }
}
export interface Equipped { active_theme_id: string; active_background_id: string | null }
export interface EquipPayload { theme_id?: string; background_id?: string | null }

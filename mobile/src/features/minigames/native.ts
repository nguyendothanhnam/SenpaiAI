import { RecipeStore } from './recipes'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { kanjiAPI } from '../../api/phase3'
import { PoolCache } from './pool'
import { GameStore } from './storage'
export const gamePools = new PoolCache(kanjiAPI.list)
export const gameStore = new GameStore(AsyncStorage)

export const recipeStore = new RecipeStore(AsyncStorage)

/**
 * EventBridge: Decoupled pub/sub event bus between React HUD and Three.js 3D world.
 * The 3D scene only listens to events and does not contain scoring/interview logic.
 */

export type SceneEventType =
  | 'npc_speaking_start'
  | 'npc_speaking_end'
  | 'user_answer_submitted'
  | 'score_received'
  | 'interview_finished'
  | 'quality_changed'
  | 'camera_view_changed'
  | 'stance_changed'
  | 'distance_changed'
  | 'door_open'
  | 'door_close'
  | 'etiquette_step_changed'
  | 'candidate_bow'
  | 'candidate_knock'
  | 'skip_to_interview'

export interface ScorePayload {
  grammar?: number
  keigo?: number
  manner?: number
  emotion?: 'neutral' | 'happy' | 'thinking' | 'surprised' | 'strict'
}

export type EventHandler<T = any> = (payload: T) => void

export class EventBridge {
  private static instance: EventBridge
  private listeners: Map<SceneEventType, Set<EventHandler>> = new Map()

  private constructor() {}

  public static getInstance(): EventBridge {
    if (!EventBridge.instance) {
      EventBridge.instance = new EventBridge()
    }
    return EventBridge.instance
  }

  public on<T = any>(event: SceneEventType, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    const handlers = this.listeners.get(event)!
    handlers.add(handler)

    // Return unbind function
    return () => {
      handlers.delete(handler)
    }
  }

  public emit<T = any>(event: SceneEventType, payload?: T): void {
    const handlers = this.listeners.get(event)
    if (!handlers || handlers.size === 0) return
    handlers.forEach((handler) => {
      try {
        handler(payload)
      } catch (err) {
        console.error(`[EventBridge] Error in handler for event '${event}':`, err)
      }
    })
  }

  public clear(): void {
    this.listeners.clear()
  }
}

export const eventBridge = EventBridge.getInstance()

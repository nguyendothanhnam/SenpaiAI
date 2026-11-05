import { useEffect, useState, type PropsWithChildren } from 'react'
import { ErrorScreen } from './ErrorBoundary'

type ErrorHandler = (error: Error, isFatal?: boolean) => void
type ErrorUtilities = { getGlobalHandler(): ErrorHandler; setGlobalHandler(handler: ErrorHandler): void }

export function RuntimeGuard({ children }: PropsWithChildren) {
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const utils = (globalThis as typeof globalThis & { ErrorUtils?: ErrorUtilities }).ErrorUtils
    const previous = utils?.getGlobalHandler()
    if (utils) utils.setGlobalHandler((_error, isFatal) => {
      console.error('SenpaiAI: an unhandled JavaScript error occurred.')
      if (isFatal) setFailed(true)
      else previous?.(_error, isFatal)
    })
    // Hosts exposing the standard rejection event can recover from async errors too.
    const onRejection = (event: Event) => { event.preventDefault(); setFailed(true) }
    globalThis.addEventListener?.('unhandledrejection', onRejection)
    return () => {
      if (utils && previous) utils.setGlobalHandler(previous)
      globalThis.removeEventListener?.('unhandledrejection', onRejection)
    }
  }, [])
  return failed ? <ErrorScreen retry={() => setFailed(false)} /> : children
}

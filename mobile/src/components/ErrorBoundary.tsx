import { Component, type PropsWithChildren } from 'react'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, Muted, Screen, Title } from './ui'

export function ErrorScreen({ retry }: { retry: () => void }) {
  const { t } = useTranslation('mobile')
  return <SafeAreaView style={{ flex: 1 }}><Screen><Title>{t('fatalTitle')}</Title><Muted>{t('fatalHint')}</Muted><Button title={t('retry')} onPress={retry} /></Screen></SafeAreaView>
}

export class AppErrorBoundary extends Component<PropsWithChildren, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() {
    // Never log credentials, request bodies, or unfiltered Axios errors.
    console.error('SenpaiAI: an unhandled rendering error occurred.')
  }
  render() {
    return this.state.failed ? <ErrorScreen retry={() => this.setState({ failed: false })} /> : this.props.children
  }
}

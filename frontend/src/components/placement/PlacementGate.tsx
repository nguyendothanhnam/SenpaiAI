import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import Layout from '../Layout'
import LoadingSpinner from '../LoadingSpinner'
import Placement from '../../pages/Placement'
import { useAuth } from '../../services/auth'
import { placementAPI } from '../../services/placement'
import { getErrorMessage } from '../../utils/getErrorMessage'

export default function PlacementGate({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const { t } = useTranslation('placement')
  const { data, isLoading, error, refetch } = useQuery(['placement', 'status', user?.id], () => placementAPI.status().then(res => res.data), {
    enabled: Boolean(user), retry: 1,
  })
  if (isLoading) return <div role="status" aria-label={t('loading')} className="grid min-h-screen place-items-center bg-[color:var(--bg)]"><LoadingSpinner className="motion-reduce:[&_*]:animate-none" /></div>
  if (error || !data) return <section className="mx-auto max-w-xl space-y-4 p-6 text-[color:var(--text)]">
    <h1 className="text-2xl font-bold">{t('title')}</h1><p role="alert">{error ? getErrorMessage(error) : t('statusUnavailable')}</p>
    <button type="button" className="mr-4 rounded-xl border border-[color:var(--border)] p-3" onClick={() => refetch()}>{t('retry')}</button>
    <button type="button" className="rounded-xl border border-[color:var(--border)] p-3" onClick={logout}>{t('signOut')}</button>
  </section>
  if (!data.has_confirmed) return <Layout placementRequired>
    {pathname === '/placement' ? <Placement requiredSetup /> : <Navigate to="/placement" replace />}
  </Layout>
  return <>{children}</>
}

import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { QueryClient, QueryClientProvider, useQuery } from 'react-query'

test('React Query 3 hooks render and update under the pinned React version', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, cacheTime: 0 } } })
  function Probe() {
    const query = useQuery('compatibility', async () => 'ready')
    return React.createElement('span', null, query.data ?? 'loading')
  }
  let renderer: ReactTestRenderer | undefined
  try {
    await act(async () => {
      renderer = create(React.createElement(QueryClientProvider, { client }, React.createElement(Probe)))
    })
    await act(async () => { await client.refetchQueries('compatibility'); await new Promise((resolve) => setTimeout(resolve, 30)) })
    assert.equal(renderer?.root.findByType('span').children[0], 'ready')
  } finally {
    await act(async () => { renderer?.unmount() })
    client.clear()
  }
})

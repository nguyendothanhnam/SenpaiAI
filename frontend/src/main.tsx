import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { Toaster } from 'react-hot-toast'
import App from './App.tsx'
import { AuthProvider } from './services/auth'
import { ThemeProvider } from './themes/ThemeProvider'
import './index.css'
import './i18n'
import { LanguageProvider } from './i18n/LanguageProvider'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
<React.StrictMode>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <LanguageProvider>
      <ThemeProvider>
      <BrowserRouter>
        <App />
        <Toaster />
      </BrowserRouter>
      </ThemeProvider>
      </LanguageProvider>
    </AuthProvider>
  </QueryClientProvider>
</React.StrictMode>,
)


import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../services/auth'
import { isValidEmail, isValidPassword, isValidUsername } from '../utils/helpers'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { getErrorMessage } from '../utils/getErrorMessage'

interface LoginFormData {
  email: string
  password: string
}

interface RegisterFormData {
  email: string
  username: string
  password: string
  confirmPassword: string
}

export default function Login() {
  const { t } = useTranslation('auth')
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { login, register } = useAuth()

  const loginForm = useForm<LoginFormData>()
  const registerForm = useForm<RegisterFormData>()

  const inputClassName =
    'w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card-glass)] px-4 py-3 text-sm text-[color:var(--text)] outline-none transition focus:border-[color:var(--border)] focus:ring-2 focus:ring-[color:var(--primary)]'

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true)
    try {
      await login(data.email, data.password)
      toast.success(t('welcome'))
    } catch (error: any) {
      toast.error(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (data: RegisterFormData) => {
    if (data.password !== data.confirmPassword) {
      toast.error(t('passwordMismatch'))
      return
    }

    setIsLoading(true)
    try {
      await register(data.email, data.username, data.password)
      toast.success(t('accountCreated'))
    } catch (error: any) {
      toast.error(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[image:var(--bg-image)] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
        <div className="w-full space-y-6 rounded-3xl border border-[color:var(--border)]/70 bg-[color:var(--card-glass)] p-8 shadow-2xl backdrop-blur-md">
          <div className="flex justify-end"><LanguageSwitcher compact /></div>
          <div className="space-y-2 text-center">
            <h1 className="bg-[image:var(--primary-gradient)] bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
              SenpaiAI
            </h1>
            <p className="text-sm text-[color:var(--text-muted)]">{t('tagline')}</p>
          </div>

          <div className="rounded-full bg-[color:var(--bg-elevated)] p-1">
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setIsLogin(true)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isLogin
                    ? 'bg-[color:var(--primary)] text-[color:var(--primary-contrast)] shadow-sm'
                    : 'text-[color:var(--text-muted)] hover:bg-[color:var(--card-glass)] hover:text-[color:var(--text)]'
                }`}
              >
                {t('signInTab')}
              </button>
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  !isLogin
                    ? 'bg-[color:var(--primary)] text-[color:var(--primary-contrast)] shadow-sm'
                    : 'text-[color:var(--text-muted)] hover:bg-[color:var(--card-glass)] hover:text-[color:var(--text)]'
                }`}
              >
                {t('signUpTab')}
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {isLogin ? (
              <motion.form
                key="login-form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                onSubmit={loginForm.handleSubmit(handleLogin)}
                className="space-y-5"
              >
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-[color:var(--text)]">
                    {t('email')}
                  </label>
                  <input
                    {...loginForm.register('email', {
                      required: 'validation.emailRequired',
                      validate: (value) => isValidEmail(value) || 'validation.emailInvalid'
                    })}
                    type="email"
                    className={inputClassName}
                    placeholder={t('emailPlaceholder')}
                  />
                  {loginForm.formState.errors.email && (
                    <p className="mt-1 text-sm text-red-600">
                      {t(loginForm.formState.errors.email.message || '')}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-medium text-[color:var(--text)]">
                    {t('password')}
                  </label>
                  <div className="relative">
                    <input
                      {...loginForm.register('password', {
                        required: 'validation.passwordRequired'
                      })}
                      type={showPassword ? 'text' : 'password'}
                      className={`${inputClassName} pr-11`}
                      placeholder={t('passwordPlaceholder')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-[color:var(--text-muted)] transition hover:text-[color:var(--primary)]"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {loginForm.formState.errors.password && (
                    <p className="mt-1 text-sm text-red-600">
                      {t(loginForm.formState.errors.password.message || '')}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center rounded-xl bg-[image:var(--primary-gradient)] px-4 py-3 text-sm font-bold text-[color:var(--primary-contrast)] shadow-md transition hover:opacity-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('signingIn')}
                    </>
                  ) : (
                    t('signIn')
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="register-form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                onSubmit={registerForm.handleSubmit(handleRegister)}
                className="space-y-5"
              >
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-[color:var(--text)]">
                    {t('email')}
                  </label>
                  <input
                    {...registerForm.register('email', {
                      required: 'validation.emailRequired',
                      validate: (value) => isValidEmail(value) || 'validation.emailInvalid'
                    })}
                    type="email"
                    className={inputClassName}
                    placeholder={t('emailPlaceholder')}
                  />
                  {registerForm.formState.errors.email && (
                    <p className="mt-1 text-sm text-red-600">
                      {t(registerForm.formState.errors.email.message || '')}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="username" className="mb-2 block text-sm font-medium text-[color:var(--text)]">
                    {t('username')}
                  </label>
                  <input
                    {...registerForm.register('username', {
                      required: 'validation.usernameRequired',
                      validate: (value) => isValidUsername(value) || 'validation.usernameInvalid'
                    })}
                    type="text"
                    className={inputClassName}
                    placeholder={t('usernamePlaceholder')}
                  />
                  {registerForm.formState.errors.username && (
                    <p className="mt-1 text-sm text-red-600">
                      {t(registerForm.formState.errors.username.message || '')}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-medium text-[color:var(--text)]">
                    {t('password')}
                  </label>
                  <div className="relative">
                    <input
                      {...registerForm.register('password', {
                        required: 'validation.passwordRequired',
                        validate: (value) => isValidPassword(value) || 'validation.passwordMin'
                      })}
                      type={showPassword ? 'text' : 'password'}
                      className={`${inputClassName} pr-11`}
                      placeholder={t('newPasswordPlaceholder')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-[color:var(--text-muted)] transition hover:text-[color:var(--primary)]"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {registerForm.formState.errors.password && (
                    <p className="mt-1 text-sm text-red-600">
                      {t(registerForm.formState.errors.password.message || '')}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-[color:var(--text)]">
                    {t('confirmPassword')}
                  </label>
                  <div className="relative">
                    <input
                      {...registerForm.register('confirmPassword', {
                        required: 'validation.confirmRequired'
                      })}
                      type={showConfirmPassword ? 'text' : 'password'}
                      className={`${inputClassName} pr-11`}
                      placeholder={t('confirmPlaceholder')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? t('hidePassword') : t('showPassword')}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-[color:var(--text-muted)] transition hover:text-[color:var(--primary)]"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {registerForm.formState.errors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">
                      {t(registerForm.formState.errors.confirmPassword.message || '')}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center rounded-xl bg-[image:var(--primary-gradient)] px-4 py-3 text-sm font-bold text-[color:var(--primary-contrast)] shadow-md transition hover:opacity-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('creatingAccount')}
                    </>
                  ) : (
                    t('signUp')
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}


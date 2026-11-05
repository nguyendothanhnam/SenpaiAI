import { useState } from 'react'
import { Controller, useForm, type RegisterOptions } from 'react-hook-form'
import { TextInput, View } from 'react-native'
import { Link } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { useTheme } from '../theme/ThemeProvider'
import { getErrorMessage } from '../utils/getErrorMessage'
import { isValidEmail, isValidPassword, isValidUsername } from '../utils/validation'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { ConnectivityPanel } from '../components/ConnectivityPanel'
import { AppText, Button, Card, ErrorNotice, Screen, Title, styles } from '../components/ui'
import { apiConfiguration } from '../config/env'

interface Values { email: string; username: string; password: string; confirmPassword: string }
export function AuthScreen({ registering = false }: { registering?: boolean }) {
  const { t, i18n } = useTranslation('auth')
  const { t: mobile } = useTranslation('mobile')
  const { login, register, expired } = useAuth()
  const { colors } = useTheme()
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [created, setCreated] = useState(false)
  const { control, handleSubmit, getValues, formState: { isSubmitting } } = useForm<Values>({ defaultValues: { email: '', username: '', password: '', confirmPassword: '' } })

  const fields: { name: keyof Values; label: string; rules: RegisterOptions<Values, keyof Values> }[] = [
    { name: 'email', label: 'email', rules: { required: 'validation.emailRequired', validate: (value) => isValidEmail(value) || 'validation.emailInvalid' } },
    ...(registering ? [{ name: 'username' as const, label: 'username', rules: { required: 'validation.usernameRequired', validate: (value: string) => isValidUsername(value) || 'validation.usernameInvalid' } }] : []),
    { name: 'password', label: 'password', rules: { required: 'validation.passwordRequired', validate: (value) => !registering || isValidPassword(value) || 'validation.passwordMin' } },
    ...(registering ? [{ name: 'confirmPassword' as const, label: 'confirmPassword', rules: { required: 'validation.confirmRequired', validate: (value: string) => value === getValues('password') || 'passwordMismatch' } }] : []),
  ]
  const submit = handleSubmit(async (values) => {
    setError(null)
    try {
      if (registering) {
        // Separate the two requests so a failed automatic login never repeats registration.
        if (!created) await register(values.email, values.username, values.password, () => setCreated(true))
        else await login(values.email, values.password)
      } else await login(values.email, values.password)
    } catch (failure) { setError(getErrorMessage(failure, i18n)) }
  })

  return <Screen>
    <Title>SenpaiAI</Title>
    <LanguageSwitcher />
    <Card>
      <Title>{t(registering ? 'signUpTab' : 'signInTab')}</Title>
      {expired && <AppText accessibilityRole="alert">{i18n.t('unauthorized', { ns: 'errors' })}</AppText>}
      {fields.map(({ name, label, rules }) => <Controller key={name} control={control} name={name} rules={rules} render={({ field: { onChange, onBlur, value, ref }, fieldState }) => <View style={{ gap: 6 }}>
        <AppText nativeID={`${name}-label`}>{t(label)}</AppText>
        <TextInput
          ref={ref}
          accessibilityLabel={t(label)}
          accessibilityLabelledBy={`${name}-label`}
          value={value} onChangeText={onChange} onBlur={onBlur}
          autoCapitalize="none" autoCorrect={false}
          keyboardType={name === 'email' ? 'email-address' : 'default'}
          autoComplete={name === 'email' ? 'email' : name === 'username' ? 'username' : registering ? 'new-password' : 'current-password'}
          secureTextEntry={(name === 'password' || name === 'confirmPassword') && !showPassword}
          editable={!isSubmitting && !created}
          style={[styles.field, { color: colors.text, backgroundColor: colors.bgElevated, borderColor: colors.border }]}
        />
        {fieldState.error?.message && <AppText accessibilityRole="alert">{t(fieldState.error.message)}</AppText>}
      </View>} />)}
      <Button secondary title={t(showPassword ? 'hidePassword' : 'showPassword')} onPress={() => setShowPassword((value) => !value)} />
      {error && <ErrorNotice message={error} />}
      {created && <AppText>{mobile('accountCreatedLoginNeeded')}</AppText>}
      <Button title={t(isSubmitting ? registering ? 'creatingAccount' : 'signingIn' : registering && !created ? 'signUp' : 'signIn')} disabled={isSubmitting || !apiConfiguration.valid} onPress={() => void submit()} />
      <Link href={registering ? '/(auth)/login' : '/(auth)/register'} asChild>
        <AppText accessibilityRole="link" style={{ color: colors.primary, paddingVertical: 12, textAlign: 'center' }}>{t(registering ? 'signInTab' : 'signUpTab')}</AppText>
      </Link>
    </Card>
    <ConnectivityPanel />
  </Screen>
}

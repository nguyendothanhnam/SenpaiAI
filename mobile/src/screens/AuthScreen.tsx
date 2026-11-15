import { KeyboardInput as TextInput, KeyboardScrollView as ScrollView, KeyboardLayout } from '../components/KeyboardLayout'
import { useRef, useState, type ComponentRef } from 'react'
import { Controller, useForm, type RegisterOptions } from 'react-hook-form'
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { useTheme } from '../theme/ThemeProvider'
import { getErrorMessage } from '../utils/getErrorMessage'
import { isValidEmail, isValidPassword, isValidUsername } from '../utils/validation'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { ConnectivityPanel } from '../components/ConnectivityPanel'
import { AppText, ErrorNotice, styles } from '../components/ui'
import { apiConfiguration } from '../config/env'
import { gradientColors, nativeColor } from '../theme/nativeStyle'

interface Values { email: string; username: string; password: string; confirmPassword: string }
export function AuthScreen({ registering = false }: { registering?: boolean }) {
  const { t, i18n } = useTranslation('auth')
  const { t: mobile } = useTranslation('mobile')
  const { login, register, expired } = useAuth()
  const { colors } = useTheme()
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [focused, setFocused] = useState<keyof Values | null>(null)
  const inputs = useRef<Partial<Record<keyof Values, ComponentRef<typeof TextInput> | null>>>({})
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

  return <LinearGradient colors={gradientColors(colors.bgImage, colors.bg)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardLayout style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={authStyles.page}>
    <View style={[authStyles.card, { borderColor: colors.border, backgroundColor: nativeColor(colors.cardGlass), shadowColor: colors.text }]}>
      <LanguageSwitcher compact />
      <View style={{ alignItems: 'center', gap: 8 }}>
        <AppText accessibilityRole="header" style={{ fontSize: 40, lineHeight: 48, letterSpacing: -1.4, fontWeight: '800', color: colors.primary }}>SenpaiAI</AppText>
        <AppText style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center' }}>{t('tagline')}</AppText>
      </View>
      <View accessibilityRole="tablist" style={[authStyles.tabs, { backgroundColor: colors.bgElevated }]}>
        {([false, true] as const).map(value => <Pressable key={String(value)} accessibilityRole="tab" accessibilityState={{ selected: registering === value, disabled: isSubmitting }} disabled={isSubmitting} onPress={() => { if (registering !== value) router.replace(value ? '/(auth)/register' : '/(auth)/login') }} style={[authStyles.tab, { backgroundColor: registering === value ? colors.primary : 'transparent' }]}>
          <AppText style={{ fontSize: 14, lineHeight: 20, fontWeight: '600', color: registering === value ? colors.primaryContrast : colors.textMuted }}>{t(value ? 'signUpTab' : 'signInTab')}</AppText>
        </Pressable>)}
      </View>
      {expired && <AppText accessibilityRole="alert">{i18n.t('unauthorized', { ns: 'errors' })}</AppText>}
      {fields.map(({ name, label, rules }, index) => <Controller key={name} control={control} name={name} rules={rules} render={({ field: { onChange, onBlur, value, ref }, fieldState }) => <View style={{ gap: 8 }}>
        <AppText nativeID={`${name}-label`} style={{ fontSize: 14, lineHeight: 20, fontWeight: '500' }}>{t(label)}</AppText>
        <View style={{ justifyContent: 'center' }}>
        <TextInput
          ref={element => { ref(element); inputs.current[name] = element }}
          accessibilityLabel={t(label)}
          accessibilityLabelledBy={`${name}-label`}
          value={value} onChangeText={onChange} onBlur={() => { onBlur(); setFocused(null) }} onFocus={() => setFocused(name)}
          placeholder={t(name === 'confirmPassword' ? 'confirmPlaceholder' : name === 'password' && registering ? 'newPasswordPlaceholder' : `${name}Placeholder`)}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none" autoCorrect={false}
          keyboardType={name === 'email' ? 'email-address' : 'default'}
          autoComplete={name === 'email' ? 'email' : name === 'username' ? 'username' : registering ? 'new-password' : 'current-password'}
          secureTextEntry={name === 'password' ? !showPassword : name === 'confirmPassword' ? !showConfirmPassword : false}
          returnKeyType={index === fields.length - 1 ? 'done' : 'next'}
          submitBehavior="submit"
          onSubmitEditing={() => { if (index < fields.length - 1) inputs.current[fields[index + 1].name]?.focus(); else if (!isSubmitting) void submit() }}
          editable={!isSubmitting && !created}
          style={[styles.field, { color: colors.text, backgroundColor: nativeColor(colors.cardGlass), borderColor: focused === name ? colors.primary : colors.border, fontSize: 14, paddingRight: name === 'password' || name === 'confirmPassword' ? 52 : 16 }]}
        />
        {(name === 'password' || name === 'confirmPassword') && <Pressable accessibilityRole="button" accessibilityLabel={t((name === 'password' ? showPassword : showConfirmPassword) ? 'hidePassword' : 'showPassword')} onPress={() => name === 'password' ? setShowPassword(v => !v) : setShowConfirmPassword(v => !v)} style={{ position: 'absolute', right: 0, minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={(name === 'password' ? showPassword : showConfirmPassword) ? 'eye-off-outline' : 'eye-outline'} size={19} color={colors.textMuted} /></Pressable>}
        </View>
        {fieldState.error?.message && <AppText accessibilityRole="alert">{t(fieldState.error.message)}</AppText>}
      </View>} />)}
      {error && <ErrorNotice message={error} />}
      {created && <AppText>{mobile('accountCreatedLoginNeeded')}</AppText>}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: isSubmitting || !apiConfiguration.valid, busy: isSubmitting }} disabled={isSubmitting || !apiConfiguration.valid} onPress={() => void submit()} style={({ pressed }) => ({ borderRadius: 12, overflow: 'hidden', opacity: isSubmitting || !apiConfiguration.valid ? 0.6 : pressed ? 0.85 : 1 })}>
        <LinearGradient colors={gradientColors(colors.primaryGradient, colors.primary)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flexDirection: 'row', minHeight: 48, justifyContent: 'center', alignItems: 'center', gap: 8, padding: 12 }}>
          {isSubmitting && <ActivityIndicator color={colors.primaryContrast} />}
          <AppText style={{ fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.primaryContrast }}>{t(isSubmitting ? registering ? 'creatingAccount' : 'signingIn' : registering && !created ? 'signUp' : 'signIn')}</AppText>
        </LinearGradient>
      </Pressable>
    <ConnectivityPanel />
    </View>
        </ScrollView>
      </KeyboardLayout>
    </SafeAreaView>
  </LinearGradient>
}

const authStyles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 32 },
  card: { width: '100%', maxWidth: 448, alignSelf: 'center', borderWidth: 1, borderRadius: 24, padding: 24, gap: 22, shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 4 },
  tabs: { flexDirection: 'row', borderRadius: 99, padding: 4, gap: 4 },
  tab: { flex: 1, minHeight: 44, borderRadius: 99, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12 },
})

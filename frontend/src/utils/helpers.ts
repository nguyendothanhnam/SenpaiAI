import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import i18n from '../i18n'

const intlLocale = () => i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat(intlLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(intlLocale(), options).format(value)
}

export function formatTime(date: string | Date) {
  return new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit' }).format(new Date(date))
}

export function formatRelativeTime(date: string | Date) {
  const now = new Date()
  const targetDate = new Date(date)
  const diffInSeconds = Math.floor((now.getTime() - targetDate.getTime()) / 1000)

  const units: Intl.RelativeTimeFormatUnit[] = ['second', 'minute', 'hour', 'day']
  const seconds = [60, 60, 24]
  let amount = -diffInSeconds
  let unit: Intl.RelativeTimeFormatUnit = units[0]
  for (let index = 0; index < seconds.length && Math.abs(amount) >= seconds[index]; index += 1) {
    amount /= seconds[index]
    unit = units[index + 1]
  }
  return new Intl.RelativeTimeFormat(intlLocale(), { numeric: 'auto' }).format(Math.round(amount), unit)
}

export function getJLPTColor(level: string) {
  const colors = {
    N5: 'jlpt-n5',
    N4: 'jlpt-n4',
    N3: 'jlpt-n3',
    N2: 'jlpt-n2',
    N1: 'jlpt-n1',
  }
  return colors[level as keyof typeof colors] || 'jlpt-n3'
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

export function isValidEmail(email: string) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function isValidPassword(password: string) {
  return password.length >= 6
}

export function isValidUsername(username: string) {
  return username.length >= 3 && username.length <= 20 && /^[a-zA-Z0-9_]+$/.test(username)
}


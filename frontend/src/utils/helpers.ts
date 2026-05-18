import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatRelativeTime(date: string | Date) {
  const now = new Date()
  const targetDate = new Date(date)
  const diffInSeconds = Math.floor((now.getTime() - targetDate.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return 'Just now'
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  } else {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days} day${days > 1 ? 's' : ''} ago`
  }
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

export function getJLPTDescription(level: string) {
  const descriptions = {
    N5: 'Basic level - Can understand basic Japanese',
    N4: 'Elementary level - Can understand basic Japanese',
    N3: 'Intermediate level - Can understand Japanese used in everyday situations',
    N2: 'Pre-advanced level - Can understand Japanese used in everyday situations and various circumstances',
    N1: 'Advanced level - Can understand Japanese used in a variety of circumstances',
  }
  return descriptions[level as keyof typeof descriptions] || 'Unknown level'
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


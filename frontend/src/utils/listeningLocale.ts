import type { TFunction } from 'i18next'

interface ListeningLessonMetadata {
  title: string
  topic: string
  description?: string | null
  jlpt_level: string
  source?: string
}

export function localizeListeningLesson<T extends ListeningLessonMetadata>(lesson: T, t: TFunction) {
  const title = t(`listening.lessonTitles.${lesson.title}`, { defaultValue: lesson.title })
  const topic = t(`listening.topics.${lesson.topic}`, { defaultValue: lesson.topic })
  const description = lesson.source === 'seed'
    ? t('listening.seedDescription', { level: lesson.jlpt_level, title, defaultValue: lesson.description || '' })
    : lesson.description || ''

  return { ...lesson, title, topic, description }
}

export function localizeListeningSegment(translation: string, language: string, t: TFunction) {
  if (!language.toLowerCase().startsWith('en')) return translation
  const key = translation.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return t(`listening.segmentTranslations.${key}`, { defaultValue: t('listening.englishTranslationUnavailable') })
}

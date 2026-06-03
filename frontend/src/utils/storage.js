/**
 * Local storage utilities for Quiz and Flashcard lists
 */

const STORAGE_KEYS = {
  QUIZ_LIST: 'dacs_quiz_list',
  QUIZ_SETS: 'dacs_quiz_sets',
  FLASHCARD_LIST: 'dacs_flashcard_list',
  FLASHCARD_SETS: 'dacs_flashcard_sets',
}

const normalizeQuizQuestions = (data) => {
  if (Array.isArray(data)) {
    return data
  }

  if (Array.isArray(data?.questions)) {
    return data.questions
  }

  if (data?.question) {
    return [data]
  }

  return []
}

const inferQuizSetMetadata = (questions) => {
  const levels = [...new Set(questions.map((q) => q.jlpt_level || q.jlptLevel || q.jlpt).filter(Boolean))]
  const categories = [...new Set(questions.map((q) => q.category).filter(Boolean))]

  return {
    jlpt_level: levels.length === 1 ? levels[0] : 'Mixed',
    category: categories.length === 1 ? categories[0] : 'Mixed',
  }
}

const createQuizSet = ({ title, questions, source = 'uploaded', fileName = '', createdAt }) => {
  const normalizedQuestions = normalizeQuizQuestions(questions)
  const metadata = inferQuizSetMetadata(normalizedQuestions)

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: title || fileName || 'Saved Quiz',
    file_name: fileName,
    source,
    jlpt_level: metadata.jlpt_level,
    category: metadata.category,
    created_at: createdAt || new Date().toISOString(),
    questions: normalizedQuestions,
  }
}

/**
 * Get quiz list from local storage
 */
export const getStoredQuizList = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.QUIZ_LIST)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Failed to parse quiz list from storage:', error)
    return []
  }
}

export const getStoredQuizSets = () => {
  try {
    const storedSets = localStorage.getItem(STORAGE_KEYS.QUIZ_SETS)
    const parsedSets = storedSets ? JSON.parse(storedSets) : []
    if (Array.isArray(parsedSets) && parsedSets.length) {
      return parsedSets
    }

    const legacyQuestions = getStoredQuizList()
    if (!legacyQuestions.length) {
      return []
    }

    const legacySet = createQuizSet({
      title: 'Legacy saved quiz',
      questions: legacyQuestions,
      source: 'legacy',
      createdAt: new Date().toISOString(),
    })
    localStorage.setItem(STORAGE_KEYS.QUIZ_SETS, JSON.stringify([legacySet]))
    return [legacySet]
  } catch (error) {
    console.error('Failed to parse quiz sets from storage:', error)
    return []
  }
}

export const saveQuizSet = ({ title, questions, source = 'uploaded', fileName = '' }) => {
  try {
    const quizSet = createQuizSet({ title, questions, source, fileName })
    const existing = getStoredQuizSets()
    const next = [quizSet, ...existing]
    localStorage.setItem(STORAGE_KEYS.QUIZ_SETS, JSON.stringify(next))
    return quizSet
  } catch (error) {
    console.error('Failed to save quiz set:', error)
    return null
  }
}

export const deleteQuizSet = (quizSetId) => {
  try {
    const next = getStoredQuizSets().filter((set) => set.id !== quizSetId)
    localStorage.setItem(STORAGE_KEYS.QUIZ_SETS, JSON.stringify(next))
    return next
  } catch (error) {
    console.error('Failed to delete quiz set:', error)
    return getStoredQuizSets()
  }
}

/**
 * Save quiz list to local storage (appends to existing)
 */
export const saveQuizList = (quizzes) => {
  try {
    const existing = getStoredQuizList()
    // Merge with existing, avoiding duplicates
    const merged = [...existing]
    for (const quiz of quizzes) {
      const isDuplicate = merged.some(
        (q) => q.question === quiz.question && JSON.stringify(q.options) === JSON.stringify(quiz.options)
      )
      if (!isDuplicate) {
        merged.push(quiz)
      }
    }
    localStorage.setItem(STORAGE_KEYS.QUIZ_LIST, JSON.stringify(merged))
    return merged
  } catch (error) {
    console.error('Failed to save quiz list to storage:', error)
    return getStoredQuizList()
  }
}

/**
 * Clear quiz list from local storage
 */
export const clearQuizList = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.QUIZ_LIST)
    return []
  } catch (error) {
    console.error('Failed to clear quiz list:', error)
    return []
  }
}

/**
 * Get flashcard list from local storage
 */
export const getStoredFlashcardList = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.FLASHCARD_LIST)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Failed to parse flashcard list from storage:', error)
    return []
  }
}

const normalizeFlashcards = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.cards)) return data.cards
  if (data?.front && data?.back) return [data]
  return []
}

const inferFlashcardMetadata = (cards) => {
  const levels = [...new Set(cards.map((card) => card.jlpt_level || card.jlptLevel || card.jlpt).filter(Boolean))]
  const categories = [...new Set(cards.map((card) => card.category).filter(Boolean))]
  return {
    jlpt_level: levels.length === 1 ? levels[0] : 'Mixed',
    category: categories.length === 1 ? categories[0] : 'Mixed',
  }
}

const createFlashcardSet = ({ name, cards, source = 'user', fileName = '', createdAt, stats }) => {
  const normalizedCards = normalizeFlashcards(cards).map((card, index) => ({
    id: card.id || `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    front: String(card.front || '').trim(),
    back: String(card.back || '').trim(),
    jlpt_level: card.jlpt_level || card.jlptLevel || card.jlpt || '',
    category: card.category || '',
  })).filter((card) => card.front && card.back)
  const metadata = inferFlashcardMetadata(normalizedCards)

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name || fileName || 'Flashcard Set',
    file_name: fileName,
    source,
    jlpt_level: metadata.jlpt_level,
    category: metadata.category,
    created_at: createdAt || new Date().toISOString(),
    last_studied_at: null,
    stats: stats || { correct: 0, wrong: 0, streak: 0, accuracy: 0 },
    cards: normalizedCards,
  }
}

export const getStoredFlashcardSets = () => {
  try {
    const storedSets = localStorage.getItem(STORAGE_KEYS.FLASHCARD_SETS)
    const parsedSets = storedSets ? JSON.parse(storedSets) : []
    if (storedSets !== null && Array.isArray(parsedSets)) return parsedSets

    const legacyCards = getStoredFlashcardList()
    if (!legacyCards.length) return []

    const legacySet = createFlashcardSet({
      name: 'Legacy Flashcards',
      cards: legacyCards,
      source: 'legacy',
      createdAt: new Date().toISOString(),
    })
    localStorage.setItem(STORAGE_KEYS.FLASHCARD_SETS, JSON.stringify([legacySet]))
    return [legacySet]
  } catch (error) {
    console.error('Failed to parse flashcard sets from storage:', error)
    return []
  }
}

export const saveFlashcardSet = ({ name, cards, source = 'user', fileName = '' }) => {
  try {
    const set = createFlashcardSet({ name, cards, source, fileName })
    const next = [set, ...getStoredFlashcardSets()]
    localStorage.setItem(STORAGE_KEYS.FLASHCARD_SETS, JSON.stringify(next))
    return set
  } catch (error) {
    console.error('Failed to save flashcard set:', error)
    return null
  }
}

export const updateFlashcardSet = (setId, updates) => {
  try {
    let updatedSet = null
    const next = getStoredFlashcardSets().map((set) => {
      if (set.id !== setId) return set
      const cards = updates.cards ? normalizeFlashcards(updates.cards) : set.cards
      const metadata = inferFlashcardMetadata(cards)
      updatedSet = {
        ...set,
        ...updates,
        cards,
        jlpt_level: updates.jlpt_level || metadata.jlpt_level,
        category: updates.category || metadata.category,
      }
      return updatedSet
    })
    localStorage.setItem(STORAGE_KEYS.FLASHCARD_SETS, JSON.stringify(next))
    return updatedSet
  } catch (error) {
    console.error('Failed to update flashcard set:', error)
    return null
  }
}

export const duplicateFlashcardSet = (setId) => {
  const set = getStoredFlashcardSets().find((item) => item.id === setId)
  if (!set) return null
  return saveFlashcardSet({
    name: `${set.name} Copy`,
    cards: set.cards,
    source: set.source,
    fileName: set.file_name,
  })
}

export const deleteFlashcardSet = (setId) => {
  try {
    const next = getStoredFlashcardSets().filter((set) => set.id !== setId)
    localStorage.setItem(STORAGE_KEYS.FLASHCARD_SETS, JSON.stringify(next))
    return next
  } catch (error) {
    console.error('Failed to delete flashcard set:', error)
    return getStoredFlashcardSets()
  }
}

export const deleteFlashcardFromSet = (setId, cardId) => {
  const set = getStoredFlashcardSets().find((item) => item.id === setId)
  if (!set) return null
  return updateFlashcardSet(setId, {
    cards: set.cards.filter((card) => card.id !== cardId),
  })
}

export const recordFlashcardStudyResult = (setId, isCorrect) => {
  const set = getStoredFlashcardSets().find((item) => item.id === setId)
  if (!set) return null
  const stats = set.stats || { correct: 0, wrong: 0, streak: 0, accuracy: 0 }
  const nextStats = {
    correct: stats.correct + (isCorrect ? 1 : 0),
    wrong: stats.wrong + (isCorrect ? 0 : 1),
    streak: isCorrect ? stats.streak + 1 : 0,
    accuracy: 0,
  }
  const total = nextStats.correct + nextStats.wrong
  nextStats.accuracy = total ? Math.round((nextStats.correct / total) * 100) : 0
  return updateFlashcardSet(setId, {
    stats: nextStats,
    last_studied_at: new Date().toISOString(),
  })
}

/**
 * Save flashcard list to local storage (appends to existing)
 */
export const saveFlashcardList = (flashcards) => {
  try {
    const existing = getStoredFlashcardList()
    // Merge with existing, avoiding duplicates
    const merged = [...existing]
    for (const card of flashcards) {
      const isDuplicate = merged.some((c) => c.front === card.front && c.back === card.back)
      if (!isDuplicate) {
        merged.push(card)
      }
    }
    localStorage.setItem(STORAGE_KEYS.FLASHCARD_LIST, JSON.stringify(merged))
    return merged
  } catch (error) {
    console.error('Failed to save flashcard list to storage:', error)
    return getStoredFlashcardList()
  }
}

/**
 * Clear flashcard list from local storage
 */
export const clearFlashcardList = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.FLASHCARD_LIST)
    return []
  } catch (error) {
    console.error('Failed to clear flashcard list:', error)
    return []
  }
}


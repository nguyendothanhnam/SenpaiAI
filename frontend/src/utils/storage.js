/**
 * Local storage utilities for Quiz and Flashcard lists
 */

const STORAGE_KEYS = {
  QUIZ_LIST: 'dacs_quiz_list',
  FLASHCARD_LIST: 'dacs_flashcard_list',
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


// Catch lossy encoding while preserving ordinary question punctuation.
export function hasCorruptedTranslation(value) {
  return /\uFFFD|\?{2,}|[\p{L}\p{M}]\?[\p{L}\p{M}]/u.test(value)
}

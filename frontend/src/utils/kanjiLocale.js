import i18n from '../i18n'
import en from '../i18n/locales/en/kanji-ui.json'
import vi from '../i18n/locales/vi/kanji-ui.json'

i18n.addResourceBundle('en', 'kanjiUI', en, true, true)
i18n.addResourceBundle('vi', 'kanjiUI', vi, true, true)
const sourceKeys = new Map(Object.keys(en).map(key => [key.toLowerCase(), key]))

export function kanjiText(value, options = {}) {
  const text = String(value ?? '').trim()
  const key = sourceKeys.get(text.toLowerCase())
  if (key) return i18n.t(key, { ns: 'kanjiUI', keySeparator: false, nsSeparator: false, ...options })
  if (i18n.resolvedLanguage === 'en' || !text) return text
  const compound = text.split(' + ')
  if (compound.length > 1) return compound.map(part => kanjiText(part)).join(' · ')
  const vocabulary = text.match(/^(.+?) - (.+)$/)
  if (vocabulary) return `${vocabulary[1]} — ${kanjiText(vocabulary[2])}`
  let match
  if ((match = text.match(/^(?:CNN match|shape|geometry) (\d+)%$/i))) {
    const label = /^cnn/i.test(text) ? 'CNN match {{percent}}%' : /^shape/i.test(text) ? 'Shape {{percent}}%' : 'Geometry {{percent}}%'
    return kanjiText(label, { percent: match[1] })
  }
  if ((match = text.match(/^stroke count (\d+)\/(\d+)$/i))) return kanjiText('Stroke count {{actual}}/{{expected}}', { actual: match[1], expected: match[2] })
  if (/correct stroke count/i.test(text)) return kanjiText('Stroke count correct')
  if ((match = text.match(/^Stroke count matches and the geometry resembles (.+)\.$/))) return kanjiText('Shape and stroke count resemble {{kanji}}.', { kanji: match[1] })
  if ((match = text.match(/^Shape is possible, but stroke count is (\d+); (.+) has (\d+)\.$/))) return kanjiText('Written {{actual}} strokes; {{kanji}} has {{expected}}.', { actual: match[1], kanji: match[2], expected: match[3] })
  if ((match = text.match(/^(N[1-5]) kanji$/))) return `Kanji ${match[1]}`
  if ((match = text.match(/^Step (\d+) \/ (.+)$/))) return kanjiText('Step {{step}} / {{total}}', { step: match[1], total: /\d+/.test(match[2]) ? match[2] : kanjiText('Unavailable') })
  if ((match = text.match(/^(\d+) strokes? captured$/))) return kanjiText('Captured {{count}} strokes', { count: match[1] })
  if ((match = text.match(/^(\d+) strokes?$/))) return `${match[1]} nét`
  if ((match = text.match(/^(Correct\.|Needs work\.) (.+) has (\d+) strokes and you wrote (\d+)\.$/))) return `${kanjiText(match[1])} ${kanjiText('{{kanji}} has {{expected}} strokes and you wrote {{actual}}.', { kanji: match[2], expected: match[3], actual: match[4] })}`
  if ((match = text.match(/^You wrote (\d+) strokes\.$/))) return kanjiText('You wrote {{count}} strokes.', { count: match[1] })
  if (/low confidence|not fully sure/i.test(text)) return kanjiText('Low confidence')
  if (/model.*(?:unavailable|not loaded|not found)|label map|model.*missing/i.test(text)) return kanjiText('Recognition model unavailable')
  if (/not recognized|invalid image|empty canvas|network error|failed to fetch/i.test(text)) return kanjiText('Please clear the canvas and try writing the kanji again.')
  if (/\b[a-zA-Z]{3,}\b/.test(text) && !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text)) return kanjiText('Untranslated information')
  return text
}

export function answerLines(answer: string) {
  return answer.replace(/\r\n/g, '\n').split('\n')
    .filter(line => !/^(?:\*\*)?(?:Intent|Output|Classification|Task)\s*[:：]/i.test(line.trim()))
    .map(line => ({
      heading: /^\s*#{1,6}\s+/.test(line),
      text: line.replace(/^\s*#{1,6}\s+/, '').replace(/^\s*[-*]\s+/, '• ').replace(/```\w*/g, ''),
    }))
}

// Parse emphasis without interpreting HTML or making model-provided links actionable.
export function inlineParts(text: string): { text: string; bold?: boolean; code?: boolean }[] {
  return text.replace(/\\([*_`])/g, '$1').split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`)/g).filter(Boolean).map(part => {
    if (/^(\*\*[^*]+\*\*|__[^_]+__)$/.test(part)) return { text: part.slice(2, -2), bold: true }
    if (part.startsWith('`') && part.endsWith('`')) return { text: part.slice(1, -1), code: true }
    return { text: part.replace(/\*\*/g, '') }
  })
}

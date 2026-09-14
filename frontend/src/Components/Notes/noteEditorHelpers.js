export const highlightClassByColor = {
  violet: 'rounded-sm bg-violet-400/40 px-0.5',
  pink: 'rounded-sm bg-pink-400/40 px-0.5',
  orange: 'rounded-sm bg-orange-400/40 px-0.5',
  emerald: 'rounded-sm bg-emerald-400/40 px-0.5',
  blue: 'rounded-sm bg-blue-400/40 px-0.5',
}

const allowedClassNames = new Set([
  ...Object.values(highlightClassByColor).flatMap((classes) => classes.split(' ')),
  'list-none', 'space-y-2', 'flex', 'items-start', 'gap-2', 'mt-0.5', 'line-through', 'text-slate-500',
  'w-full', 'border-collapse', 'border', 'border-slate-700', 'px-2', 'py-1.5', 'bg-slate-900/70',
  'rounded-lg', 'p-3', 'my-3', 'cursor-pointer', 'font-semibold', 'text-cyan-300',
])

const allowedTags = new Set([
  'P', 'DIV', 'BR', 'H1', 'H2', 'H3', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'STRIKE', 'BLOCKQUOTE',
  'PRE', 'CODE', 'UL', 'OL', 'LI', 'SPAN', 'MARK', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD',
  'DETAILS', 'SUMMARY', 'INPUT',
])

const blockedTags = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'SVG', 'MATH'])

export const plainTextFromHtml = (html) => {
  const element = document.createElement('div')
  element.innerHTML = html || ''
  return (element.textContent || '').replace(/\s+/g, ' ').trim()
}

export const sanitizeRichHtml = (html) => {
  const parser = new DOMParser()
  const documentNode = parser.parseFromString(String(html || ''), 'text/html')

  const sanitizeNode = (node, outputDocument) => {
    if (node.nodeType === Node.TEXT_NODE) return outputDocument.createTextNode(node.textContent || '')
    if (node.nodeType !== Node.ELEMENT_NODE || blockedTags.has(node.tagName)) return outputDocument.createDocumentFragment()

    if (!allowedTags.has(node.tagName)) {
      const fragment = outputDocument.createDocumentFragment()
      Array.from(node.childNodes).forEach((child) => fragment.append(sanitizeNode(child, outputDocument)))
      return fragment
    }

    const cleanNode = outputDocument.createElement(node.tagName.toLowerCase())
    const cleanClasses = (node.getAttribute('class') || '').split(/\s+/).filter((className) => allowedClassNames.has(className))
    if (cleanClasses.length) cleanNode.setAttribute('class', cleanClasses.join(' '))
    if (node.tagName === 'LI' && /^[0-6]$/.test(node.getAttribute('data-indent') || '')) cleanNode.setAttribute('data-indent', node.getAttribute('data-indent'))
    if (node.tagName === 'DETAILS' && node.hasAttribute('open')) cleanNode.setAttribute('open', '')
    if (node.tagName === 'INPUT' && node.getAttribute('type') === 'checkbox') {
      cleanNode.setAttribute('type', 'checkbox')
      if (node.checked || node.hasAttribute('checked')) cleanNode.setAttribute('checked', '')
    }

    Array.from(node.childNodes).forEach((child) => cleanNode.append(sanitizeNode(child, outputDocument)))
    return cleanNode
  }

  const cleanDocument = document.implementation.createHTMLDocument('note')
  const container = cleanDocument.createElement('div')
  Array.from(documentNode.body.childNodes).forEach((node) => container.append(sanitizeNode(node, cleanDocument)))
  return container.innerHTML
}

import { Marked } from 'marked'

// KaTeX and its stylesheet are ~290 KB, so they load when Meridian is first opened rather than
// on every page of the app. Until then equations render as plain LaTeX and are upgraded in place.
let katex = null
let mathLoader = null

export const ensureMathLoaded = () => {
  if (katex) return Promise.resolve(true)
  mathLoader = mathLoader || Promise.all([import('katex'), import('katex/dist/katex.min.css')])
    .then(([module]) => { katex = module.default })
    .catch(() => { mathLoader = null })
  return mathLoader.then(() => Boolean(katex))
}

// Math is pulled out before Markdown runs, because Markdown would otherwise mangle LaTeX such as
// \frac{a}{b} or _i into emphasis. Placeholders use private-use characters that cannot appear in a reply.
const PLACEHOLDER_OPEN = ''
const PLACEHOLDER_CLOSE = ''
const CODE_PATTERN = /```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]+`/g
const DISPLAY_MATH_PATTERN = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]/g
// An inline $ must hug its content, and a closing $ followed by a digit is currency ("$5 and $10"), not math.
const INLINE_MATH_PATTERN = /\\\(([\s\S]+?)\\\)|\$(?![\s$])((?:[^$\\\n]|\\.)+?)(?<!\s)\$(?!\d)/g

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const renderMath = (latex, displayMode) => {
  if (!katex) return `<code class="meridian-math-pending">${escapeHtml(latex.trim())}</code>`
  try {
    return katex.renderToString(latex.trim(), {
      displayMode,
      throwOnError: false, // Invalid LaTeX is shown in red rather than breaking the whole message.
      strict: false,
      trust: false,
      output: 'html',
    })
  } catch {
    return `<code>${escapeHtml(latex)}</code>`
  }
}

const replaceMath = (text, store) => {
  const stash = (html) => `${PLACEHOLDER_OPEN}${store.push(html) - 1}${PLACEHOLDER_CLOSE}`
  return text
    .replace(DISPLAY_MATH_PATTERN, (_match, dollars, brackets) => stash(renderMath(dollars ?? brackets, true)))
    .replace(INLINE_MATH_PATTERN, (_match, parens, dollars) => stash(renderMath(parens ?? dollars, false)))
}

// Math inside a code span or fence is sample text, not an equation, so those regions are stepped over.
const extractMath = (text, store) => {
  let output = ''
  let cursor = 0
  for (const match of text.matchAll(CODE_PATTERN)) {
    output += replaceMath(text.slice(cursor, match.index), store) + match[0]
    cursor = match.index + match[0].length
  }
  return output + replaceMath(text.slice(cursor), store)
}

const SAFE_LINK = /^(https?:|mailto:|#|\/)/i

const marked = new Marked({ gfm: true, breaks: true })
marked.use({
  renderer: {
    // Any HTML the model emits is shown as text; nothing it writes is ever parsed as markup.
    html: (token) => escapeHtml(token.raw),
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens)
      if (!SAFE_LINK.test(String(href || '').trim())) return text
      const titleAttribute = title ? ` title="${escapeHtml(title)}"` : ''
      return `<a href="${escapeHtml(href)}"${titleAttribute} target="_blank" rel="noopener noreferrer nofollow">${text}</a>`
    },
  },
})

export const renderMeridianMessage = (text) => {
  const store = []
  const html = marked.parse(extractMath(String(text || ''), store))
  return html.replace(new RegExp(`${PLACEHOLDER_OPEN}(\\d+)${PLACEHOLDER_CLOSE}`, 'g'), (_match, index) => store[Number(index)] ?? '')
}

const SPOKEN_SYMBOLS = {
  nabla: 'nabla', partial: 'partial', infty: 'infinity', sum: 'the sum of', int: 'the integral of',
  approx: 'approximately', neq: 'not equal to', leq: 'less than or equal to', geq: 'greater than or equal to',
  times: 'times', cdot: 'times', div: 'divided by', pm: 'plus or minus', sqrt: 'the square root of',
  alpha: 'alpha', beta: 'beta', gamma: 'gamma', delta: 'delta', theta: 'theta', lambda: 'lambda',
  mu: 'mu', pi: 'pi', sigma: 'sigma', phi: 'phi', omega: 'omega', rightarrow: 'gives', to: 'to',
}

// Speech reads the meaning, not the notation: "$\\nabla^2 u = 0$" becomes "nabla squared u = 0".
export const toSpeakableText = (value) => String(value || '')
    .replace(/```[\s\S]*?```/g, ' code block. ')
    .replace(/^\s*\|.*\|\s*$/gm, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\\[[\]()]/g, ' ')
    .replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, ' $1 over $2 ')
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, ' the square root of $1 ')
    .replace(/\^\s*\{?\s*2\s*\}?/g, ' squared ')
    .replace(/\^\s*\{?\s*3\s*\}?/g, ' cubed ')
    .replace(/\^\s*\{([^{}]*)\}/g, ' to the power $1 ')
    .replace(/\^(\w)/g, ' to the power $1 ')
    .replace(/_\s*\{([^{}]*)\}/g, ' sub $1 ')
    .replace(/_(\w)/g, ' sub $1 ')
    .replace(/\\([a-zA-Z]+)/g, (_match, name) => ` ${SPOKEN_SYMBOLS[name.toLowerCase()] ?? name} `)
    .replace(/[$\\{}]/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/(\*\*|__|~~)(.*?)\1/g, '$2')
    .replace(/[*_`#|]/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2400)

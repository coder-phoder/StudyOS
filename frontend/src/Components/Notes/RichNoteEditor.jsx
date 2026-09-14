import { useCallback, useMemo, useRef, useState } from 'react'
import { highlightClassByColor, sanitizeRichHtml } from './noteEditorHelpers'

const MAX_FILE_SIZE = 3.5 * 1024 * 1024

const isImage = (attachment) => /^image\/(png|jpeg|gif|webp)$/.test(attachment?.mimeType || '')
const isPdf = (attachment) => attachment?.mimeType === 'application/pdf'

const createTextHtml = (text) => String(text)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/\n/g, '<br>')

const createAttachmentUrl = (attachment) => {
  const [metadata, encodedData] = String(attachment?.data || '').split(',', 2)
  if (!metadata || !encodedData) return null

  try {
    const binary = atob(encodedData)
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    return URL.createObjectURL(new Blob([bytes], { type: attachment.mimeType }))
  } catch {
    return null
  }
}

const formatFileSize = (size) => {
  if (!Number.isFinite(size) || size <= 0) return ''
  return size > 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(size / 1024)} KB`
}

function ToolbarButton({ children, label, onMouseDown, onClick }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={onMouseDown}
      onClick={onClick}
      className="grid h-8 min-w-8 place-items-center rounded-lg px-1.5 text-xs font-bold text-slate-300 transition hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/70"
    >
      {children}
    </button>
  )
}

export default function RichNoteEditor({ note, notes, onChange, onAttach, onRemoveAttachment, onOpenNote, titleInputRef }) {
  const editorRef = useRef(null)
  const fileInputRef = useRef(null)
  const savedRangeRef = useRef(null)
  const initialBodyRef = useRef(note.body)
  const [pane, setPane] = useState('edit')
  const [editorError, setEditorError] = useState('')

  const galleryItems = useMemo(
    () => notes.filter((item) => item.attachment).map((item) => ({
      ...item,
      attachment: item._id === note._id && note.attachment?.data ? note.attachment : item.attachment,
    })),
    [note, notes],
  )

  const setEditorElement = useCallback((element) => {
    editorRef.current = element
    if (element) element.innerHTML = sanitizeRichHtml(initialBodyRef.current)
  }, [])

  const emitBody = () => {
    if (!editorRef.current) return
    const sanitizedBody = sanitizeRichHtml(editorRef.current.innerHTML)
    if (sanitizedBody !== editorRef.current.innerHTML) editorRef.current.innerHTML = sanitizedBody
    onChange({ body: sanitizedBody })
  }

  const rememberSelection = () => {
    const selection = window.getSelection()
    const editor = editorRef.current
    if (!selection?.rangeCount || !editor) return
    const range = selection.getRangeAt(0)
    if (editor.contains(range.commonAncestorContainer)) savedRangeRef.current = range.cloneRange()
  }

  const restoreSelection = () => {
    const selection = window.getSelection()
    if (!selection || !savedRangeRef.current || !editorRef.current) return false
    editorRef.current.focus()
    selection.removeAllRanges()
    selection.addRange(savedRangeRef.current)
    return true
  }

  const prepareToolbarAction = (event) => {
    rememberSelection()
    event.preventDefault()
  }

  const runCommand = (command, value = null) => {
    restoreSelection()
    editorRef.current?.focus()
    document.execCommand(command, false, value)
    emitBody()
  }

  const insertHtml = (html) => {
    restoreSelection()
    editorRef.current?.focus()
    document.execCommand('insertHTML', false, html)
    emitBody()
  }

  const applyHighlight = (color) => {
    restoreSelection()
    const selection = window.getSelection()
    if (!selection?.rangeCount || selection.isCollapsed) {
      setEditorError('Select text before applying a highlight.')
      return
    }

    const range = selection.getRangeAt(0)
    const mark = document.createElement('mark')
    mark.className = highlightClassByColor[color]
    mark.append(range.extractContents())
    range.insertNode(mark)
    selection.removeAllRanges()
    selection.selectAllChildren(mark)
    emitBody()
  }

  const insertChecklist = () => insertHtml(
    '<ul class="list-none space-y-2"><li class="flex items-start gap-2" data-indent="0"><input class="mt-0.5" type="checkbox"><span>Task item</span></li></ul><p><br></p>',
  )

  const insertTable = () => insertHtml(
    '<table class="w-full border-collapse my-3"><thead><tr><th class="border border-slate-700 bg-slate-900/70 px-2 py-1.5">Column</th><th class="border border-slate-700 bg-slate-900/70 px-2 py-1.5">Column</th></tr></thead><tbody><tr><td class="border border-slate-700 px-2 py-1.5"></td><td class="border border-slate-700 px-2 py-1.5"></td></tr><tr><td class="border border-slate-700 px-2 py-1.5"></td><td class="border border-slate-700 px-2 py-1.5"></td></tr></tbody></table><p><br></p>',
  )

  const insertCollapsibleSection = () => insertHtml(
    '<details class="rounded-lg border border-slate-700 p-3 my-3" open><summary class="cursor-pointer font-semibold text-cyan-300">Section title</summary><p>Hidden content goes here…</p></details><p><br></p>',
  )

  const evaluateSelection = () => {
    restoreSelection()
    const selection = window.getSelection()
    const rawExpression = selection?.toString().trim().replace(/=$/, '') || ''
    const expression = rawExpression.replace(/\s+/g, '')

    if (!expression || !/^[0-9.+\-*/%()]+$/.test(expression)) {
      setEditorError('Select a basic arithmetic expression to calculate it.')
      return
    }

    const tokens = expression.match(/\d*\.?\d+|[()+\-*/%]/g) || []
    if (tokens.join('') !== expression) {
      setEditorError('That expression cannot be calculated.')
      return
    }

    let index = 0
    const parseFactor = () => {
      const token = tokens[index]
      if (token === '(') {
        index += 1
        const value = parseExpression()
        if (tokens[index] !== ')') throw new Error('Unmatched parenthesis')
        index += 1
        return value
      }
      if (token === '-') {
        index += 1
        return -parseFactor()
      }
      if (!token || Number.isNaN(Number(token))) throw new Error('Invalid number')
      index += 1
      return Number(token)
    }
    const parseTerm = () => {
      let value = parseFactor()
      while (['*', '/', '%'].includes(tokens[index])) {
        const operator = tokens[index]
        index += 1
        const right = parseFactor()
        if (operator === '*') value *= right
        if (operator === '/') value /= right
        if (operator === '%') value %= right
      }
      return value
    }
    const parseExpression = () => {
      let value = parseTerm()
      while (['+', '-'].includes(tokens[index])) {
        const operator = tokens[index]
        index += 1
        const right = parseTerm()
        value = operator === '+' ? value + right : value - right
      }
      return value
    }

    try {
      const result = parseExpression()
      if (index !== tokens.length || !Number.isFinite(result)) throw new Error('Invalid expression')
      document.execCommand('insertText', false, `${rawExpression} = ${Math.round(result * 1000) / 1000}`)
      setEditorError('')
      emitBody()
    } catch {
      setEditorError('That expression cannot be calculated.')
    }
  }

  const handleEditorKeyDown = (event) => {
    if (event.key !== 'Tab') return
    const selection = window.getSelection()
    const origin = selection?.anchorNode
    const element = origin?.nodeType === Node.TEXT_NODE ? origin.parentElement : origin
    const listItem = element?.closest?.('li[data-indent]')
    if (!listItem) return

    event.preventDefault()
    const currentIndent = Number(listItem.getAttribute('data-indent') || 0)
    listItem.setAttribute('data-indent', String(event.shiftKey ? Math.max(0, currentIndent - 1) : Math.min(6, currentIndent + 1)))
    listItem.style.marginLeft = `${Number(listItem.getAttribute('data-indent')) * 18}px`
    emitBody()
  }

  const handleEditorClick = (event) => {
    const checkbox = event.target.closest('input[type="checkbox"]')
    if (!checkbox) return
    const listItem = checkbox.closest('li')
    listItem?.classList.toggle('line-through', checkbox.checked)
    listItem?.classList.toggle('text-slate-500', checkbox.checked)
    emitBody()
  }

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (file.size > MAX_FILE_SIZE) {
      setEditorError('Keep attachments below 3.5 MB.')
      return
    }

    const isTextFile = file.type.startsWith('text/') || /\.(txt|md|csv)$/i.test(file.name)
    const isSupportedAttachment = /^image\/(png|jpeg|gif|webp)$/.test(file.type) || file.type === 'application/pdf'
    if (!isTextFile && !isSupportedAttachment) {
      setEditorError('Attach a PNG, JPG, GIF, WEBP, PDF, TXT, MD, or CSV file.')
      return
    }

    try {
      const result = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(new Error('The file could not be read.'))
        reader.onload = () => resolve(reader.result)
        if (isTextFile) reader.readAsText(file)
        else reader.readAsDataURL(file)
      })

      if (isTextFile) {
        const currentBody = editorRef.current?.innerHTML || note.body
        const appendedBody = `${currentBody}${currentBody ? '<br><br>' : ''}${createTextHtml(String(result).slice(0, 12000))}`
        if (editorRef.current) editorRef.current.innerHTML = appendedBody
        onChange({
          title: note.title === 'Untitled' ? file.name.replace(/\.[^.]+$/, '') : note.title,
          body: sanitizeRichHtml(appendedBody),
        })
      } else {
        onAttach({ name: file.name, mimeType: file.type, size: file.size, data: String(result) })
      }
      setEditorError('')
    } catch (error) {
      setEditorError(error.message || 'The file could not be attached.')
    }
  }

  const openAttachment = (attachment) => {
    const url = createAttachmentUrl(attachment)
    if (!url) {
      setEditorError('This attachment is unavailable. Please attach it again.')
      return
    }
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  const attachment = note.attachment

  return (
    <section className="flex min-h-[34rem] flex-col bg-slate-950/30">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-1 text-xs font-semibold">
          {['edit', 'gallery'].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPane(value)}
              className={`rounded-md px-3 py-1.5 capitalize transition ${pane === value ? 'bg-violet-400/15 text-violet-200' : 'text-slate-400 hover:text-white'}`}
            >
              {value === 'edit' ? 'Editor' : 'Gallery'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" className="hidden" accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,.txt,.md,.csv" onChange={(event) => void handleFileChange(event)} />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-cyan-400 hover:text-cyan-200">
            Attach file
          </button>
        </div>
      </div>

      {pane === 'edit' ? (
        <>
          <div className="flex flex-wrap gap-1 border-b border-slate-800 bg-slate-950/50 px-3 py-2">
            <ToolbarButton label="Title" onMouseDown={prepareToolbarAction} onClick={() => runCommand('formatBlock', 'h1')}>T</ToolbarButton>
            <ToolbarButton label="Heading" onMouseDown={prepareToolbarAction} onClick={() => runCommand('formatBlock', 'h2')}>H</ToolbarButton>
            <ToolbarButton label="Subheading" onMouseDown={prepareToolbarAction} onClick={() => runCommand('formatBlock', 'h3')}>H3</ToolbarButton>
            <ToolbarButton label="Paragraph" onMouseDown={prepareToolbarAction} onClick={() => runCommand('formatBlock', 'p')}>P</ToolbarButton>
            <span className="mx-1 h-6 w-px self-center bg-slate-800" />
            <ToolbarButton label="Bold" onMouseDown={prepareToolbarAction} onClick={() => runCommand('bold')}><strong>B</strong></ToolbarButton>
            <ToolbarButton label="Italic" onMouseDown={prepareToolbarAction} onClick={() => runCommand('italic')}><em>I</em></ToolbarButton>
            <ToolbarButton label="Underline" onMouseDown={prepareToolbarAction} onClick={() => runCommand('underline')}><u>U</u></ToolbarButton>
            <ToolbarButton label="Strikethrough" onMouseDown={prepareToolbarAction} onClick={() => runCommand('strikeThrough')}><s>S</s></ToolbarButton>
            <ToolbarButton label="Quote" onMouseDown={prepareToolbarAction} onClick={() => runCommand('formatBlock', 'blockquote')}>“</ToolbarButton>
            <ToolbarButton label="Code block" onMouseDown={prepareToolbarAction} onClick={() => runCommand('formatBlock', 'pre')}>{'{ }'}</ToolbarButton>
            <span className="mx-1 h-6 w-px self-center bg-slate-800" />
            {Object.keys(highlightClassByColor).map((color) => (
              <ToolbarButton key={color} label={`${color} highlight`} onMouseDown={prepareToolbarAction} onClick={() => applyHighlight(color)}>
                <span className={`h-3.5 w-3.5 rounded-sm ${highlightClassByColor[color].split(' ').filter((name) => name.startsWith('bg-'))[0]}`} />
              </ToolbarButton>
            ))}
            <span className="mx-1 h-6 w-px self-center bg-slate-800" />
            <ToolbarButton label="Checklist" onMouseDown={prepareToolbarAction} onClick={insertChecklist}>☑</ToolbarButton>
            <ToolbarButton label="Table" onMouseDown={prepareToolbarAction} onClick={insertTable}>▦</ToolbarButton>
            <ToolbarButton label="Collapsible section" onMouseDown={prepareToolbarAction} onClick={insertCollapsibleSection}>▸</ToolbarButton>
            <ToolbarButton label="Calculate selected expression" onMouseDown={prepareToolbarAction} onClick={evaluateSelection}>=</ToolbarButton>
          </div>

          <input
            ref={titleInputRef}
            value={note.title}
            maxLength={160}
            onChange={(event) => onChange({ title: event.target.value })}
            placeholder="Untitled"
            className="w-full border-b border-slate-800 bg-transparent px-5 py-4 text-xl font-bold text-white outline-none placeholder:text-slate-600 focus:bg-slate-900/30"
          />
          <div
            ref={setEditorElement}
            contentEditable
            suppressContentEditableWarning
            spellCheck
            onInput={emitBody}
            onKeyDown={handleEditorKeyDown}
            onKeyUp={rememberSelection}
            onMouseUp={rememberSelection}
            onClick={handleEditorClick}
            data-placeholder="Start writing… Use the toolbar for formatting, checklists, tables, and calculations."
            className="min-h-72 flex-1 whitespace-pre-wrap px-5 py-4 text-sm leading-7 text-slate-200 outline-none empty:before:pointer-events-none empty:before:text-slate-600 empty:before:content-[attr(data-placeholder)]"
          />

          <div className="border-t border-slate-800 px-5 py-4">
            {attachment ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                {isImage(attachment) && attachment.data ? <img src={attachment.data} alt="" className="h-14 w-20 rounded-lg border border-slate-700 object-cover" /> : <span className="grid h-14 w-14 place-items-center rounded-lg border border-slate-700 bg-slate-950 text-xs font-bold text-rose-300">{isPdf(attachment) ? 'PDF' : 'FILE'}</span>}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-200">{attachment.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{formatFileSize(attachment.size) || attachment.mimeType}</p>
                </div>
                <button type="button" onClick={() => openAttachment(attachment)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-400/10">Open</button>
                <button type="button" onClick={onRemoveAttachment} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-400 transition hover:bg-rose-400/10 hover:text-rose-200">Remove</button>
              </div>
            ) : <p className="text-xs text-slate-500">No attachment — add an image, PDF, or text file.</p>}
          </div>
          <label className="border-t border-slate-800 px-5 py-4">
            <span className="sr-only">Tags</span>
            <input value={(note.tags || []).join(', ')} onChange={(event) => onChange({ tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} maxLength={1019} placeholder="Tags — separate with commas, e.g. study, maths/exam" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20" />
          </label>
          {editorError && <p role="alert" className="border-t border-rose-400/20 bg-rose-400/10 px-5 py-2.5 text-xs text-rose-200">{editorError}</p>}
        </>
      ) : (
        <div className="grid flex-1 content-start grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-3">
          {galleryItems.length ? galleryItems.map((item) => (
            <button key={item._id} type="button" onClick={() => onOpenNote(item._id)} className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 text-left transition hover:border-violet-400/60 focus:outline-none focus:ring-2 focus:ring-violet-300">
              {isImage(item.attachment) && item.attachment.data ? <img src={item.attachment.data} alt="" className="h-24 w-full object-cover" /> : <div className="grid h-24 place-items-center bg-slate-950 text-sm font-bold text-slate-400">{isPdf(item.attachment) ? 'PDF' : 'FILE'}</div>}
              <div className="p-3"><p className="truncate text-xs font-semibold text-slate-200">{item.attachment.name}</p><p className="mt-1 truncate text-xs text-slate-500">{item.title}</p></div>
            </button>
          )) : <p className="col-span-full py-10 text-center text-sm text-slate-500">No attachments yet across your notes.</p>}
        </div>
      )}
    </section>
  )
}

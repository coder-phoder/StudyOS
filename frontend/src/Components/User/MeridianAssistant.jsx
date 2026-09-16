import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../Context/AuthContext'
import { ensureMathLoaded, renderMeridianMessage, toSpeakableText } from './meridianFormatting'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000',
  withCredentials: true,
  timeout: 35000,
  headers: { 'Content-Type': 'application/json' },
})

const QUICK_PROMPTS = ['Brief me', 'What should I do next?', 'Plan my week', 'Quiz me', "What's left?"]
const WAKE_WORDS = ['meridian', 'hey meridian', 'ok meridian']
const VOICE_MODES = [
  { value: 'always', label: 'Always speak replies' },
  { value: 'voice', label: 'Only when I speak to it' },
  { value: 'off', label: 'Never speak — text only' },
]

const getErrorMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback

const readStored = (key, fallback) => {
  try {
    return window.localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

const writeStored = (key, value) => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Browser storage is optional; preferences simply do not persist without it.
  }
}

const getGreeting = () => {
  const hour = new Date().getHours()
  const openers = hour >= 5 && hour < 12
    ? ['Morning boss — what’s the move today?', 'Hey boss, ready when you are. What are we hitting first?']
    : hour >= 12 && hour < 17
      ? ['Hey boss — what’s the priority right now?', 'Afternoon boss. What are we locking in?']
      : hour >= 17 && hour < 21
        ? ['Hey boss — still grinding or wrapping up?', 'Evening boss. What are we closing out tonight?']
        : ['Late night boss — what’s the mission?', 'Hey boss, still at it. What do you need?']
  const opener = openers[Math.floor(Math.random() * openers.length)]
  return `${opener} Ask for a brief, a study plan, an explanation, a quiz, or tell me what to update in StudyOS.`
}

const getInitialMessages = (storageKey) => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) || '[]')
    return Array.isArray(saved)
      ? saved.filter((message) => message && typeof message.content === 'string' && ['user', 'assistant', 'system'].includes(message.role)).slice(-18)
      : []
  } catch {
    return []
  }
}

const QUALITY_VOICE_HINTS = /natural|neural|online|premium|enhanced|google/i
const WARM_VOICE_HINTS = /female|samantha|victoria|zira|karen|aria|jenny|susan|moira|tessa|michelle|emma|ana|salli|joanna|ivy|kendra|nicole|amy|priya|neerja/i

const pickVoice = (voices) => {
  const englishVoices = voices.filter((voice) => /^en/i.test(voice.lang || ''))
  const candidates = englishVoices.length ? englishVoices : voices
  return candidates.find((voice) => QUALITY_VOICE_HINTS.test(voice.name) && WARM_VOICE_HINTS.test(voice.name))
    || candidates.find((voice) => WARM_VOICE_HINTS.test(voice.name))
    || candidates.find((voice) => QUALITY_VOICE_HINTS.test(voice.name))
    || candidates[0]
}

// Chrome populates the voice list asynchronously and stays silent when asked to speak before it lands.
const whenVoicesReady = (synthesis, run) => {
  if (synthesis.getVoices?.()?.length) return run()
  let started = false
  const start = () => {
    if (started) return
    started = true
    synthesis.removeEventListener?.('voiceschanged', start)
    run()
  }
  synthesis.addEventListener?.('voiceschanged', start)
  window.setTimeout(start, 1000)
  return undefined
}

function SparkleIcon({ className = 'h-5 w-5' }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}><path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L7 10l5.1-1.9L12 3Z" /><path d="m5 15 .9 2.1L8 18l-2.1.9L5 21l-.9-2.1L2 18l2.1-.9L5 15Z" /></svg>
}

function MicrophoneIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 19v3" /></svg>
}

function SendIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m4 4 16 8-16 8 3-8-3-8Z" /><path d="M7 12h13" /></svg>
}

export default function MeridianAssistant() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (!user) return null

  const userKey = user._id || user.email
  return <MeridianAssistantPanel key={userKey} storageKey={`studyos:meridian-chat:${userKey}`} navigate={navigate} location={location} />
}

function MeridianAssistantPanel({ storageKey, navigate, location }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState(() => getInitialMessages(storageKey))
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mathReady, setMathReady] = useState(false)
  const [voiceMode, setVoiceMode] = useState(() => {
    const stored = readStored(`${storageKey}:voiceMode`, null)
    if (VOICE_MODES.some((mode) => mode.value === stored)) return stored
    // Carry the old on/off toggle over so an existing profile keeps its choice.
    return readStored(`${storageKey}:voice`, null) === 'off' ? 'off' : 'always'
  })
  const [wakeOn, setWakeOn] = useState(() => readStored(`${storageKey}:wake`, 'off') === 'on')
  const [voiceURI, setVoiceURI] = useState(() => readStored(`${storageKey}:voiceURI`, '') || '')
  const [voices, setVoices] = useState([])
  const [error, setError] = useState('')

  const chatRef = useRef(null)
  const recognitionRef = useRef(null)
  const messagesRef = useRef(messages)
  const isSendingRef = useRef(false)
  const voiceModeRef = useRef(voiceMode)
  const voiceURIRef = useRef(voiceURI)
  const wakeOnRef = useRef(wakeOn)
  // Chrome garbage-collects an unreferenced utterance mid-sentence, so the live one is held here.
  const utteranceRef = useRef(null)
  const keepAliveRef = useRef(null)
  const isSpeakingRef = useRef(false)
  const lastInputWasVoiceRef = useRef(false)
  const sendMessageRef = useRef(null)
  const hasGreetedRef = useRef(false)

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { voiceModeRef.current = voiceMode }, [voiceMode])
  useEffect(() => { voiceURIRef.current = voiceURI }, [voiceURI])
  useEffect(() => { wakeOnRef.current = wakeOn }, [wakeOn])

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(messages.slice(-18)))
    } catch {
      // Chat persistence is optional; the current conversation still works.
    }
  }, [messages, storageKey])

  useEffect(() => {
    if (!isOpen || !chatRef.current) return
    chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [isOpen, messages, isSending])

  useEffect(() => {
    if (!('speechSynthesis' in window)) return undefined
    const synthesis = window.speechSynthesis
    const loadVoices = () => setVoices(synthesis.getVoices?.() || [])
    loadVoices()
    synthesis.addEventListener?.('voiceschanged', loadVoices)
    return () => synthesis.removeEventListener?.('voiceschanged', loadVoices)
  }, [])

  const englishVoices = useMemo(() => {
    const english = voices.filter((voice) => /^en/i.test(voice.lang || ''))
    return english.length ? english : voices
  }, [voices])

  const stopSpeaking = useCallback(() => {
    window.clearInterval(keepAliveRef.current)
    isSpeakingRef.current = false
    utteranceRef.current = null
    window.speechSynthesis?.cancel?.()
  }, [])

  const speak = useCallback((text, force = false) => {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return
    const viaVoice = lastInputWasVoiceRef.current
    lastInputWasVoiceRef.current = false
    if (!force) {
      if (voiceModeRef.current === 'off') return
      if (voiceModeRef.current === 'voice' && !viaVoice) return
    }
    const spokenText = toSpeakableText(text)
    if (!spokenText) return

    const synthesis = window.speechSynthesis
    // Chrome silently drops an utterance queued in the same task as cancel(), so the replacement waits a tick.
    const needsCancel = synthesis.speaking || synthesis.pending
    if (needsCancel) synthesis.cancel()
    window.clearInterval(keepAliveRef.current)

    const start = () => whenVoicesReady(synthesis, () => {
      try {
        const utterance = new SpeechSynthesisUtterance(spokenText)
        const available = synthesis.getVoices?.() || []
        const chosen = available.find((voice) => voice.voiceURI === voiceURIRef.current) || pickVoice(available)
        if (chosen) utterance.voice = chosen
        utterance.rate = 0.97
        utterance.pitch = 0.98
        utterance.onstart = () => { isSpeakingRef.current = true }
        utterance.onend = () => {
          isSpeakingRef.current = false
          window.clearInterval(keepAliveRef.current)
          utteranceRef.current = null
        }
        utterance.onerror = (event) => {
          isSpeakingRef.current = false
          window.clearInterval(keepAliveRef.current)
          utteranceRef.current = null
          if (!['canceled', 'interrupted'].includes(event?.error)) {
            setError('Voice playback was unavailable. Check your browser sound settings and try again.')
          }
        }
        utteranceRef.current = utterance
        synthesis.speak(utterance)
        // Chrome stops speaking after roughly fifteen seconds unless the queue is nudged.
        keepAliveRef.current = window.setInterval(() => {
          if (!synthesis.speaking) {
            window.clearInterval(keepAliveRef.current)
            return
          }
          synthesis.pause()
          synthesis.resume()
        }, 10000)
      } catch {
        setError('Voice playback was unavailable. Check your browser sound settings and try again.')
      }
    })

    if (needsCancel) window.setTimeout(start, 120)
    else start()
  }, [])

  // Meridian greets once per page load. Keying this off the stored conversation instead meant that
  // once a profile had ever sent a message, every later open was silent — the chat is persisted.
  const greetIfNeeded = useCallback(() => {
    if (hasGreetedRef.current) return
    hasGreetedRef.current = true
    const greeting = { role: 'assistant', content: getGreeting() }
    const next = [...messagesRef.current, greeting]
    messagesRef.current = next
    setMessages(next)
    speak(greeting.content)
  }, [speak])

  const openAssistant = useCallback(() => {
    setIsOpen(true)
    void ensureMathLoaded().then((loaded) => { if (loaded) setMathReady(true) })
    greetIfNeeded()
  }, [greetIfNeeded])

  const changeVoiceMode = useCallback((mode) => {
    setVoiceMode(mode)
    writeStored(`${storageKey}:voiceMode`, mode)
    if (mode === 'off') stopSpeaking()
    else speak('Voice replies are on.', true)
  }, [speak, stopSpeaking, storageKey])

  const toggleMute = useCallback(() => {
    changeVoiceMode(voiceMode === 'off' ? 'always' : 'off')
  }, [changeVoiceMode, voiceMode])

  const replayVoice = useCallback(() => {
    const last = [...messagesRef.current].reverse().find((message) => message.role === 'assistant')
    speak(last?.content || getGreeting(), true)
  }, [speak])

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        openAssistant()
      }
      if (event.key === 'Escape') {
        setSettingsOpen(false)
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openAssistant])

  const runClientActions = useCallback((actions) => {
    const focusAction = actions.find((action) => action.type === 'focus')
    if (focusAction) {
      if (location.pathname === '/user/coding-time') {
        window.dispatchEvent(new CustomEvent('studyos:meridian-focus', { detail: { command: focusAction.command } }))
      } else {
        navigate('/user/coding-time', { state: focusAction.command === 'start' ? { meridianFocusCommand: 'start' } : null })
      }
      return
    }
    const navigation = actions.find((action) => action.type === 'navigate')
    if (navigation?.path) navigate(navigation.path)
  }, [location.pathname, navigate])

  const sendMessage = useCallback(async (rawMessage, viaVoice = false) => {
    const content = String(rawMessage || '').trim()
    if (!content || isSendingRef.current) return

    lastInputWasVoiceRef.current = viaVoice
    const outgoingMessages = [...messagesRef.current, { role: 'user', content }]
    messagesRef.current = outgoingMessages
    setMessages(outgoingMessages)
    setInput('')
    setError('')
    isSendingRef.current = true
    setIsSending(true)

    try {
      const response = await api.post('/api/meridian/chat', {
        messages: outgoingMessages
          .filter((message) => message.role !== 'system')
          .slice(-14)
          .map((message) => ({ role: message.role, content: message.content })),
      })
      const data = response.data?.data
      if (!response.data?.success || !data?.reply) throw new Error(response.data?.message || 'Meridian could not respond')

      setMessages((current) => {
        const next = [...current, { role: 'assistant', content: data.reply, appliedActions: Array.isArray(data.appliedActions) ? data.appliedActions : [] }]
        if (Array.isArray(data.actionErrors) && data.actionErrors.length) next.push({ role: 'system', content: data.actionErrors.join(' · ') })
        messagesRef.current = next
        return next
      })
      runClientActions(Array.isArray(data.clientActions) ? data.clientActions : [])
      speak(data.reply)
    } catch (requestError) {
      const message = getErrorMessage(requestError, 'Meridian is unavailable right now. Please try again.')
      setError(message)
      setMessages((current) => {
        const next = [...current, { role: 'system', content: message }]
        messagesRef.current = next
        return next
      })
    } finally {
      isSendingRef.current = false
      setIsSending(false)
    }
  }, [runClientActions, speak])

  useEffect(() => { sendMessageRef.current = sendMessage }, [sendMessage])

  // Wake word: a continuous recogniser that only acts on phrases starting with "Meridian".
  useEffect(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!wakeOn || !Recognition) return undefined

    let stopped = false
    let restartTimer = null
    const recognition = new Recognition()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = navigator.language || 'en-US'

    recognition.onresult = (event) => {
      const heard = String(event.results?.[event.results.length - 1]?.[0]?.transcript || '').trim().toLowerCase()
      const wake = WAKE_WORDS.filter((word) => heard.startsWith(word)).sort((a, b) => b.length - a.length)[0]
      if (!wake) return
      const command = heard.slice(wake.length).replace(/^[\s,.!?:-]+/, '').trim()
      setIsOpen(true)
      if (command) sendMessageRef.current?.(command, true)
      else {
        lastInputWasVoiceRef.current = true
        speak('Yes boss?', true)
      }
    }
    recognition.onerror = (event) => {
      if (['not-allowed', 'service-not-allowed'].includes(event.error)) {
        stopped = true
        setWakeOn(false)
        writeStored(`${storageKey}:wake`, 'off')
        setError('Microphone access is blocked. Allow it in your browser site settings, then turn wake word back on.')
      }
    }
    // The browser ends a continuous session on its own, so it is restarted unless Meridian is talking.
    recognition.onend = () => {
      if (stopped || !wakeOnRef.current) return
      restartTimer = window.setTimeout(() => {
        if (stopped || !wakeOnRef.current) return
        try { recognition.start() } catch { /* already running */ }
      }, isSpeakingRef.current ? 1200 : 400)
    }

    try { recognition.start() } catch { /* already running */ }

    return () => {
      stopped = true
      window.clearTimeout(restartTimer)
      recognition.onend = null
      recognition.abort?.()
    }
  }, [speak, storageKey, wakeOn])

  const toggleWakeWord = useCallback(async () => {
    const next = !wakeOn
    if (next) {
      if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) {
        setError('Voice recognition is not supported in this browser. Try Chrome or Edge.')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((track) => track.stop())
      } catch {
        setError('Microphone access was blocked. Allow it in your browser site settings and try again.')
        return
      }
    }
    setWakeOn(next)
    writeStored(`${storageKey}:wake`, next ? 'on' : 'off')
  }, [storageKey, wakeOn])

  const startListening = useCallback(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) {
      setError('Voice input is not supported in this browser. Try Chrome or Edge.')
      return
    }
    if (isListening) {
      recognitionRef.current?.stop?.()
      return
    }
    setError('')
    stopSpeaking()
    const recognition = new Recognition()
    recognition.lang = navigator.language || 'en-US'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onerror = (event) => {
      setIsListening(false)
      setError(['not-allowed', 'service-not-allowed'].includes(event.error)
        ? 'Microphone access was blocked. Allow it in your browser site settings and try again.'
        : 'I could not hear that. Check your microphone and try again.')
    }
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim()
      if (transcript) void sendMessage(transcript, true)
    }
    recognitionRef.current = recognition
    recognition.start()
  }, [isListening, sendMessage, stopSpeaking])

  useEffect(() => () => {
    recognitionRef.current?.abort?.()
    window.clearInterval(keepAliveRef.current)
    window.speechSynthesis?.cancel?.()
  }, [])

  const clearConversation = () => {
    messagesRef.current = []
    setMessages([])
    setError('')
    stopSpeaking()
    try { window.localStorage.removeItem(storageKey) } catch { /* optional browser storage */ }
  }

  const renderedMessages = useMemo(
    () => messages.map((message) => (message.role === 'assistant' ? renderMeridianMessage(message.content) : null)),
    // mathReady is listed so equations re-render once KaTeX has finished loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, mathReady],
  )
  const hasUserMessage = messages.some((message) => message.role === 'user')
  const muteIcon = voiceMode === 'off' ? '🔇' : voiceMode === 'voice' ? '🎙' : '🔊'

  return (
    <>
      {isOpen && <button type="button" aria-label="Close Meridian" onClick={() => setIsOpen(false)} className="fixed inset-0 z-[90] cursor-default bg-slate-950/55 backdrop-blur-[1px]" />}

      <aside aria-label="Meridian assistant" className={`fixed inset-y-0 right-0 z-[100] flex w-full max-w-[420px] flex-col border-l border-violet-300/20 bg-[#0a0b13]/95 shadow-[-24px_0_70px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <header className="border-b border-white/[0.09] px-5 pb-4 pt-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-violet-300/35 bg-violet-400/15 text-violet-200 shadow-[0_0_22px_rgba(167,139,250,0.22)]"><SparkleIcon /></span>
              <div>
                <div className="flex items-center gap-2"><h2 className="font-[family-name:var(--font-display)] text-sm font-bold tracking-[0.14em] text-slate-100">MERIDIAN</h2><span className={`h-1.5 w-1.5 rounded-full ${wakeOn ? 'bg-rose-400 shadow-[0_0_8px_#fb7185]' : 'bg-emerald-400 shadow-[0_0_8px_#4ade80]'}`} /></div>
                <p className="mt-0.5 text-[11px] text-slate-400">{wakeOn ? 'Listening — say “Meridian”' : 'Study partner · Gemini powered'}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={toggleMute} title={voiceMode === 'off' ? 'Voice replies off — tap to enable' : 'Tap to mute voice replies'} className={`grid h-8 w-8 place-items-center rounded-lg text-sm transition ${voiceMode === 'off' ? 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100' : 'bg-violet-400/20 text-violet-200'}`}>{muteIcon}</button>
              <button type="button" onClick={replayVoice} title="Replay Meridian's latest message" className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-100">Replay</button>
              <button type="button" onClick={() => setSettingsOpen((open) => !open)} aria-expanded={settingsOpen} title="Voice settings" className={`grid h-8 w-8 place-items-center rounded-lg text-sm transition ${settingsOpen ? 'bg-white/[0.08] text-slate-100' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'}`}>⚙</button>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="Close Meridian" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-100">✕</button>
            </div>
          </div>

          {settingsOpen && <div className="mt-3 space-y-3 rounded-2xl border border-white/[0.09] bg-white/[0.04] p-3">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Voice replies</span>
              <select value={voiceMode} onChange={(event) => changeVoiceMode(event.target.value)} className="mt-1 w-full rounded-lg border border-white/[0.1] bg-slate-950/60 px-2.5 py-1.5 text-[12px] text-slate-100 outline-none focus:border-violet-300/55">
                {VOICE_MODES.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Meridian voice</span>
              <select value={voiceURI} onChange={(event) => { setVoiceURI(event.target.value); writeStored(`${storageKey}:voiceURI`, event.target.value) }} className="mt-1 w-full rounded-lg border border-white/[0.1] bg-slate-950/60 px-2.5 py-1.5 text-[12px] text-slate-100 outline-none focus:border-violet-300/55">
                <option value="">Auto</option>
                {englishVoices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang})</option>)}
              </select>
            </label>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] text-slate-300">Always listening — say “Meridian”</span>
              <button type="button" role="switch" aria-checked={wakeOn} onClick={() => void toggleWakeWord()} className={`relative h-6 w-11 shrink-0 rounded-full transition ${wakeOn ? 'bg-violet-400' : 'bg-white/[0.14]'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${wakeOn ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
            <button type="button" onClick={clearConversation} className="w-full rounded-lg border border-white/[0.1] px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:bg-white/[0.06] hover:text-slate-100">Clear conversation</button>
          </div>}
        </header>

        <div ref={chatRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-5" aria-live="polite">
          {!hasUserMessage && <section className="rounded-2xl border border-violet-300/15 bg-violet-400/[0.055] px-3.5 py-3 text-[11px] leading-5 text-slate-300">
            <p className="font-semibold uppercase tracking-[0.11em] text-violet-200">How to use Meridian</p>
            <p className="mt-1">Type or speak naturally: “brief me”, “what should I do next?”, “remind me to finish physics notes”, “log 30 minutes of Python”, “schedule a lab tomorrow at 2 PM”, “move my calculus exam to Friday”, “plan my week”, or “help”.</p>
          </section>}
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}-${message.content.slice(0, 16)}`} className={`flex ${message.role === 'user' ? 'justify-end' : message.role === 'system' ? 'justify-center' : 'justify-start'}`}>
              <div className={`${message.role === 'user' ? 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md border border-violet-300/20 bg-violet-400/15 text-slate-100' : message.role === 'system' ? 'max-w-[90%] whitespace-pre-wrap text-center text-[11px] text-amber-200/85' : 'meridian-rich max-w-[88%] rounded-2xl rounded-bl-md border border-white/[0.09] bg-white/[0.055] text-slate-100'} break-words px-3.5 py-3 text-[13px] leading-6`}>
                {message.role === 'assistant'
                  ? <div dangerouslySetInnerHTML={{ __html: renderedMessages[index] }} />
                  : message.content}
                {message.appliedActions?.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{message.appliedActions.map((action) => <span key={action} className="rounded-full bg-emerald-400/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">✓ {action}</span>)}</div>}
              </div>
            </div>
          ))}
          {isSending && <div className="flex justify-start"><div className="rounded-2xl rounded-bl-md border border-white/[0.09] bg-white/[0.055] px-4 py-3 text-sm text-violet-200"><span className="animate-pulse">Meridian is thinking…</span></div></div>}
        </div>

        <div className="border-t border-white/[0.09] bg-slate-950/25 px-4 pb-4 pt-3">
          {!hasUserMessage && <div className="mb-3 flex flex-wrap gap-1.5">{QUICK_PROMPTS.map((prompt) => <button key={prompt} type="button" disabled={isSending} onClick={() => void sendMessage(prompt)} className="rounded-full border border-violet-300/20 bg-violet-400/10 px-2.5 py-1 text-[10.5px] font-semibold text-violet-200 transition hover:bg-violet-400/20 disabled:opacity-50">{prompt}</button>)}</div>}
          {error && <p role="alert" className="mb-2 text-[11px] text-rose-300">{error}</p>}
          <form onSubmit={(event) => { event.preventDefault(); void sendMessage(input) }} className="flex items-end gap-2">
            <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(input) } }} placeholder="Ask or command Meridian…" rows={1} maxLength={4000} disabled={isSending} className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-white/[0.1] bg-white/[0.055] px-3.5 py-2.5 text-[13px] leading-5 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-violet-300/55 focus:ring-2 focus:ring-violet-300/15 disabled:opacity-60" />
            <button type="button" onClick={startListening} disabled={isSending} title={isListening ? 'Stop listening' : 'Speak a command'} className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border transition disabled:opacity-50 ${isListening ? 'border-rose-300/50 bg-rose-400/15 text-rose-200' : 'border-white/[0.1] bg-white/[0.055] text-slate-300 hover:border-violet-300/45 hover:text-violet-200'}`}><MicrophoneIcon /></button>
            <button type="submit" disabled={isSending || !input.trim()} aria-label="Send message" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-violet-300 text-slate-950 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-40"><SendIcon /></button>
          </form>
          <p className="mt-2 text-center text-[10px] leading-4 text-slate-500">Your API key stays on the server. Meridian uses your StudyOS data only to answer and carry out your requests.</p>
        </div>
      </aside>

      <button type="button" onClick={openAssistant} aria-label="Open Meridian" title="Open Meridian (Ctrl/Cmd + K)" className={`fixed bottom-6 right-6 z-[80] grid h-14 w-14 place-items-center rounded-full border border-violet-300/40 bg-[radial-gradient(circle_at_35%_28%,rgba(196,181,253,0.65),rgba(45,31,83,0.95))] text-violet-100 shadow-[0_0_28px_rgba(167,139,250,0.38),0_10px_24px_rgba(0,0,0,0.38)] transition hover:-translate-y-1 hover:shadow-[0_0_35px_rgba(167,139,250,0.5),0_14px_30px_rgba(0,0,0,0.42)] ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}><SparkleIcon className="h-6 w-6" /></button>
    </>
  )
}

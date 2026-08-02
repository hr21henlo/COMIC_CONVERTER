'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Navbar } from './navbar'
import { PreviewPanel } from './preview-panel'
import { HeroCurtain } from './hero-intro'
import { FeedbackModal, HistoryModal, AboutModal } from './modals'
import { ComicLayoutBuilderModal } from './comic-layout-builder-modal'
import { LeftVerticalBar } from './left-vertical-bar'
import { NewComicPanel } from './new-comic-panel'
import type { CustomComicLayout } from './comic-layout-builder-modal'

// ─── Shared Types ─────────────────────────────────────────────────────────────
export type ComicStyle = 'Manga style' | 'Vintage style' | '3D style' | 'Disney style' | 'Family Guy style'

export interface ComicCard {
  headline: string
  speechBubble?: string
  brief1: string
  brief2: string
  imagePrompt: string
  imageUrl?: string | null
  imageLoading?: boolean
  imageError?: string | null
}

export interface GenerationState {
  status: 'idle' | 'generating-script' | 'generating-images' | 'done' | 'error'
  cards: ComicCard[]
  error: string | null
}

// ─── API helpers ──────────────────────────────────────────────────────────────
async function fetchComicScript(text: string, style: string, numCards: number): Promise<ComicCard[]> {
  const res = await fetch('/.netlify/functions/comic-converter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, style, numCards, num_panels: numCards, panel_count: numCards }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error || `comic-converter failed (${res.status})`)
  }
  const data = await res.json()
  if (!data?.cards || !Array.isArray(data.cards) || data.cards.length === 0) {
    throw new Error('No comic cards returned from Gemini script generator')
  }
  return data.cards
}

async function fetchComicImage(imagePrompt: string, style: string): Promise<string> {
  const res = await fetch('/.netlify/functions/generateImage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: imagePrompt, style }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error || `generateImage failed (${res.status})`)
  }
  const data = await res.json()
  if (!data.image) throw new Error('No image returned from image generator')
  // Handle data: URIs, direct HTTP URLs (Pollinations), and raw base64
  const img = data.image as string
  if (img.startsWith('data:') || img.startsWith('http://') || img.startsWith('https://')) {
    return img
  }
  return `data:image/png;base64,${img}`
}

export async function fetchTranslation(text: string, targetLanguage: string): Promise<string> {
  const res = await fetch('/.netlify/functions/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, targetLanguage }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error || `Translation failed (${res.status})`)
  }
  const data = await res.json()
  if (!data?.translatedText) throw new Error('No translated text returned')
  return data.translatedText
}

// ─── Neobrutalism CSS Bouncing Dots animation ─────────────────────────────────
const NB_GLOBAL_STYLES = `
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes ping {
    0% { opacity: 1; transform: scale(1); }
    75%, 100% { opacity: 0; transform: scale(2); }
  }
  /* Nb font everywhere by default */
  .nb-root {
    font-family: var(--nb-font, 'Space Grotesk', system-ui, sans-serif);
  }
  /* Neobrutalism hatched background pattern */
  .nb-hatch-bg {
    background-image: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 10px,
      rgba(0,0,0,0.03) 10px,
      rgba(0,0,0,0.03) 12px
    );
  }
`

// ─── Main Component ───────────────────────────────────────────────────────────
export function ComifyExperience() {
  const wrapperRef = useRef<HTMLDivElement>(null)

  // ── Feature State ────────────────────────────────────────────────────────────
  const [inputText, setInputText] = useState('')
  const [selectedStyle, setSelectedStyle] = useState<ComicStyle>('Manga style')
  const [numPanels, setNumPanels] = useState<number>(5)
  const [activeLayoutId, setActiveLayoutId] = useState<number>(1)
  const [isGridExpanded, setIsGridExpanded] = useState<boolean>(false)

  // ── Panel + Modal State ───────────────────────────────────────────────────────
  const [isNewComicPanelOpen, setIsNewComicPanelOpen] = useState(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const [isComicLayoutBuilderOpen, setIsComicLayoutBuilderOpen] = useState(false)
  const [savedLayouts, setSavedLayouts] = useState<CustomComicLayout[]>([])

  // ── Timer State ───────────────────────────────────────────────────────────────
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startTimer = useCallback(() => {
    setTimerSeconds(0)
    setIsTimerRunning(true)
    timerRef.current = setInterval(() => {
      setTimerSeconds(prev => prev + 1)
    }, 1000)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setIsTimerRunning(false)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // ── Generation History ────────────────────────────────────────────────────────
  const [history, setHistory] = useState<GenerationState[]>([])
  const [generation, setGeneration] = useState<GenerationState>({
    status: 'idle',
    cards: [],
    error: null,
  })

  // ── Generate Handler ──────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!inputText.trim()) return
    startTimer()
    setGeneration({ status: 'generating-script', cards: [], error: null })

    try {
      const cards = await fetchComicScript(inputText, selectedStyle, numPanels)

      const cardsWithLoading = cards.map((c) => ({ ...c, imageLoading: true }))
      setGeneration({ status: 'generating-images', cards: cardsWithLoading, error: null })

      const updatedCards = await Promise.all(
        cardsWithLoading.map(async (card, idx) => {
          let retries = 3
          let imgUrl: string | null = null
          let lastErr: string | null = null
          while (retries > 0 && !imgUrl) {
            try {
              imgUrl = await fetchComicImage(card.imagePrompt, selectedStyle)
            } catch (err: unknown) {
              retries--
              lastErr = err instanceof Error ? err.message : 'Image error'
              if (retries > 0) {
                await new Promise(r => setTimeout(r, 1000))
              }
            }
          }
          return { ...card, imageUrl: imgUrl, imageLoading: false, imageError: imgUrl ? null : (lastErr || 'NVIDIA FLUX failed') }
        })
      )

      const finalGen: GenerationState = { status: 'done', cards: updatedCards, error: null }
      setGeneration(finalGen)
      setHistory((prev) => [finalGen, ...prev])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred'
      setGeneration({ status: 'error', cards: [], error: message })
    } finally {
      stopTimer()
    }
  }, [inputText, selectedStyle, numPanels, startTimer, stopTimer])

  // ── Translate Handler ─────────────────────────────────────────────────────────
  const handleTranslatePanel = useCallback(async (panelIndex: number, targetLanguage: string) => {
    const card = generation.cards[panelIndex]
    if (!card) return

    const safeTranslate = async (t?: string | null) => {
      if (!t) return t || ''
      try {
        return await fetchTranslation(t, targetLanguage)
      } catch (err) {
        console.warn(`Translation notice for "${t.substring(0, 20)}...":`, err)
        return t
      }
    }

    try {
      const [transHeadline, transSpeech, transBrief1, transBrief2] = await Promise.all([
        safeTranslate(card.headline),
        safeTranslate(card.speechBubble),
        safeTranslate(card.brief1),
        safeTranslate(card.brief2),
      ])

      setGeneration((prev) => {
        const newCards = [...prev.cards]
        newCards[panelIndex] = {
          ...card,
          headline: transHeadline || card.headline,
          speechBubble: transSpeech || card.speechBubble,
          brief1: transBrief1 || card.brief1,
          brief2: transBrief2 || card.brief2,
        }
        return { ...prev, cards: newCards }
      })
    } catch (err: unknown) {
      console.error('Translation error:', err)
    }
  }, [generation.cards])

  // ── Download Handler ──────────────────────────────────────────────────────────
  const handleDownload = useCallback((cardIndex: number = 0) => {
    const card = generation.cards[cardIndex]
    if (!card?.imageUrl) return
    const a = document.createElement('a')
    a.href = card.imageUrl
    a.download = `comic-panel-${cardIndex + 1}-${Date.now()}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [generation.cards])

  // ── Layout Save Handler ───────────────────────────────────────────────────────
  const handleSaveLayout = useCallback((layout: CustomComicLayout) => {
    setSavedLayouts(prev => [layout, ...prev.filter(l => l.id !== layout.id)])
  }, [])

  return (
    <div ref={wrapperRef} className="relative min-h-screen flex flex-col w-full bg-[#FFFBF0] nb-hatch-bg">
      {/* Global NB animations */}
      <style>{NB_GLOBAL_STYLES}</style>

      {/* ── Stage 1: Hero Page ── */}
      <HeroCurtain />

      {/* ── Stage 2: Main Generator View ── */}
      <div className="relative flex w-full flex-1 border-t-[4px] border-black">
        {/* ── Left Vertical Icon Bar (+ L F) ── */}
          <LeftVerticalBar
            isNewComicPanelOpen={isNewComicPanelOpen}
            onToggleNewComicPanel={() => setIsNewComicPanelOpen(prev => !prev)}
            onOpenLayoutBuilder={() => setIsComicLayoutBuilderOpen(true)}
            onOpenFeedback={() => setIsFeedbackOpen(true)}
          />

          {/* ── New Comic Slide-In Panel ── */}
          <NewComicPanel
            isOpen={isNewComicPanelOpen}
            onClose={() => setIsNewComicPanelOpen(false)}
            inputText={inputText}
            onInputChange={setInputText}
            selectedStyle={selectedStyle}
            onStyleChange={setSelectedStyle}
            numPanels={numPanels}
            onNumPanelsChange={setNumPanels}
            activeLayoutId={activeLayoutId}
            onActiveLayoutChange={setActiveLayoutId}
            onGenerate={handleGenerate}
            isLoading={generation.status === 'generating-script' || generation.status === 'generating-images'}
            timerSeconds={timerSeconds}
            savedLayouts={savedLayouts.map(l => ({ id: l.id, name: l.name, numPanels: l.numPanels, gridPreset: l.gridPreset }))}
            onSelectSavedLayout={(layout) => setNumPanels(layout.numPanels)}
          />

        <div
          className="relative flex flex-1 w-full flex-col"
          style={{ zIndex: 2 }}
        >
          {/* Navbar */}
          <Navbar
              timerSeconds={timerSeconds}
              isTimerRunning={isTimerRunning}
              onOpenAbout={() => setIsAboutOpen(true)}
              onOpenHistory={() => setIsHistoryOpen(true)}
            />

            {/* ── Stage 3: Main Converter ── */}
            <div className="flex flex-col items-center relative flex-1">
              {/* Page Header */}
              <div
                style={{
                  textAlign: 'center',
                  padding: '12px 24px 8px',
                }}
              >
                <h1
                  style={{
                    fontFamily: "'Bangers', system-ui, cursive, sans-serif",
                    fontSize: 'clamp(26px, 4vw, 42px)',
                    fontWeight: 400,
                    color: '#0A0A0A',
                    letterSpacing: '0.04em',
                    lineHeight: 1.05,
                    margin: 0,
                  }}
                >
                  Turn Any News Into a{' '}
                  <span
                    className="transition-transform duration-200 hover:scale-110 hover:-rotate-2 cursor-pointer"
                    style={{
                      display: 'inline-block',
                      background: '#4361EE',
                      color: '#FFFFFF',
                      padding: '2px 10px',
                      border: '3px solid #0A0A0A',
                      borderRadius: 6,
                      boxShadow: '4px 4px 0px #0A0A0A',
                      transform: 'rotate(-1deg)',
                    }}
                  >
                    Comic Strip
                  </span>
                </h1>
              </div>

              {/* Comic Preview Area */}
              <div
                style={{
                  width: '100%',
                  paddingLeft: 24,
                  paddingRight: 24,
                  paddingBottom: 16,
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <PreviewPanel
                  generation={generation}
                  onDownload={handleDownload}
                  onTranslatePanel={handleTranslatePanel}
                  activeLayoutId={activeLayoutId}
                  isExpanded={isGridExpanded}
                  onToggleExpand={setIsGridExpanded}
                />
              </div>
            </div>
          </div>
      </div>

      {/* Modals */}
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelectHistory={(gen) => setGeneration(gen)}
      />
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      <ComicLayoutBuilderModal
        isOpen={isComicLayoutBuilderOpen}
        onClose={() => setIsComicLayoutBuilderOpen(false)}
        onSaveLayout={handleSaveLayout}
      />
    </div>
  )
}

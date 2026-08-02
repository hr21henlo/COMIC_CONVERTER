'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Sparkles, Loader2, Check, Layers,
  ChevronDown, LayoutGrid, Clock,
} from 'lucide-react'
import type { ComicStyle } from './comify-experience'

import imgManga from '../../src/assets/manga.png'
import imgVintage from '../../src/assets/vintage.png'
import img3D from '../../src/assets/3d.png'
import imgDisney from '../../src/assets/disney.png'

// ─── Dynamic Layout Switcher Assets ─────────────────────────────────────────────
import layout1 from '../../src/assets/layouts/1.jpg'
import layout2 from '../../src/assets/layouts/2.jpg'
import layout3 from '../../src/assets/layouts/3.jpg'
import layout4 from '../../src/assets/layouts/4.jpg'
import layout5 from '../../src/assets/layouts/5.jpg'
import layout6 from '../../src/assets/layouts/6.jpg'
import layout7 from '../../src/assets/layouts/7.jpg'
import layout8 from '../../src/assets/layouts/8.jpg'
import layout9 from '../../src/assets/layouts/9.jpg'
import layout10 from '../../src/assets/layouts/10.jpg'
import layout11 from '../../src/assets/layouts/11.jpg'
import layout12 from '../../src/assets/layouts/12.jpg'

const LAYOUT_THUMBNAILS = [
  layout1, layout2, layout3, layout4, layout5, layout6,
  layout7, layout8, layout9, layout10, layout11, layout12
]

// ─── Style options ─────────────────────────────────────────────────────────────
const STYLE_OPTIONS: { id: ComicStyle; label: string; image?: string; fallbackEmoji: string; color: string }[] = [
  { id: 'Manga style',      label: 'Manga',      image: imgManga,   fallbackEmoji: '⚡', color: '#9B5DE5' },
  { id: 'Vintage style',    label: 'Vintage',    image: imgVintage, fallbackEmoji: '🎩', color: '#F77F00' },
  { id: '3D style',         label: '3D',         image: img3D,      fallbackEmoji: '🎲', color: '#4361EE' },
  { id: 'Disney style',     label: 'Disney',     image: imgDisney,  fallbackEmoji: '✨', color: '#FF6B6B' },
]

// ─── Layout Preview Mini Panels ───────────────────────────────────────────────
function LayoutPreviewGrid({
  cols, rows, color,
}: { cols: number; rows: number; color: string }) {
  const panels = Array.from({ length: cols * rows })
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: 3,
        width: '100%',
        height: '100%',
      }}
    >
      {panels.map((_, i) => (
        <div
          key={i}
          style={{
            background: color,
            border: '2px solid #0A0A0A',
            borderRadius: 3,
            opacity: 0.85,
          }}
        />
      ))}
    </div>
  )
}

// ─── Props ─────────────────────────────────────────────────────────────────────
interface NewComicPanelProps {
  isOpen: boolean
  onClose: () => void
  inputText: string
  onInputChange: (val: string) => void
  selectedStyle: ComicStyle
  onStyleChange: (style: ComicStyle) => void
  numPanels: number
  onNumPanelsChange: (count: number) => void
  onGenerate: () => void
  isLoading: boolean
  activeLayoutId: number
  onActiveLayoutChange: (id: number) => void
  timerSeconds: number
  savedLayouts: { id: string; name: string; numPanels: number; gridPreset: string }[]
  onSelectSavedLayout?: (layout: { numPanels: number }) => void
}

// ─── Component ────────────────────────────────────────────────────────────────
export function NewComicPanel({
  isOpen,
  onClose,
  inputText,
  onInputChange,
  selectedStyle,
  onStyleChange,
  numPanels,
  onNumPanelsChange,
  onGenerate,
  isLoading,
  activeLayoutId,
  onActiveLayoutChange,
  timerSeconds,
  savedLayouts,
  onSelectSavedLayout,
}: NewComicPanelProps) {
  const [layoutTab, setLayoutTab] = useState<'default' | 'yours'>('default')
  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay (subtle) */}
          <motion.div
            key="panel-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.35)',
              zIndex: 90,
            }}
          />

          {/* Slide-in Panel */}
          <motion.div
            key="new-comic-panel"
            initial={{ x: -400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -400, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              position: 'fixed',
              left: 82,
              top: 0,
              bottom: 0,
              width: 340,
              zIndex: 95,
              display: 'flex',
              flexDirection: 'column',
              background: '#FFFBF0',
              border: '3px solid #0A0A0A',
              borderLeft: 'none',
              borderRadius: 0,
              boxShadow: '6px 0px 0px #0A0A0A',
              overflow: 'hidden',
            }}
          >
            {/* ── Header ── */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 18px 12px',
              borderBottom: '4px solid #0A0A0A',
              background: '#DC2626',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22, fontFamily: 'var(--nb-font)', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.5px' }}>
                  ✦ NEW COMIC
                </span>
              </div>
              <button
                id="nb-close-panel-btn"
                onClick={onClose}
                style={{
                  width: 34, height: 34,
                  background: '#0A0A0A',
                  border: '3px solid #0A0A0A',
                  borderRadius: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '3px 3px 0px rgba(0,0,0,0.3)',
                  transition: 'transform 0.08s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <X size={18} color="#FFFFFF" strokeWidth={3} />
              </button>
            </div>

            {/* ── Scrollable Body ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16, scrollbarWidth: 'none' }}>

              {/* Text Input */}
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--nb-font)', fontWeight: 800, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#0A0A0A', marginBottom: 6 }}>
                  Story / News Text
                </label>
                <div style={{ position: 'relative' }}>
                  <textarea
                    id="nb-text-input"
                    value={inputText}
                    onChange={e => onInputChange(e.target.value)}
                    placeholder="Paste any news article or story here..."
                    disabled={isLoading}
                    rows={5}
                    style={{
                      width: '100%',
                      resize: 'none',
                      fontFamily: 'var(--nb-font)',
                      fontSize: 14,
                      color: '#0A0A0A',
                      background: '#FFFFFF',
                      border: '3px solid #0A0A0A',
                      borderRadius: 0,
                      padding: '10px 12px',
                      boxShadow: '4px 4px 0px #0A0A0A',
                      outline: 'none',
                      scrollbarWidth: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  {wordCount > 0 && (
                    <span style={{
                      position: 'absolute', bottom: 8, right: 10,
                      fontSize: 10, fontWeight: 800, color: '#0A0A0A',
                      fontFamily: 'var(--nb-font)',
                      background: '#DC2626',
                      color: '#FFFFFF',
                      border: '2px solid #0A0A0A',
                      borderRadius: 0,
                      padding: '1px 5px',
                    }}>
                      {wordCount}w
                    </span>
                  )}
                </div>
              </div>

              {/* Style Selector */}
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--nb-font)', fontWeight: 800, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#0A0A0A', marginBottom: 8 }}>
                  Art Style
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {STYLE_OPTIONS.map(opt => {
                    const active = selectedStyle === opt.id
                    return (
                      <button
                        key={opt.id}
                        id={`nb-style-${opt.id.replace(/\s/g, '-')}`}
                        onClick={() => onStyleChange(opt.id)}
                        disabled={isLoading}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '9px 12px',
                          background: active ? opt.color : '#FFFFFF',
                          border: '3px solid #0A0A0A',
                          borderRadius: 0,
                          boxShadow: active ? '4px 4px 0px #0A0A0A' : '2px 2px 0px #0A0A0A',
                          cursor: 'pointer',
                          fontFamily: 'var(--nb-font)',
                          fontWeight: 800,
                          fontSize: 13,
                          color: '#0A0A0A',
                          transition: 'all 0.08s ease',
                          textAlign: 'left',
                        }}
                        onMouseEnter={e => {
                          if (!active) (e.currentTarget as HTMLButtonElement).style.transform = 'translate(-1px, -1px)'
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLButtonElement).style.transform = 'translate(0,0)'
                        }}
                      >
                        {opt.image ? (
                          <img 
                            src={opt.image} 
                            alt={opt.label} 
                            className="w-10 h-10 object-contain mr-3 border-2 border-black bg-white" 
                          />
                        ) : (
                          <div className="w-10 h-10 flex items-center justify-center mr-3 border-2 border-black bg-white text-lg">
                            {opt.fallbackEmoji}
                          </div>
                        )}
                        <span style={{ flex: 1 }}>{opt.label}</span>
                        {active && <Check size={16} strokeWidth={4} color="#0A0A0A" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Panel Count */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--nb-font)', fontWeight: 800, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#0A0A0A', marginBottom: 8 }}>
                  <Layers size={13} strokeWidth={3} />
                  Number of Panels
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {[1, 3, 5, 6].map(count => {
                    const active = numPanels === count
                    return (
                      <button
                        key={count}
                        id={`nb-panels-${count}`}
                        onClick={() => onNumPanelsChange(count)}
                        disabled={isLoading}
                        style={{
                          padding: '10px 0',
                          background: active ? '#0A0A0A' : '#FFFFFF',
                          color: active ? '#DC2626' : '#0A0A0A',
                          border: '3px solid #0A0A0A',
                          borderRadius: 0,
                          boxShadow: active ? 'none' : '3px 3px 0px #0A0A0A',
                          cursor: 'pointer',
                          fontFamily: 'var(--nb-font)',
                          fontWeight: 900,
                          fontSize: 15,
                          transition: 'all 0.08s ease',
                        }}
                      >
                        {count}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Convert Button */}
              <button
                id="nb-convert-btn"
                onClick={onGenerate}
                disabled={isLoading || !inputText.trim()}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: isLoading ? '#0A0A0A' : '#DC2626',
                  color: '#FFFFFF',
                  border: '4px solid #0A0A0A',
                  borderRadius: 0,
                  boxShadow: isLoading ? 'none' : '5px 5px 0px #0A0A0A',
                  cursor: isLoading || !inputText.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--nb-font)',
                  fontWeight: 900,
                  fontSize: 17,
                  letterSpacing: '-0.2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  opacity: !inputText.trim() ? 0.5 : 1,
                  transition: 'all 0.08s ease',
                  transform: isLoading ? 'translate(4px, 4px)' : undefined,
                }}
                onMouseEnter={e => {
                  if (!isLoading && inputText.trim()) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translate(-2px, -2px)'
                    ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '7px 7px 0px #0A0A0A'
                  }
                }}
                onMouseLeave={e => {
                  if (!isLoading) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translate(0,0)'
                    ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '5px 5px 0px #0A0A0A'
                  }
                }}
                onMouseDown={e => {
                  if (!isLoading && inputText.trim()) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translate(3px, 3px)'
                    ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '1px 1px 0px #0A0A0A'
                  }
                }}
                onMouseUp={e => {
                  if (!isLoading && inputText.trim()) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translate(-2px, -2px)'
                    ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '7px 7px 0px #0A0A0A'
                  }
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} color="#FFFFFF" strokeWidth={3} style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ color: '#FFFFFF' }}>CREATING...</span>
                    <span style={{
                      fontSize: 13, fontWeight: 800,
                      color: '#FFFFFF',
                      fontFamily: 'monospace',
                      background: 'rgba(255,255,255,0.15)',
                      padding: '2px 8px',
                      borderRadius: 4,
                      border: '1px solid rgba(255,230,109,0.3)',
                    }}>
                      {formatTimer(timerSeconds)}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} strokeWidth={3} />
                    <span>CONVERT ⚡</span>
                  </>
                )}
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 3, background: '#0A0A0A', borderRadius: 2 }} />
                <span style={{ fontFamily: 'var(--nb-font)', fontWeight: 800, fontSize: 11, color: '#0A0A0A', letterSpacing: '0.1em', textTransform: 'uppercase' }}>LAYOUTS</span>
                <div style={{ flex: 1, height: 3, background: '#0A0A0A', borderRadius: 2 }} />
              </div>

              {/* Layout Tabs */}
              <div style={{ display: 'flex', gap: 0, border: '3px solid #0A0A0A', borderRadius: 0, overflow: 'hidden', flexShrink: 0 }}>
                {(['default', 'yours'] as const).map(tab => (
                  <button
                    key={tab}
                    id={`nb-layout-tab-${tab}`}
                    onClick={() => setLayoutTab(tab)}
                    style={{
                      flex: 1,
                      padding: '9px 0',
                      background: layoutTab === tab ? '#0A0A0A' : '#FFFBF0',
                      color: layoutTab === tab ? '#DC2626' : '#0A0A0A',
                      border: 'none',
                      borderRight: tab === 'default' ? '3px solid #0A0A0A' : 'none',
                      fontFamily: 'var(--nb-font)',
                      fontWeight: 800,
                      fontSize: 12,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      transition: 'all 0.08s ease',
                    }}
                  >
                    {tab === 'default' ? 'Default' : 'Your Layouts'}
                  </button>
                ))}
              </div>

              {/* Dynamic 12-Layout Grid */}
              {layoutTab === 'default' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {LAYOUT_THUMBNAILS.map((thumbUrl, idx) => {
                    const layoutId = idx + 1
                    const isActive = activeLayoutId === layoutId
                    return (
                      <button
                        key={layoutId}
                        id={`nb-layout-${layoutId}`}
                        onClick={() => onActiveLayoutChange(layoutId)}
                        style={{
                          background: isActive ? '#DC2626' : '#FFFFFF',
                          border: isActive ? '4px solid #0A0A0A' : '3px solid #0A0A0A',
                          borderRadius: 0,
                          padding: isActive ? 6 : 0,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.08s ease',
                          boxShadow: isActive ? 'none' : '3px 3px 0px #0A0A0A',
                          outline: 'none',
                        }}
                        onMouseEnter={e => {
                          if (!isActive) {
                            (e.currentTarget as HTMLButtonElement).style.transform = 'translate(-2px,-2px)'
                            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '4px 4px 0px 0px #0A0A0A'
                          }
                        }}
                        onMouseLeave={e => {
                          if (!isActive) {
                            (e.currentTarget as HTMLButtonElement).style.transform = 'translate(0,0)'
                            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '3px 3px 0px #0A0A0A'
                          }
                        }}
                        onMouseDown={e => {
                          if (!isActive) {
                            (e.currentTarget as HTMLButtonElement).style.transform = 'translate(2px, 2px)'
                            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '1px 1px 0px #0A0A0A'
                          }
                        }}
                        onMouseUp={e => {
                          if (!isActive) {
                            (e.currentTarget as HTMLButtonElement).style.transform = 'translate(-2px, -2px)'
                            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '4px 4px 0px 0px #0A0A0A'
                          }
                        }}
                      >
                        <img 
                          src={thumbUrl} 
                          alt={`Layout ${layoutId}`} 
                          style={{
                            width: '100%',
                            height: 'auto',
                            display: 'block',
                            border: isActive ? '3px solid #0A0A0A' : 'none',
                          }}
                        />
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Your Layouts */}
              {layoutTab === 'yours' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {savedLayouts.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '24px 16px',
                      border: '3px dashed #0A0A0A',
                      borderRadius: 0,
                      background: 'rgba(0,0,0,0.02)',
                    }}>
                      <LayoutGrid size={28} color="#0A0A0A" style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                      <p style={{ fontFamily: 'var(--nb-font)', fontWeight: 700, fontSize: 13, color: '#0A0A0A', opacity: 0.5, margin: 0 }}>
                        No custom layouts yet.
                      </p>
                      <p style={{ fontFamily: 'var(--nb-font)', fontWeight: 500, fontSize: 11, color: '#0A0A0A', opacity: 0.4, marginTop: 4, marginBottom: 0 }}>
                        Build one with the Layout Builder (L)
                      </p>
                    </div>
                  ) : (
                    savedLayouts.map(layout => (
                      <button
                        key={layout.id}
                        onClick={() => onSelectSavedLayout?.({ numPanels: layout.numPanels })}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 12px',
                          background: '#FFFFFF',
                          border: '3px solid #0A0A0A',
                          borderRadius: 0,
                          boxShadow: '3px 3px 0px #0A0A0A',
                          cursor: 'pointer',
                          fontFamily: 'var(--nb-font)',
                          fontWeight: 700,
                          fontSize: 13,
                          color: '#0A0A0A',
                          transition: 'all 0.08s ease',
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLButtonElement).style.transform = 'translate(-1px,-1px)'
                          ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '5px 5px 0px #0A0A0A'
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLButtonElement).style.transform = 'translate(0,0)'
                          ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '3px 3px 0px #0A0A0A'
                        }}
                      >
                        <LayoutGrid size={16} strokeWidth={2.5} />
                        <div style={{ flex: 1, textAlign: 'left' }}>
                          <div>{layout.name}</div>
                          <div style={{ fontSize: 10, opacity: 0.6 }}>{layout.numPanels} panels · {layout.gridPreset}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Bottom padding */}
              <div style={{ height: 16 }} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

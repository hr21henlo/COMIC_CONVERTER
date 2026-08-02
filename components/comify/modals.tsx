'use client'

import { useState } from 'react'
import { X, Send, History as HistoryIcon, Info, Sparkles, Star, CheckCircle, LayoutGrid } from 'lucide-react'
import type { GenerationState } from './comify-experience'

// ─── Shared Modal Wrapper ─────────────────────────────────────────────────────
function NbModal({
  children,
  onClose,
  maxWidth = 440,
  accentColor = '#FFE66D',
}: {
  children: React.ReactNode
  onClose: () => void
  maxWidth?: number
  accentColor?: string
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth,
          background: '#FFFBF0',
          border: '3px solid #0A0A0A',
          borderRadius: 16,
          boxShadow: '8px 8px 0px #0A0A0A',
          overflow: 'hidden',
          fontFamily: 'var(--nb-font)',
        }}
      >
        {/* Top accent bar */}
        <div style={{ height: 8, background: accentColor, borderBottom: '3px solid #0A0A0A' }} />
        <div style={{ padding: '20px 22px 24px' }}>
          {children}
        </div>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 20, right: 20,
            width: 34, height: 34,
            background: '#0A0A0A',
            border: '2px solid #0A0A0A',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '3px 3px 0px rgba(0,0,0,0.3)',
            transition: 'transform 0.08s',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <X size={16} color="#FFE66D" strokeWidth={3} />
        </button>
      </div>
    </div>
  )
}

// ─── NB Button ────────────────────────────────────────────────────────────────
function NbBtn({
  onClick,
  disabled,
  color = '#FFE66D',
  textColor = '#0A0A0A',
  children,
  type = 'button',
  style: extraStyle,
}: {
  onClick?: () => void
  disabled?: boolean
  color?: string
  textColor?: string
  children: React.ReactNode
  type?: 'button' | 'submit'
  style?: React.CSSProperties
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '11px 20px',
        background: color,
        color: textColor,
        border: '3px solid #0A0A0A',
        borderRadius: 8,
        boxShadow: disabled ? 'none' : '4px 4px 0px #0A0A0A',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--nb-font)',
        fontWeight: 800,
        fontSize: 14,
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.08s ease',
        width: '100%',
        ...extraStyle,
      }}
      onMouseEnter={e => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.transform = 'translate(-2px,-2px)'
          ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '6px 6px 0px #0A0A0A'
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'translate(0,0)'
        ;(e.currentTarget as HTMLButtonElement).style.boxShadow = disabled ? 'none' : '4px 4px 0px #0A0A0A'
      }}
      onMouseDown={e => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.transform = 'translate(3px,3px)'
          ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
        }
      }}
      onMouseUp={e => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.transform = 'translate(-2px,-2px)'
          ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '6px 6px 0px #0A0A0A'
        }
      }}
    >
      {children}
    </button>
  )
}

// ─── Section Heading ──────────────────────────────────────────────────────────
function ModalHeading({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
      <div style={{
        width: 36, height: 36,
        background: '#FFE66D',
        border: '3px solid #0A0A0A',
        borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '3px 3px 0px #0A0A0A',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <h3 style={{ margin: 0, fontFamily: 'var(--nb-font)', fontWeight: 900, fontSize: 20, color: '#0A0A0A', letterSpacing: '-0.3px' }}>
        {children}
      </h3>
    </div>
  )
}

// ─── Feedback Modal ───────────────────────────────────────────────────────────
export function FeedbackModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!comment.trim()) return
    setSubmitted(true)
    setTimeout(() => {
      setSubmitted(false)
      setComment('')
      onClose()
    }, 1800)
  }

  return (
    <NbModal onClose={onClose} accentColor="#FF6B6B">
      {submitted ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0', textAlign: 'center' }}>
          <div style={{
            width: 60, height: 60,
            background: '#06D6A0',
            border: '3px solid #0A0A0A',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '4px 4px 0px #0A0A0A',
          }}>
            <CheckCircle size={32} color="#0A0A0A" strokeWidth={3} />
          </div>
          <h3 style={{ margin: 0, fontFamily: 'var(--nb-font)', fontWeight: 900, fontSize: 22, color: '#0A0A0A' }}>THANK YOU!</h3>
          <p style={{ margin: 0, fontFamily: 'var(--nb-font)', fontWeight: 600, fontSize: 14, color: '#0A0A0A', opacity: 0.6 }}>
            Your feedback makes ComicGen better.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ModalHeading icon={<Sparkles size={18} strokeWidth={3} color="#0A0A0A" />}>
            Your Feedback
          </ModalHeading>

          {/* Star Rating */}
          <div>
            <label style={{ display: 'block', fontFamily: 'var(--nb-font)', fontWeight: 800, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#0A0A0A', marginBottom: 8 }}>
              Rating
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  style={{
                    width: 40, height: 40,
                    background: star <= rating ? '#FFE66D' : '#FFFFFF',
                    border: '3px solid #0A0A0A',
                    borderRadius: 8,
                    boxShadow: '3px 3px 0px #0A0A0A',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.08s ease',
                    fontSize: 18,
                  }}
                >
                  <Star
                    size={18}
                    strokeWidth={2.5}
                    style={{ fill: star <= rating ? '#0A0A0A' : 'transparent', color: '#0A0A0A' }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label style={{ display: 'block', fontFamily: 'var(--nb-font)', fontWeight: 800, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#0A0A0A', marginBottom: 6 }}>
              Comment
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Tell us what you think or suggest new features…"
              rows={4}
              style={{
                width: '100%',
                resize: 'none',
                fontFamily: 'var(--nb-font)',
                fontSize: 14,
                color: '#0A0A0A',
                background: '#FFFFFF',
                border: '3px solid #0A0A0A',
                borderRadius: 8,
                padding: '10px 12px',
                boxShadow: '3px 3px 0px #0A0A0A',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <NbBtn type="submit" disabled={!comment.trim()} color="#FF6B6B">
            <Send size={16} strokeWidth={3} />
            SUBMIT FEEDBACK
          </NbBtn>
        </form>
      )}
    </NbModal>
  )
}

// ─── History Modal ────────────────────────────────────────────────────────────
export function HistoryModal({
  isOpen,
  onClose,
  history,
  onSelectHistory,
}: {
  isOpen: boolean
  onClose: () => void
  history: GenerationState[]
  onSelectHistory: (gen: GenerationState) => void
}) {
  if (!isOpen) return null

  return (
    <NbModal onClose={onClose} maxWidth={580} accentColor="#9B5DE5">
      <ModalHeading icon={<HistoryIcon size={18} strokeWidth={3} color="#0A0A0A" />}>
        Conversion History
      </ModalHeading>

      <div style={{ maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, scrollbarWidth: 'none', paddingRight: 2 }}>
        {history.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '32px 16px',
            border: '3px dashed #0A0A0A', borderRadius: 10,
          }}>
            <p style={{ margin: 0, fontFamily: 'var(--nb-font)', fontWeight: 700, fontSize: 14, color: '#0A0A0A', opacity: 0.5 }}>
              No conversions yet. Create your first comic!
            </p>
          </div>
        ) : (
          history.map((gen, idx) => (
            <button
              key={idx}
              onClick={() => { onSelectHistory(gen); onClose() }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px',
                background: '#FFFFFF',
                border: '3px solid #0A0A0A',
                borderRadius: 10,
                boxShadow: '3px 3px 0px #0A0A0A',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'var(--nb-font)',
                transition: 'all 0.08s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translate(-2px,-2px)'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '5px 5px 0px #0A0A0A'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translate(0,0)'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '3px 3px 0px #0A0A0A'
              }}
            >
              <div style={{
                width: 64, height: 64,
                flexShrink: 0,
                border: '3px solid #0A0A0A',
                borderRadius: 8,
                overflow: 'hidden',
                background: '#F0EBD8',
              }}>
                {gen.cards[0]?.imageUrl ? (
                  <img src={gen.cards[0].imageUrl} alt="Comic" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#0A0A0A', opacity: 0.4 }}>
                    Comic
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ margin: '0 0 3px', fontWeight: 800, fontSize: 14, color: '#0A0A0A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {gen.cards[0]?.headline || `Comic Issue #${history.length - idx}`}
                </h4>
                <p style={{ margin: '0 0 5px', fontSize: 12, color: '#0A0A0A', opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {gen.cards[0]?.brief1 || 'Generated AI Comic Strip'}
                </p>
                <span style={{
                  display: 'inline-block',
                  fontWeight: 800, fontSize: 10, color: '#0A0A0A',
                  background: '#FFE66D',
                  border: '2px solid #0A0A0A',
                  borderRadius: 4,
                  padding: '1px 7px',
                }}>
                  {gen.cards.length} PANELS
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </NbModal>
  )
}

// ─── About Modal ──────────────────────────────────────────────────────────────
export function AboutModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null

  return (
    <NbModal onClose={onClose} maxWidth={480} accentColor="#4361EE">
      <div style={{ textAlign: 'center' }}>
        {/* Logo */}
        <div style={{
          width: 72, height: 72,
          background: '#0A0A0A',
          border: '3px solid #0A0A0A',
          borderRadius: 16,
          boxShadow: '5px 5px 0px #4361EE',
          overflow: 'hidden',
          margin: '0 auto 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <img src="/comicGEN favicon.png" alt="ComicGen Logo" style={{ width: '90%', height: '90%', objectFit: 'contain' }} />
        </div>

        <h3 style={{ margin: '0 0 4px', fontFamily: 'var(--nb-font)', fontWeight: 900, fontSize: 26, color: '#0A0A0A', letterSpacing: '-0.5px' }}>
          Comic<span style={{ color: '#4361EE' }}>Gen</span>
        </h3>
        <div style={{
          display: 'inline-block',
          fontFamily: 'var(--nb-font)', fontWeight: 800, fontSize: 11, color: '#0A0A0A',
          letterSpacing: '0.12em', textTransform: 'uppercase',
          background: '#FFE66D', border: '2px solid #0A0A0A',
          borderRadius: 4, padding: '3px 10px', marginBottom: 20,
        }}>
          AI News → Comic Converter
        </div>

        <p style={{ margin: '0 0 24px', fontFamily: 'var(--nb-font)', fontSize: 14, lineHeight: 1.7, color: '#0A0A0A', opacity: 0.75, textAlign: 'left' }}>
          ComicGen transforms any news article or narrative into vivid, multi-panel AI comic strips powered by{' '}
          <strong>Google Gemini AI</strong>, <strong>NVIDIA FLUX</strong> diffusion models, and{' '}
          <strong>Sarvam AI</strong> multilingual translation.
        </p>

        {/* Tech stack badges */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 24 }}>
          {['Gemini AI', 'NVIDIA FLUX', 'Sarvam AI', 'React + Vite'].map(tech => (
            <span key={tech} style={{
              fontFamily: 'var(--nb-font)', fontWeight: 800, fontSize: 11,
              background: '#FFFFFF', color: '#0A0A0A',
              border: '2px solid #0A0A0A', borderRadius: 4,
              padding: '3px 8px',
              boxShadow: '2px 2px 0px #0A0A0A',
            }}>
              {tech}
            </span>
          ))}
        </div>

        <NbBtn onClick={onClose} color="#4361EE" textColor="#FFFFFF">
          GOT IT! ✓
        </NbBtn>
      </div>
    </NbModal>
  )
}

'use client'

import { motion } from 'framer-motion'
import { LayoutGrid, MessageCircle, Plus } from 'lucide-react'

interface LeftVerticalBarProps {
  isNewComicPanelOpen: boolean
  onToggleNewComicPanel: () => void
  onOpenLayoutBuilder: () => void
  onOpenFeedback: () => void
}

export function LeftVerticalBar({
  isNewComicPanelOpen,
  onToggleNewComicPanel,
  onOpenLayoutBuilder,
  onOpenFeedback,
}: LeftVerticalBarProps) {
  return (
    <motion.div
      initial={{ x: -80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.1 }}
      style={{
        position: 'sticky',
        top: 0,
        height: '100vh',
        width: 80, // w-20 equivalent
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 0',
        gap: 16,
        background: '#FFFBF0',
        borderRight: '4px solid #0A0A0A',
      }}
    >
      {/* ─── PLUS: New Comic ─── */}
      <BarButton
        id="nb-new-comic-btn"
        label="New Comic"
        color={isNewComicPanelOpen ? '#0A0A0A' : '#FFE66D'}
        textColor={isNewComicPanelOpen ? '#FFE66D' : '#0A0A0A'}
        onClick={onToggleNewComicPanel}
        title="New Comic"
      >
        <Plus
          size={22}
          strokeWidth={3}
          color={isNewComicPanelOpen ? '#FFE66D' : '#0A0A0A'}
        />
      </BarButton>

      {/* Divider */}
      <div style={{ width: 32, height: 3, background: '#0A0A0A', borderRadius: 2 }} />

      {/* ─── L: Layout Builder ─── */}
      <BarButton
        id="nb-layout-btn"
        label="Layout"
        color="#4361EE"
        textColor="#FFFFFF"
        onClick={onOpenLayoutBuilder}
        title="Layout Builder"
      >
        <LayoutGrid size={20} strokeWidth={2.5} color="#FFFFFF" />
      </BarButton>

      {/* ─── F: Feedback ─── */}
      <BarButton
        id="nb-feedback-btn"
        label="Feedback"
        color="#FF6B6B"
        textColor="#FFFFFF"
        onClick={onOpenFeedback}
        title="Feedback"
      >
        <MessageCircle size={20} strokeWidth={2.5} color="#FFFFFF" />
      </BarButton>
    </motion.div>
  )
}

// ─── Individual Bar Button ────────────────────────────────────────────────────
function BarButton({
  id,
  label,
  color,
  textColor,
  onClick,
  title,
  children,
}: {
  id: string
  label: string
  color: string
  textColor: string
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      id={id}
      title={title}
      onClick={onClick}
      style={{
        width: 46,
        height: 46,
        background: color,
        border: '3px solid #0A0A0A',
        borderRadius: 10,
        boxShadow: '4px 4px 0px #0A0A0A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'transform 0.08s ease, box-shadow 0.08s ease',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.transform = 'translate(-2px, -2px)'
        el.style.boxShadow = '6px 6px 0px #0A0A0A'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.transform = 'translate(0, 0)'
        el.style.boxShadow = '4px 4px 0px #0A0A0A'
      }}
      onMouseDown={(e) => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.transform = 'translate(3px, 3px)'
        el.style.boxShadow = 'none'
      }}
      onMouseUp={(e) => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.transform = 'translate(-2px, -2px)'
        el.style.boxShadow = '6px 6px 0px #0A0A0A'
      }}
    >
      {children}
    </button>
  )
}

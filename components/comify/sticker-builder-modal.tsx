'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  X,
  Sparkles,
  Upload,
  Paintbrush,
  Download,
  Copy,
  Share2,
  Check,
  RotateCcw,
  Trash2,
  Sliders,
  Type,
  ImageIcon,
  FolderHeart,
  Palette
} from 'lucide-react'

interface StickerItem {
  id: string
  name: string
  imageUrl: string
  timestamp: number
  style?: string
}

interface StickerBuilderModalProps {
  isOpen: boolean
  onClose: () => void
  onSaveSticker?: (sticker: StickerItem) => void
}

export function StickerBuilderModal({ isOpen, onClose, onSaveSticker }: StickerBuilderModalProps) {
  const [activeTab, setActiveTab] = useState<'text' | 'upload' | 'slate'>('text')

  // ── Tab 1: Text-to-Sticker state ──
  const [promptText, setPromptText] = useState('')
  const [selectedStyle, setSelectedStyle] = useState<string>('3D Sticker')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedStickerUrl, setGeneratedStickerUrl] = useState<string | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)

  // ── Tab 2: Upload state ──
  const [uploadedImageSrc, setUploadedImageSrc] = useState<string | null>(null)
  const [borderWidth, setBorderWidth] = useState<number>(10)
  const [borderColor, setBorderColor] = useState<string>('#ffffff')

  // ── Tab 3: White Slate Canvas state ──
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [tool, setTool] = useState<'pen' | 'pencil' | 'marker' | 'sketchpen' | 'eraser'>('pen')
  const [drawColor, setDrawColor] = useState<string>('#00bda1')
  const [brushSize, setBrushSize] = useState<number>(6)
  const [isDrawing, setIsDrawing] = useState(false)
  const [history, setHistory] = useState<ImageData[]>([])

  // ── Action states ──
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeResultUrl, setActiveResultUrl] = useState<string | null>(null)

  // Clear states when modal opens
  useEffect(() => {
    if (isOpen && activeTab === 'slate' && canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
    }
  }, [isOpen, activeTab])

  if (!isOpen) return null

  // ── Handlers for Tab 1: Text to Sticker ──
  const handleGenerateTextSticker = async () => {
    if (!promptText.trim() || isGenerating) return
    setIsGenerating(true)
    setGenerateError(null)

    try {
      const res = await fetch('/.netlify/functions/generateImage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `die-cut sticker of ${promptText}`, style: selectedStyle }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(err.error || 'Failed to generate sticker')
      }
      const data = await res.json()
      if (!data.image) throw new Error('No image returned')
      
      const imgUrl = data.image.startsWith('data:') ? data.image : `data:image/png;base64,${data.image}`
      setGeneratedStickerUrl(imgUrl)
      setActiveResultUrl(imgUrl)
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setIsGenerating(false)
    }
  }

  // ── Handlers for Tab 2: Upload Extractor ──
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      if (evt.target?.result) {
        const src = evt.target.result as string
        setUploadedImageSrc(src)
        setActiveResultUrl(src)
      }
    }
    reader.readAsDataURL(file)
  }

  // Paste from clipboard handler
  const handlePasteImage = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read()
      for (const item of clipboardItems) {
        const imageType = item.types.find((t) => t.startsWith('image/'))
        if (imageType) {
          const blob = await item.getType(imageType)
          const reader = new FileReader()
          reader.onload = (evt) => {
            if (evt.target?.result) {
              const src = evt.target.result as string
              setUploadedImageSrc(src)
              setActiveResultUrl(src)
              setActiveTab('upload')
            }
          }
          reader.readAsDataURL(blob)
          break
        }
      }
    } catch (err) {
      console.warn('Clipboard read failed:', err)
    }
  }

  // ── Handlers for Tab 3: White Slate Canvas ──
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Save history state
    setHistory((prev) => [...prev.slice(-10), ctx.getImageData(0, 0, canvas.width, canvas.height)])

    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const x = clientX - rect.left
    const y = clientY - rect.top

    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const x = clientX - rect.left
    const y = clientY - rect.top

    // Configure tool strokes
    if (tool === 'eraser') {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = brushSize * 2
      ctx.globalAlpha = 1.0
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    } else if (tool === 'pencil') {
      ctx.strokeStyle = drawColor
      ctx.lineWidth = Math.max(1, brushSize * 0.5)
      ctx.globalAlpha = 0.8
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    } else if (tool === 'marker') {
      ctx.strokeStyle = drawColor
      ctx.lineWidth = brushSize * 1.8
      ctx.globalAlpha = 0.5
      ctx.lineCap = 'square'
      ctx.lineJoin = 'miter'
    } else if (tool === 'sketchpen') {
      ctx.strokeStyle = drawColor
      ctx.lineWidth = brushSize * 1.2
      ctx.globalAlpha = 1.0
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    } else {
      // Pen
      ctx.strokeStyle = drawColor
      ctx.lineWidth = brushSize
      ctx.globalAlpha = 1.0
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    }

    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const handleClearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHistory([])
  }

  const handleUndoCanvas = () => {
    if (history.length === 0) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const previousState = history[history.length - 1]
    ctx.putImageData(previousState, 0, 0)
    setHistory((prev) => prev.slice(0, -1))
  }

  const handleExtractSlateSticker = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    setActiveResultUrl(dataUrl)
  }

  // ── Universal Actions ──
  const handleSaveToLibrary = () => {
    if (!activeResultUrl) return
    const newSticker: StickerItem = {
      id: `sticker-${Date.now()}`,
      name: promptText || 'Custom Sticker',
      imageUrl: activeResultUrl,
      timestamp: Date.now(),
      style: selectedStyle,
    }

    const stored = localStorage.getItem('comicgen_stickers')
    const list: StickerItem[] = stored ? JSON.parse(stored) : []
    const updated = [newSticker, ...list]
    localStorage.setItem('comicgen_stickers', JSON.stringify(updated))

    if (onSaveSticker) onSaveSticker(newSticker)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleDownloadPNG = () => {
    if (!activeResultUrl) return
    const a = document.createElement('a')
    a.href = activeResultUrl
    a.download = `comicgen-sticker-${Date.now()}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleCopyImage = async () => {
    if (!activeResultUrl) return
    try {
      const response = await fetch(activeResultUrl)
      const blob = await response.blob()
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Clipboard copy failed:', err)
      alert('Unable to copy directly to clipboard. You can download the sticker PNG!')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] border-2 border-[#34e0c4]/40 bg-[#071926] text-white shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#34e0c4]/20 text-[#34e0c4]">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Sticker Builder</h2>
              <p className="text-[12px] text-[#7fa8d8]">Create 3D, Disney & Custom Drawn Stickers</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-white/10 bg-[#051421] px-6">
          <button
            onClick={() => setActiveTab('text')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-[14px] font-extrabold transition-all ${
              activeTab === 'text'
                ? 'border-[#34e0c4] text-[#34e0c4]'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Type className="h-4 w-4" />
            <span>AI Text-to-Sticker</span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-[14px] font-extrabold transition-all ${
              activeTab === 'upload'
                ? 'border-[#34e0c4] text-[#34e0c4]'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <ImageIcon className="h-4 w-4" />
            <span>Upload / Paste Image</span>
          </button>

          <button
            onClick={() => setActiveTab('slate')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-[14px] font-extrabold transition-all ${
              activeTab === 'slate'
                ? 'border-[#34e0c4] text-[#34e0c4]'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Paintbrush className="h-4 w-4" />
            <span>White Slate Drawing</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* TAB 1: TEXT-TO-STICKER */}
          {activeTab === 'text' && (
            <div className="flex flex-col gap-5">
              <div>
                <label className="mb-2 block text-[13px] font-bold text-[#34e0c4]">
                  Describe Your Sticker:
                </label>
                <textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="e.g. A cute dog waving, a rocket ship taking off, Phineas building a gadget..."
                  className="w-full resize-none rounded-[16px] border border-[#34e0c4]/30 bg-[#03131c] p-3 text-[14px] text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#34e0c4]"
                  rows={3}
                />
              </div>

              <div>
                <label className="mb-2 block text-[13px] font-bold text-[#34e0c4]">
                  Sticker Art Style:
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { id: '3D Sticker', label: '🎨 3D Render', desc: 'Claymation pop art' },
                    { id: 'Disney / Phineas and Ferb Sticker', label: '🏰 Disney (Phineas & Ferb)', desc: '2D cartoon vector style' },
                    { id: 'Manga style', label: '⛩️ Manga Anime', desc: 'Japanese shonen style' },
                    { id: 'Watercolor style', label: '🖌️ Watercolor', desc: 'Pastel expressive wash' },
                  ].map((st) => (
                    <button
                      key={st.id}
                      onClick={() => setSelectedStyle(st.id)}
                      className={`flex flex-col items-start rounded-[12px] border p-3 text-left transition-all ${
                        selectedStyle === st.id
                          ? 'border-[#34e0c4] bg-[#34e0c4]/20 text-white'
                          : 'border-white/10 bg-[#051421] text-white/70 hover:border-white/30'
                      }`}
                    >
                      <span className="text-[13px] font-extrabold">{st.label}</span>
                      <span className="text-[10px] opacity-75">{st.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerateTextSticker}
                disabled={isGenerating || !promptText.trim()}
                className="flex items-center justify-center gap-2 rounded-full bg-[#34e0c4] py-3.5 text-[15px] font-extrabold text-[#03131c] shadow-lg hover:scale-[1.02] disabled:opacity-50 transition-all"
              >
                <Sparkles className="h-5 w-5" />
                <span>{isGenerating ? 'Generating AI Sticker...' : 'Generate Sticker'}</span>
              </button>

              {generateError && (
                <div className="rounded-[12px] bg-red-500/20 border border-red-500/40 p-3 text-[13px] text-red-300">
                  {generateError}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: UPLOAD / PASTE IMAGE */}
          {activeTab === 'upload' && (
            <div className="flex flex-col items-center gap-5 text-center">
              <div className="flex flex-col items-center justify-center w-full min-h-[200px] border-2 border-dashed border-[#34e0c4]/40 rounded-[20px] bg-[#03131c] p-6">
                <Upload className="h-10 w-10 text-[#34e0c4] mb-3" />
                <p className="text-[15px] font-extrabold text-white mb-1">Drag & Drop Image or Click to Upload</p>
                <p className="text-[12px] text-white/50 mb-4">Supports PNG, JPEG, WebP</p>

                <div className="flex items-center gap-3">
                  <label className="cursor-pointer rounded-full bg-[#34e0c4] px-5 py-2.5 text-[14px] font-extrabold text-[#03131c] shadow-md hover:scale-105 transition-all">
                    <span>Choose File</span>
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>

                  <button
                    onClick={handlePasteImage}
                    className="flex items-center gap-2 rounded-full bg-[#0b263b] border border-[#34e0c4]/40 px-5 py-2.5 text-[14px] font-bold text-[#34e0c4] hover:bg-[#123550] transition-all"
                  >
                    <Copy className="h-4 w-4" />
                    <span>Paste Clipboard</span>
                  </button>
                </div>
              </div>

              {uploadedImageSrc && (
                <div className="w-full flex flex-col items-center gap-3 bg-[#051421] p-4 rounded-[16px] border border-white/10">
                  <label className="text-[13px] font-bold text-[#34e0c4]">Sticker Outline Width ({borderWidth}px):</label>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    value={borderWidth}
                    onChange={(e) => setBorderWidth(Number(e.target.value))}
                    className="w-64 accent-[#34e0c4]"
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 3: WHITE SLATE DRAWING */}
          {activeTab === 'slate' && (
            <div className="flex flex-col gap-4">
              
              {/* Slate Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#051421] p-3 rounded-[16px] border border-white/10">
                {/* Tools */}
                <div className="flex items-center gap-1.5">
                  {[
                    { id: 'pen', label: '🖊️ Pen' },
                    { id: 'pencil', label: '✏️ Pencil' },
                    { id: 'marker', label: '🖍️ Marker' },
                    { id: 'sketchpen', label: '🖌️ Sketch' },
                    { id: 'eraser', label: '🧽 Eraser' },
                  ].map((tl) => (
                    <button
                      key={tl.id}
                      onClick={() => setTool(tl.id as any)}
                      className={`rounded-full px-3 py-1.5 text-[12px] font-extrabold transition-all ${
                        tool === tl.id
                          ? 'bg-[#34e0c4] text-[#03131c]'
                          : 'bg-[#0b263b] text-white/70 hover:text-white'
                      }`}
                    >
                      {tl.label}
                    </button>
                  ))}
                </div>

                {/* Color Palette */}
                <div className="flex items-center gap-1.5">
                  {['#00bda1', '#ff007c', '#ffd000', '#00d2ff', '#ff5722', '#000000', '#ffffff'].map((col) => (
                    <button
                      key={col}
                      onClick={() => setDrawColor(col)}
                      style={{ backgroundColor: col }}
                      className={`h-6 w-6 rounded-full border-2 ${
                        drawColor === col ? 'border-white scale-110' : 'border-transparent'
                      }`}
                    />
                  ))}
                  <input
                    type="color"
                    value={drawColor}
                    onChange={(e) => setDrawColor(e.target.value)}
                    className="h-6 w-6 cursor-pointer rounded-full bg-transparent border-none"
                  />
                </div>

                {/* Brush size & Undo/Clear */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/60">Size:</span>
                  <input
                    type="range"
                    min="2"
                    max="30"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-20 accent-[#34e0c4]"
                  />

                  <button
                    onClick={handleUndoCanvas}
                    className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
                    title="Undo"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleClearCanvas}
                    className="p-1.5 rounded-full bg-red-500/20 text-red-300 hover:bg-red-500/30"
                    title="Clear Canvas"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Drawing Canvas */}
              <div className="flex justify-center">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={340}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="cursor-crosshair rounded-[16px] border-4 border-[#34e0c4]/40 bg-white shadow-xl touch-none"
                />
              </div>

              <div className="flex justify-center">
                <button
                  onClick={handleExtractSlateSticker}
                  className="flex items-center gap-2 rounded-full bg-[#34e0c4] px-6 py-2.5 text-[14px] font-extrabold text-[#03131c] shadow-lg hover:scale-105 transition-all"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Convert Drawing to Sticker</span>
                </button>
              </div>
            </div>
          )}

          {/* RESULT PREVIEW & ACTION BUTTONS */}
          {activeResultUrl && (
            <div className="mt-6 flex flex-col items-center gap-4 border-t border-white/10 pt-5">
              <div className="text-[13px] font-extrabold uppercase tracking-wider text-[#34e0c4]">
                Sticker Preview
              </div>

              <div
                style={{
                  boxShadow: `0 0 0 ${borderWidth}px ${borderColor}, 0 10px 30px rgba(0,0,0,0.5)`,
                }}
                className="relative flex items-center justify-center p-3 rounded-[20px] bg-transparent max-w-[260px] max-h-[260px]"
              >
                <img
                  src={activeResultUrl}
                  alt="Sticker Preview"
                  className="max-h-[220px] max-w-[220px] object-contain"
                />
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                <button
                  onClick={handleSaveToLibrary}
                  className="flex items-center gap-2 rounded-full bg-[#34e0c4] px-5 py-2.5 text-[13px] font-extrabold text-[#03131c] shadow-md hover:scale-105 transition-all"
                >
                  {saved ? <Check className="h-4 w-4" /> : <FolderHeart className="h-4 w-4" />}
                  <span>{saved ? 'Saved to Library!' : 'Save to Library'}</span>
                </button>

                <button
                  onClick={handleCopyImage}
                  className="flex items-center gap-2 rounded-full bg-[#0b263b] border border-[#34e0c4]/40 px-5 py-2.5 text-[13px] font-bold text-[#34e0c4] hover:bg-[#123550] transition-all"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span>{copied ? 'Copied Image!' : 'Copy Sticker'}</span>
                </button>

                <button
                  onClick={handleDownloadPNG}
                  className="flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-[13px] font-bold text-white hover:bg-white/20 transition-all"
                >
                  <Download className="h-4 w-4" />
                  <span>Download PNG</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

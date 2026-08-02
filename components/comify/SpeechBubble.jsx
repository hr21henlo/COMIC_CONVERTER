import React from 'react'

export function SpeechBubble({
  text,
  className = '',
  style = {}
}) {
  if (!text) return null

  return (
    <div
      className={`relative inline-block bg-white border-2 border-black rounded-xl px-2.5 py-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] z-20 max-w-[70%] ${className}`}
      style={style}
    >
      {/* Speech Text */}
      <p className="font-['Bebas_Neue'] tracking-wider text-xs sm:text-sm leading-tight uppercase font-bold text-black m-0 select-none line-clamp-3" style={{ fontFamily: "'Bebas Neue', 'Comic Neue', cursive, sans-serif" }}>
        "{text}"
      </p>

      {/* Clean White Triangle Pointer Tail with Black Outline */}
      <div
        className="absolute -bottom-[10px] left-5 w-0 h-0"
        style={{
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: '10px solid #000000',
        }}
      />
      <div
        className="absolute -bottom-[7px] left-[21px] w-0 h-0"
        style={{
          borderLeft: '7px solid transparent',
          borderRight: '7px solid transparent',
          borderTop: '8px solid #FFFFFF',
        }}
      />
    </div>
  )
}

export default SpeechBubble

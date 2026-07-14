import { useRef, useState } from 'react'

// Drag-to-reorder for a photo grid, touch + mouse via Pointer Events (iOS Safari
// has no reliable HTML5 drag-and-drop). Live-shuffles the list as you drag over
// another tile. `setList` receives an updater. `idOf` extracts a stable id.
//
// Usage on each tile:
//   <div ref={reg(item.id)} {...tileProps(item.id)} style={{ ...tileStyle(item.id) }}>
// and put onPointerDown={stop} on any inner buttons so taps don't start a drag.
export function usePhotoDrag(setList, idOf = (x) => x.id) {
  const [dragId, setDragId] = useState(null)
  const tiles = useRef(new Map())      // id -> element
  const start = useRef(null)           // { id, x, y, active }

  const reg = (id) => (el) => { if (el) tiles.current.set(id, el); else tiles.current.delete(id) }

  const overId = (x, y) => {
    for (const [id, el] of tiles.current) {
      const r = el.getBoundingClientRect()
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return id
    }
    return null
  }

  const move = (fromId, toId) => setList(list => {
    const from = list.findIndex(i => idOf(i) === fromId)
    const to = list.findIndex(i => idOf(i) === toId)
    if (from < 0 || to < 0 || from === to) return list
    const next = list.slice()
    const [m] = next.splice(from, 1)
    next.splice(to, 0, m)
    return next
  })

  const tileProps = (id) => ({
    onPointerDown: (e) => {
      // ignore secondary buttons; let inner buttons stopPropagation
      if (e.button && e.button !== 0) return
      start.current = { id, x: e.clientX, y: e.clientY, active: false }
      try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* ignore */ }
    },
    onPointerMove: (e) => {
      const s = start.current
      if (!s || s.id !== id) return
      if (!s.active) {
        if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < 8) return  // movement threshold
        s.active = true
        setDragId(s.id)
      }
      const over = overId(e.clientX, e.clientY)
      if (over != null && over !== s.id) move(s.id, over)
    },
    onPointerUp: () => { start.current = null; setDragId(null) },
    onPointerCancel: () => { start.current = null; setDragId(null) },
  })

  const stop = (e) => e.stopPropagation()  // for inner buttons

  return { dragId, reg, tileProps, stop }
}

import { useEffect, useRef, useState } from 'react'
import ProjectCard from './ProjectCard'

const CARD_HEIGHT = 320
const ROW_GAP = 24
const ROW_STEP = CARD_HEIGHT + ROW_GAP
const OVERSCAN_ROWS = 2

function getColumnCount(width) {
  if (width >= 1280) return 4
  if (width >= 1024) return 3
  return 2
}

export default function VirtualizedProjectGrid({ projects, onSelect }) {
  const gridRef = useRef(null)
  const [viewport, setViewport] = useState(() => ({
    scrollY: window.scrollY,
    height: window.innerHeight,
    width: window.innerWidth,
    gridTop: 0,
  }))

  useEffect(() => {
    let frame = 0
    const updateViewport = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        const gridTop = gridRef.current
          ? gridRef.current.getBoundingClientRect().top + window.scrollY
          : 0
        setViewport((current) => {
          const next = {
            scrollY: window.scrollY,
            height: window.innerHeight,
            width: window.innerWidth,
            gridTop,
          }
          const sameScrollWindow =
            Math.floor((current.scrollY - current.gridTop) / ROW_STEP) ===
            Math.floor((next.scrollY - next.gridTop) / ROW_STEP)
          if (
            sameScrollWindow &&
            current.height === next.height &&
            current.width === next.width &&
            current.gridTop === next.gridTop
          ) {
            return current
          }
          return next
        })
      })
    }

    window.addEventListener('scroll', updateViewport, { passive: true })
    window.addEventListener('resize', updateViewport)
    updateViewport()
    return () => {
      window.removeEventListener('scroll', updateViewport)
      window.removeEventListener('resize', updateViewport)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  const columns = getColumnCount(viewport.width)
  const rowCount = Math.ceil(projects.length / columns)
  const firstVisibleRow = Math.max(
    0,
    Math.floor((viewport.scrollY - viewport.gridTop) / ROW_STEP),
  )
  const startRow = Math.max(0, firstVisibleRow - OVERSCAN_ROWS)
  const visibleRowCount =
    Math.ceil(viewport.height / ROW_STEP) + OVERSCAN_ROWS * 2
  const endRow = Math.min(rowCount, startRow + visibleRowCount)
  const visibleProjects = projects.slice(startRow * columns, endRow * columns)
  const spacerHeight = Math.max(0, rowCount * ROW_STEP - ROW_GAP)

  return (
    <div
      ref={gridRef}
      className="relative"
      style={{ height: spacerHeight }}
    >
      <div
        className="absolute inset-x-0 grid gap-6"
        style={{
          top: startRow * ROW_STEP,
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridAutoRows: `${CARD_HEIGHT}px`,
        }}
      >
        {visibleProjects.map((project) => (
          <div key={project.id} className="project-card min-w-0">
            <ProjectCard
              project={project}
              onHire={onSelect}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

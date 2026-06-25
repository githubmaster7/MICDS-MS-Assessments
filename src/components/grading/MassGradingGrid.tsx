'use client'

import { useState, useRef } from 'react'

export interface Rotation {
  id: string
  activityName: string
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'LOCKED'
  startDate: string | null
  endDate: string | null
  rotationNumber?: number
}

export interface StudentRow {
  id: string
  firstName: string
  lastName: string
  currentGrade: string | null
  standard1Score: number | null
  standard2Score: number | null
  standard3Score: number | null
  standard4Score: number | null
  gradesByRotation: Record<string, string | null>
}

interface MassGradingGridProps {
  rotations: Rotation[]
  students: StudentRow[]
  onQuickGrade?: (studentId: string, rotationId: string) => void
}

const GRADE_CELL_COLORS: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-800 font-bold',
  'A-': 'bg-emerald-50 text-emerald-700 font-bold',
  'B+': 'bg-blue-100 text-blue-800 font-bold',
  B: 'bg-blue-50 text-blue-700 font-bold',
  'B-': 'bg-blue-50 text-blue-600',
  'C+': 'bg-amber-100 text-amber-800',
  C: 'bg-amber-50 text-amber-700',
  'C-': 'bg-orange-50 text-orange-700',
  'D+': 'bg-orange-100 text-orange-800',
  D: 'bg-red-100 text-red-700',
  'D-': 'bg-red-100 text-red-800',
  F: 'bg-red-200 text-red-900 font-bold',
}

const STATUS_HEADER: Record<string, string> = {
  UPCOMING: 'bg-slate-50 text-slate-400',
  ACTIVE: 'bg-blue-50 text-blue-700 border-blue-200',
  COMPLETED: 'bg-slate-50 text-slate-600',
  LOCKED: 'bg-slate-100 text-slate-500',
}

export function MassGradingGrid({ rotations, students, onQuickGrade }: MassGradingGridProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [hoveredRotation, setHoveredRotation] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === students.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(students.map((s) => s.id)))
    }
  }

  const allSelected = selected.size === students.length && students.length > 0
  const someSelected = selected.size > 0 && selected.size < students.length

  return (
    <div className="flex flex-col gap-3">
      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-4">
          <span className="text-sm text-blue-800 font-medium">{selected.size} student{selected.size !== 1 ? 's' : ''} selected</span>
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Clear
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 text-xs text-slate-500 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-200" />
          Active (current)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-slate-100 border border-slate-200" />
          Completed / Locked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-white border border-slate-200" />
          Upcoming (N/A)
        </span>
      </div>

      {/* Grid */}
      <div ref={containerRef} className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="text-xs border-collapse w-max min-w-full">
          <thead>
            <tr>
              {/* Checkbox col */}
              <th className="sticky left-0 z-20 bg-slate-100 border-b border-r border-slate-200 px-3 py-2 w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected }}
                  onChange={toggleAll}
                  className="accent-blue-600 w-3.5 h-3.5"
                  aria-label="Select all"
                />
              </th>
              {/* Name col */}
              <th className="sticky left-8 z-20 bg-slate-100 border-b border-r border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 min-w-[160px] whitespace-nowrap">
                Student
              </th>
              {/* Current grade col */}
              <th className="sticky left-[200px] z-20 bg-slate-100 border-b border-r-2 border-slate-300 px-3 py-2 text-center font-semibold text-slate-600 whitespace-nowrap min-w-[60px]">
                Overall
              </th>
              {/* Rotation columns */}
              {rotations.map((rot) => (
                <th
                  key={rot.id}
                  onMouseEnter={() => setHoveredRotation(rot.id)}
                  onMouseLeave={() => setHoveredRotation(null)}
                  className={`border-b border-r border-slate-200 px-2 py-2 text-center font-medium min-w-[90px] whitespace-nowrap transition-colors ${STATUS_HEADER[rot.status] ?? 'bg-slate-50 text-slate-500'} ${hoveredRotation === rot.id ? 'bg-blue-50' : ''}`}
                >
                  <div className="text-[11px] font-semibold leading-tight">{rot.activityName}</div>
                  <div className="text-[10px] font-normal mt-0.5 opacity-70">
                    {rot.status === 'UPCOMING' ? 'Upcoming' :
                     rot.status === 'ACTIVE' ? '▶ Active' :
                     rot.status === 'LOCKED' ? '🔒 Locked' : 'Done'}
                  </div>
                  {rot.startDate && (
                    <div className="text-[9px] font-normal opacity-50 mt-0.5">
                      {new Date(rot.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((student, rowIdx) => {
              const isSelected = selected.has(student.id)
              return (
                <tr
                  key={student.id}
                  className={`group transition-colors ${isSelected ? 'bg-blue-50' : rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/60`}
                >
                  {/* Checkbox */}
                  <td className={`sticky left-0 z-10 border-b border-r border-slate-200 px-3 py-2 ${isSelected ? 'bg-blue-50' : rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(student.id)}
                      className="accent-blue-600 w-3.5 h-3.5"
                      aria-label={`Select ${student.firstName} ${student.lastName}`}
                    />
                  </td>
                  {/* Name */}
                  <td className={`sticky left-8 z-10 border-b border-r border-slate-200 px-3 py-2 font-medium text-slate-900 whitespace-nowrap ${isSelected ? 'bg-blue-50' : rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                    <div>{student.firstName} {student.lastName}</div>
                    {/* Mini standard scores */}
                    <div className="flex gap-1 mt-0.5">
                      {[student.standard1Score, student.standard2Score, student.standard3Score, student.standard4Score].map((sc, i) => (
                        <span key={i} className="text-[9px] text-slate-400 tabular-nums">
                          S{i + 1}:{sc ?? '—'}
                        </span>
                      ))}
                    </div>
                  </td>
                  {/* Overall grade */}
                  <td className={`sticky left-[200px] z-10 border-b border-r-2 border-slate-300 px-3 py-2 text-center ${isSelected ? 'bg-blue-50' : rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                    {student.currentGrade ? (
                      <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${GRADE_CELL_COLORS[student.currentGrade] ?? 'text-slate-600'}`}>
                        {student.currentGrade}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  {/* Rotation cells */}
                  {rotations.map((rot) => {
                    const grade = student.gradesByRotation[rot.id]
                    const isUpcoming = rot.status === 'UPCOMING'
                    const isActive = rot.status === 'ACTIVE'
                    const isLocked = rot.status === 'LOCKED' || rot.status === 'COMPLETED'
                    const isHovered = hoveredRotation === rot.id

                    return (
                      <td
                        key={rot.id}
                        className={`border-b border-r border-slate-200 px-2 py-2 text-center transition-colors ${
                          isActive ? 'bg-blue-50/50' : isUpcoming ? '' : 'bg-slate-50/30'
                        } ${isHovered ? 'bg-blue-50/70' : ''}`}
                      >
                        {isUpcoming ? (
                          <span className="text-slate-300 text-[11px]">N/A</span>
                        ) : isLocked ? (
                          grade ? (
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${GRADE_CELL_COLORS[grade] ?? 'text-slate-600'}`}>
                              {grade}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )
                        ) : isActive ? (
                          grade ? (
                            <button
                              onClick={() => onQuickGrade?.(student.id, rot.id)}
                              className={`text-xs font-semibold px-1.5 py-0.5 rounded hover:ring-2 hover:ring-blue-400 transition-all cursor-pointer ${GRADE_CELL_COLORS[grade] ?? 'text-blue-700 bg-blue-100'}`}
                            >
                              {grade}
                            </button>
                          ) : (
                            <button
                              onClick={() => onQuickGrade?.(student.id, rot.id)}
                              className="text-[11px] text-blue-400 hover:text-blue-700 hover:bg-blue-100 px-1.5 py-0.5 rounded transition-colors"
                            >
                              Grade
                            </button>
                          )
                        ) : (
                          <span className="text-slate-300 text-[11px]">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

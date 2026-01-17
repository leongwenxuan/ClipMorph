/**
 * TranscriptHistory Component
 *
 * Displays the last 20 transcripts with clear functionality
 */

import { useState, useEffect } from 'react'
import { isIpcSuccess, TranscriptRecord } from '../../../../packages/contracts/src'
import './TranscriptHistory.css'

interface TranscriptHistoryProps {
  onClose: () => void
}

function TranscriptHistory({ onClose }: TranscriptHistoryProps): JSX.Element {
  const [transcripts, setTranscripts] = useState<TranscriptRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    const fetchTranscripts = async (): Promise<void> => {
      try {
        const response = await window.clipmorph.getTranscripts()
        if (isIpcSuccess(response)) {
          setTranscripts(response.data.transcripts)
        }
      } catch (err) {
        console.error('Failed to fetch transcripts:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchTranscripts()
  }, [])

  const handleClear = async (): Promise<void> => {
    setClearing(true)
    try {
      const response = await window.clipmorph.clearTranscripts()
      if (isIpcSuccess(response)) {
        setTranscripts([])
      }
    } catch (err) {
      console.error('Failed to clear transcripts:', err)
    } finally {
      setClearing(false)
    }
  }

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ' ' +
      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="transcript-overlay">
        <div className="transcript-panel">
          <div className="transcript-loading">Loading transcripts...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="transcript-overlay">
      <div className="transcript-panel">
        <header className="transcript-header">
          <h2>Transcript History</h2>
          <button className="transcript-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="transcript-content">
          {transcripts.length === 0 ? (
            <div className="transcript-empty">
              <span className="empty-icon">📝</span>
              <p>No transcripts yet</p>
              <p className="empty-hint">Use push-to-talk to record voice commands</p>
            </div>
          ) : (
            <ul className="transcript-list">
              {transcripts.map((t) => (
                <li key={t.id} className="transcript-item">
                  <div className="transcript-text">{t.text}</div>
                  <div className="transcript-meta">
                    <span className="transcript-time">{formatTime(t.timestamp)}</span>
                    {t.durationMs && (
                      <span className="transcript-duration">
                        {(t.durationMs / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {transcripts.length > 0 && (
          <footer className="transcript-footer">
            <span className="transcript-count">{transcripts.length} transcript(s)</span>
            <button
              className="clear-btn"
              onClick={handleClear}
              disabled={clearing}
            >
              {clearing ? 'Clearing...' : 'Clear All'}
            </button>
          </footer>
        )}
      </div>
    </div>
  )
}

export default TranscriptHistory

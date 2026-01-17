/**
 * LastAction Component
 *
 * Displays the most recent action result with diagnostic info for failures
 */

import { useState, useEffect } from 'react'
import { isIpcSuccess, LastActionSummary, EventTypes } from '../../../../packages/contracts/src'
import './LastAction.css'

function LastAction(): JSX.Element {
  const [lastAction, setLastAction] = useState<LastActionSummary | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Fetch initial last action
    const fetchLastAction = async (): Promise<void> => {
      try {
        const response = await window.clipmorph.getLastAction()
        if (isIpcSuccess(response) && response.data.action) {
          setLastAction(response.data.action)
          setVisible(true)
        }
      } catch (err) {
        console.error('Failed to fetch last action:', err)
      }
    }

    fetchLastAction()

    // Listen for voice transcript events (which indicate a new action)
    const unsubscribe = window.clipmorph.onEvent((event) => {
      if (event.type === EventTypes.VOICE_TRANSCRIPT) {
        // Re-fetch last action after a short delay (to let it process)
        setTimeout(fetchLastAction, 500)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // Auto-hide after 10 seconds for successful actions
  useEffect(() => {
    if (lastAction?.success && visible) {
      const timer = setTimeout(() => {
        setVisible(false)
      }, 10000)
      return () => clearTimeout(timer)
    }
  }, [lastAction, visible])

  if (!lastAction || !visible) {
    return <></>
  }

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const getCapabilityLabel = (capability: string): string => {
    const labels: Record<string, string> = {
      'url:clean': 'URL Clean',
      'url:markdown': 'URL to Markdown',
      'json:pretty': 'JSON Pretty',
      'json:minify': 'JSON Minify',
      'json:to-yaml': 'JSON to YAML',
      'yaml:to-json': 'YAML to JSON',
      'extract:emails': 'Extract Emails',
      'extract:links': 'Extract Links',
      'redact:secrets': 'Redact Secrets',
      'cancel': 'Cancel',
      'undo': 'Undo',
      'unsupported': 'Unsupported',
    }
    return labels[capability] || capability
  }

  return (
    <div className={`last-action ${lastAction.success ? 'success' : 'failure'}`}>
      <div className="last-action-header">
        <span className="last-action-status">
          {lastAction.success ? '✓' : '✗'}
        </span>
        <span className="last-action-capability">
          {getCapabilityLabel(lastAction.capability)}
        </span>
        <button
          className="last-action-dismiss"
          onClick={() => setVisible(false)}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>

      <div className="last-action-transcript">
        "{lastAction.transcript}"
      </div>

      {!lastAction.success && lastAction.error && (
        <div className="last-action-error">
          <div className="error-label">Error:</div>
          <div className="error-message">{lastAction.error}</div>
        </div>
      )}

      <div className="last-action-meta">
        <span className="last-action-time">{formatTime(lastAction.timestamp)}</span>
        {lastAction.jobId && (
          <span className="last-action-job">Job: {lastAction.jobId.slice(0, 8)}...</span>
        )}
      </div>
    </div>
  )
}

export default LastAction

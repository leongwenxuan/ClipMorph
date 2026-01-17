import { useState, useEffect } from 'react'
import {
  AutomationJob,
  JobStatus as JobStatusType,
  isIpcSuccess,
  EventTypes,
  AutomationStatusPayload,
} from '../../../../packages/contracts/src'
import './JobStatus.css'

interface JobStatusProps {
  onCancel?: (jobId: string) => void
}

function JobStatus({ onCancel }: JobStatusProps): JSX.Element | null {
  const [activeJob, setActiveJob] = useState<AutomationJob | null>(null)
  const [recentJobs, setRecentJobs] = useState<AutomationJob[]>([])
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    // Fetch initial state
    const fetchState = async (): Promise<void> => {
      try {
        const response = await window.clipmorph.getAutomationState()
        if (isIpcSuccess(response)) {
          setActiveJob(response.data.activeJob)
          setRecentJobs(response.data.recentJobs)
        }
      } catch (err) {
        console.error('Failed to fetch automation state:', err)
      }
    }

    fetchState()

    // Subscribe to automation events
    const unsubscribe = window.clipmorph.onEvent((event) => {
      const automationEvents = [
        EventTypes.AUTOMATION_STARTED,
        EventTypes.AUTOMATION_STEP,
        EventTypes.AUTOMATION_COMPLETED,
        EventTypes.AUTOMATION_FAILED,
        EventTypes.AUTOMATION_NEEDS_INPUT,
        EventTypes.AUTOMATION_CANCELLED,
      ]

      if (automationEvents.includes(event.type as (typeof EventTypes)[keyof typeof EventTypes])) {
        const payload = event.payload as AutomationStatusPayload
        if (payload?.job) {
          const job = payload.job

          // Update active job or move to recent
          if (isTerminal(job.status)) {
            setActiveJob((prev) => (prev?.id === job.id ? null : prev))
            setRecentJobs((prev) => {
              const filtered = prev.filter((j) => j.id !== job.id)
              return [job, ...filtered].slice(0, 5)
            })
          } else {
            setActiveJob(job)
          }
        }
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const isTerminal = (status: JobStatusType): boolean => {
    return ['completed', 'failed', 'cancelled'].includes(status)
  }

  const handleCancel = async (): Promise<void> => {
    if (!activeJob) return

    try {
      const response = await window.clipmorph.cancelAutomation(activeJob.id)
      if (isIpcSuccess(response)) {
        onCancel?.(activeJob.id)
      }
    } catch (err) {
      console.error('Failed to cancel job:', err)
    }
  }

  const handleContinue = async (): Promise<void> => {
    if (!activeJob || activeJob.status !== 'needs_input') return

    try {
      await window.clipmorph.provideAutomationInput(activeJob.id, 'continue')
    } catch (err) {
      console.error('Failed to continue job:', err)
    }
  }

  const getStatusIcon = (status: JobStatusType): string => {
    switch (status) {
      case 'pending':
        return '⏳'
      case 'running':
        return '🔄'
      case 'needs_input':
        return '⚠️'
      case 'completed':
        return '✅'
      case 'failed':
        return '❌'
      case 'cancelled':
        return '🚫'
      default:
        return '❓'
    }
  }

  const getStatusColor = (status: JobStatusType): string => {
    switch (status) {
      case 'pending':
        return 'var(--status-pending)'
      case 'running':
        return 'var(--status-running)'
      case 'needs_input':
        return 'var(--status-needs-input)'
      case 'completed':
        return 'var(--status-completed)'
      case 'failed':
        return 'var(--status-failed)'
      case 'cancelled':
        return 'var(--status-cancelled)'
      default:
        return 'var(--text-muted)'
    }
  }

  const formatDuration = (startMs: number, endMs?: number): string => {
    const duration = (endMs ?? Date.now()) - startMs
    if (duration < 1000) return '<1s'
    if (duration < 60000) return `${Math.floor(duration / 1000)}s`
    return `${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s`
  }

  // Don't render if no jobs
  if (!activeJob && recentJobs.length === 0) {
    return null
  }

  return (
    <div className="job-status">
      {activeJob && (
        <div className="active-job" style={{ borderColor: getStatusColor(activeJob.status) }}>
          <div className="job-header">
            <span className="job-icon">{getStatusIcon(activeJob.status)}</span>
            <span className="job-type">{activeJob.type}</span>
            <span className="job-duration">{formatDuration(activeJob.createdAt)}</span>
          </div>

          <div className="job-details">
            {activeJob.currentStep && (
              <div className="job-step">
                <span className="step-label">Step:</span>
                <span className="step-value">{activeJob.currentStep}</span>
              </div>
            )}

            {activeJob.status === 'needs_input' && (
              <div className="needs-input-banner">
                <div className="needs-input-header">
                  <span className="needs-input-icon">⚠️</span>
                  <span className="needs-input-reason">
                    {activeJob.needsInputReason === 'login' && 'Login Required'}
                    {activeJob.needsInputReason === 'captcha' && 'CAPTCHA Detected'}
                    {activeJob.needsInputReason === 'ambiguity' && 'Ambiguous Step'}
                    {activeJob.needsInputReason === 'confirmation' && 'Confirmation Needed'}
                    {(!activeJob.needsInputReason || activeJob.needsInputReason === 'other') && 'Action Required'}
                  </span>
                </div>
                <span className="needs-input-text">
                  {activeJob.needsInputMessage || 'Please complete the required action in the browser, then click Continue.'}
                </span>
                <div className="needs-input-actions">
                  <button className="continue-btn" onClick={handleContinue}>
                    Continue
                  </button>
                  <button className="cancel-btn-small" onClick={handleCancel}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {!isTerminal(activeJob.status) && (
            <button className="cancel-btn" onClick={handleCancel} title="Cancel job">
              Cancel
            </button>
          )}
        </div>
      )}

      {recentJobs.length > 0 && (
        <div className="recent-jobs">
          <button
            className="recent-toggle"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
          >
            <span className="toggle-icon">{isExpanded ? '▼' : '▶'}</span>
            <span className="toggle-text">Recent Jobs ({recentJobs.length})</span>
          </button>

          {isExpanded && (
            <ul className="recent-list">
              {recentJobs.map((job) => (
                <li key={job.id} className="recent-item">
                  <span className="job-icon">{getStatusIcon(job.status)}</span>
                  <span className="job-type">{job.type}</span>
                  <span
                    className="job-status-badge"
                    style={{ backgroundColor: getStatusColor(job.status) }}
                  >
                    {job.status}
                  </span>
                  <span className="job-duration">{formatDuration(job.createdAt, job.updatedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default JobStatus

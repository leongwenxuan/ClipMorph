import { useState, useEffect, useCallback } from 'react'
import { 
  ClipMorphEvent, 
  EventTypes, 
  OpenCodePermissionRequestPayload,
  isIpcSuccess 
} from '../../../../packages/contracts/src'
import './OpenCodePermissionModal.css'

interface OpenCodePermissionModalProps {
  onClose?: () => void
}

interface PendingPermission {
  jobId: string
  type: 'file_write' | 'file_delete' | 'shell_command' | 'other'
  action: string
  context: string
  timestamp: number
}

interface AccessError {
  jobId: string
  type: string
  message: string
  fix?: string
}

function OpenCodePermissionModal({ onClose }: OpenCodePermissionModalProps): JSX.Element | null {
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null)
  const [accessError, setAccessError] = useState<AccessError | null>(null)
  const [responding, setResponding] = useState(false)
  const [wasExpanded, setWasExpanded] = useState(false)

  // Auto-expand window when showing modal
  useEffect(() => {
    const shouldExpand = !!(pendingPermission || accessError)
    
    if (shouldExpand) {
      // Check current state and expand if needed
      window.clipmorph.getWindowState().then((result) => {
        if (result.success && !result.data.expanded) {
          setWasExpanded(false)
          window.clipmorph.toggleWindow() // Expand
        } else {
          setWasExpanded(true)
        }
      })
    }
  }, [pendingPermission, accessError])

  // Restore window state when modal closes
  const closeAndRestore = useCallback(() => {
    if (!wasExpanded) {
      window.clipmorph.toggleWindow() // Collapse back
    }
  }, [wasExpanded])

  // Listen for permission request events
  useEffect(() => {
    const unsubscribe = window.clipmorph.onEvent((event: ClipMorphEvent) => {
      if (event.type === EventTypes.OPENCODE_PERMISSION_REQUEST) {
        const payload = event.payload as OpenCodePermissionRequestPayload
        console.log('[PermissionModal] Received permission request:', payload)
        setPendingPermission({
          jobId: payload.jobId,
          type: payload.type,
          action: payload.action,
          context: payload.context,
          timestamp: Date.now(),
        })
      }

      // Handle access errors
      if (event.type === 'opencode-access-error') {
        const payload = event.payload as AccessError
        console.log('[PermissionModal] Received access error:', payload)
        setAccessError(payload)
      }

      // Clear modal when OpenCode completes/fails/cancels
      if (
        event.type === EventTypes.OPENCODE_COMPLETED ||
        event.type === EventTypes.OPENCODE_CANCELLED
      ) {
        setPendingPermission(null)
        // Don't clear access error on fail - we want to show it
      }

      // Clear access error after showing for a bit on OPENCODE_FAILED
      if (event.type === EventTypes.OPENCODE_FAILED && !accessError) {
        setPendingPermission(null)
      }
    })

    return () => unsubscribe()
  }, [accessError])

  const handleApprove = useCallback(async () => {
    if (!pendingPermission || responding) return
    setResponding(true)
    try {
      const result = await window.clipmorph.respondToOpenCodePermission(true)
      if (isIpcSuccess(result)) {
        console.log('[PermissionModal] Approved permission')
      }
    } catch (err) {
      console.error('[PermissionModal] Failed to approve:', err)
    } finally {
      setResponding(false)
      setPendingPermission(null)
      closeAndRestore()
    }
  }, [pendingPermission, responding, closeAndRestore])

  const handleDeny = useCallback(async () => {
    if (!pendingPermission || responding) return
    setResponding(true)
    try {
      const result = await window.clipmorph.respondToOpenCodePermission(false)
      if (isIpcSuccess(result)) {
        console.log('[PermissionModal] Denied permission')
      }
    } catch (err) {
      console.error('[PermissionModal] Failed to deny:', err)
    } finally {
      setResponding(false)
      setPendingPermission(null)
      closeAndRestore()
    }
  }, [pendingPermission, responding, closeAndRestore])

  // Keyboard shortcuts: y = approve, n = deny, Escape = deny
  useEffect(() => {
    if (!pendingPermission) return

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault()
        handleApprove()
      } else if (e.key === 'n' || e.key === 'N' || e.key === 'Escape') {
        e.preventDefault()
        handleDeny()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pendingPermission, handleApprove, handleDeny])

  const dismissError = (): void => {
    setAccessError(null)
    closeAndRestore()
  }

  // Show access error modal
  if (accessError) {
    return (
      <div className="permission-modal-overlay">
        <div className="permission-modal high">
          <div className="permission-header">
            <span className="permission-icon">⚠️</span>
            <h3>OpenCode Error</h3>
          </div>

          <div className="permission-body">
            <p className="permission-question error-message">{accessError.message}</p>
            
            {accessError.fix && (
              <div className="error-fix">
                <strong>How to fix:</strong>
                <code>{accessError.fix}</code>
              </div>
            )}
          </div>

          <div className="permission-footer">
            <button 
              className="permission-btn approve" 
              onClick={dismissError}
              style={{ flex: 1 }}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!pendingPermission) return null

  const getIcon = (type: string): string => {
    switch (type) {
      case 'file_write': return '📝'
      case 'file_delete': return '🗑️'
      case 'shell_command': return '⚡'
      default: return '❓'
    }
  }

  const getTitle = (type: string): string => {
    switch (type) {
      case 'file_write': return 'File Operation'
      case 'file_delete': return 'Delete Operation'
      case 'shell_command': return 'Shell Command'
      default: return 'Permission Request'
    }
  }

  const getWarningLevel = (type: string): 'low' | 'medium' | 'high' => {
    switch (type) {
      case 'file_delete': return 'high'
      case 'shell_command': return 'medium'
      default: return 'low'
    }
  }

  const warningLevel = getWarningLevel(pendingPermission.type)

  return (
    <div className="permission-modal-overlay">
      <div className={`permission-modal ${warningLevel}`}>
        <div className="permission-header">
          <span className="permission-icon">{getIcon(pendingPermission.type)}</span>
          <h3>{getTitle(pendingPermission.type)}</h3>
        </div>

        <div className="permission-body">
          <p className="permission-question">OpenCode wants to:</p>
          <div className="permission-action">
            {pendingPermission.action}
          </div>
          
          {pendingPermission.context && (
            <details className="permission-context">
              <summary>Show context</summary>
              <pre>{pendingPermission.context}</pre>
            </details>
          )}
        </div>

        <div className="permission-footer">
          <button 
            className="permission-btn deny" 
            onClick={handleDeny}
            disabled={responding}
          >
            Deny (N)
          </button>
          <button 
            className="permission-btn approve" 
            onClick={handleApprove}
            disabled={responding}
          >
            Approve (Y)
          </button>
        </div>

        <div className="permission-hint">
          Press <kbd>Y</kbd> to approve, <kbd>N</kbd> or <kbd>Esc</kbd> to deny
        </div>
      </div>
    </div>
  )
}

export default OpenCodePermissionModal

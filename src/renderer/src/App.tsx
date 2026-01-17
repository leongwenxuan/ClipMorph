import { useState, useEffect, useRef } from 'react'
import {
  isIpcSuccess,
  EventTypes,
  AppStatus,
  StatusChangedPayload,
  PermissionStatus,
  PermissionChangedPayload,
  VoiceTranscriptPayload,
} from '../../../packages/contracts/src'
import Settings from './components/Settings'
import OperationsHistory from './components/OperationsHistory'
import OpenCodePermissionModal from './components/OpenCodePermissionModal'
import LastAction from './components/LastAction'
import JobStatus from './components/JobStatus'
import './styles/App.css'

type DisplayStatus = AppStatus | 'loading'

interface PermissionState {
  microphone: PermissionStatus
  accessibility: PermissionStatus
  voiceEnabled: boolean
  hotkeysEnabled: boolean
}

function App(): JSX.Element {
  const [status, setStatus] = useState<DisplayStatus>('loading')
  const [permissions, setPermissions] = useState<PermissionState>({
    microphone: 'unknown',
    accessibility: 'unknown',
    voiceEnabled: false,
    hotkeysEnabled: false,
  })
  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [showTextInput, setShowTextInput] = useState(false)
  const [textCommand, setTextCommand] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const textInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Fetch initial status and permissions from main process
    const fetchInitialState = async (): Promise<void> => {
      try {
        // Fetch status
        const statusResponse = await window.clipmorph.getAppStatus()
        if (isIpcSuccess(statusResponse)) {
          setStatus(statusResponse.data.status)
        } else {
          console.error('Failed to get status:', statusResponse.error)
          setStatus('error')
        }

        // Fetch permissions
        const permResponse = await window.clipmorph.getPermissions()
        if (isIpcSuccess(permResponse)) {
          setPermissions({
            microphone: permResponse.data.permissions.microphone,
            accessibility: permResponse.data.permissions.accessibility,
            voiceEnabled: permResponse.data.voiceEnabled,
            hotkeysEnabled: permResponse.data.hotkeysEnabled,
          })
        }

        // Fetch window state
        const windowState = await window.clipmorph.getWindowState()
        if (isIpcSuccess(windowState)) {
          setIsExpanded(windowState.data.expanded)
        }
      } catch (err) {
        console.error('Error fetching initial state:', err)
        setStatus('error')
      }
    }

    fetchInitialState()

    // Subscribe to events from main process
    const unsubscribe = window.clipmorph.onEvent((event) => {
      if (event.type === EventTypes.STATUS_CHANGED && event.payload) {
        const payload = event.payload as StatusChangedPayload
        setStatus(payload.status)
        // Clear live transcript when going back to idle
        if (payload.status === 'idle') {
          setTimeout(() => setLiveTranscript(null), 3000) // Keep visible for 3s
        }
        // Show "Listening..." indicator when recording starts
        if (payload.status === 'listening') {
          setLiveTranscript('🎤 Listening...')
        }
        if (payload.status === 'processing') {
          setLiveTranscript('⏳ Processing...')
        }
      }
      if (event.type === EventTypes.PERMISSION_CHANGED && event.payload) {
        const payload = event.payload as PermissionChangedPayload
        if (payload.type === 'microphone') {
          setPermissions((prev) => ({
            ...prev,
            microphone: payload.status,
            voiceEnabled: payload.status === 'granted',
          }))
        }
      }
      if (event.type === EventTypes.VOICE_TRANSCRIPT && event.payload) {
        const payload = event.payload as VoiceTranscriptPayload
        setLiveTranscript(`"${payload.text}"`)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const handleToggleWindow = async (): Promise<void> => {
    const result = await window.clipmorph.toggleWindow()
    if (isIpcSuccess(result)) {
      setIsExpanded(result.data.expanded)
    }
  }

  const handleRequestMicPermission = async (): Promise<void> => {
    const result = await window.clipmorph.requestPermission('microphone')
    if (isIpcSuccess(result)) {
      setPermissions((prev) => ({
        ...prev,
        microphone: result.data.status,
        voiceEnabled: result.data.granted,
      }))
    }
  }

  const handleRequestAccessibilityPermission = async (): Promise<void> => {
    const result = await window.clipmorph.requestPermission('accessibility')
    if (isIpcSuccess(result)) {
      setPermissions((prev) => ({
        ...prev,
        accessibility: result.data.status,
        hotkeysEnabled: result.data.granted,
      }))
    }
  }

  const getStatusColor = (): string => {
    switch (status) {
      case 'idle':
        return '#22c55e' // green
      case 'listening':
        return '#ef4444' // red for recording
      case 'processing':
        return '#f59e0b' // amber
      case 'error':
        return '#ef4444' // red
      default:
        return '#6b7280' // gray
    }
  }

  const getStatusText = (): string => {
    switch (status) {
      case 'idle':
        return 'Ready'
      case 'listening':
        return 'Recording'
      case 'processing':
        return 'Processing'
      case 'error':
        return 'Error'
      case 'loading':
        return 'Loading'
      default:
        return 'Unknown'
    }
  }

  const isRecording = status === 'listening'

  const getMicPermissionText = (): string => {
    switch (permissions.microphone) {
      case 'granted':
        return 'Mic: ✓'
      case 'denied':
        return 'Mic: ✗'
      case 'not-determined':
        return 'Mic: ?'
      case 'restricted':
        return 'Mic: !'
      default:
        return 'Mic: ?'
    }
  }

  const showMicWarning = !permissions.voiceEnabled && permissions.microphone !== 'unknown'
  const showAccessibilityWarning = !permissions.hotkeysEnabled && permissions.accessibility !== 'unknown'

  const handleStopRecording = async (): Promise<void> => {
    await window.clipmorph.stopVoice()
  }

  const handleCancelRecording = async (): Promise<void> => {
    // Stop without processing (just cancel)
    await window.clipmorph.stopVoice()
    setLiveTranscript(null)
  }

  const handleTextSubmit = async (): Promise<void> => {
    const text = textCommand.trim()
    if (!text || isSubmitting) return

    setIsSubmitting(true)
    setLiveTranscript(`⌨️ "${text}"`)

    try {
      const result = await window.clipmorph.submitText(text)
      if (isIpcSuccess(result)) {
        if (result.data.success) {
          setLiveTranscript(`✓ ${result.data.intent}`)
        } else {
          setLiveTranscript(`✗ ${result.data.error || 'Unknown error'}`)
        }
      }
    } catch (err) {
      console.error('Text submit failed:', err)
      setLiveTranscript('✗ Failed to process command')
    } finally {
      setIsSubmitting(false)
      setTextCommand('')
      setShowTextInput(false)
      // Clear transcript after delay
      setTimeout(() => setLiveTranscript(null), 3000)
    }
  }

  const handleTextKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleTextSubmit()
    } else if (e.key === 'Escape') {
      setShowTextInput(false)
      setTextCommand('')
    }
  }

  const toggleTextInput = (): void => {
    setShowTextInput(!showTextInput)
    if (!showTextInput) {
      // Focus input after state update
      setTimeout(() => textInputRef.current?.focus(), 50)
    }
  }

  // Compact bar mode
  if (!isExpanded) {
    // Recording state - VoiceInk style
    if (isRecording) {
      return (
        <div className="app compact recording">
          <div className="compact-recording-bar">
            {/* Left side: Waveform animation */}
            <div className="recording-left">
              <div className="recording-dot-small" />
              <div className="compact-waveform-large">
                <span className="wave-bar" />
                <span className="wave-bar" />
                <span className="wave-bar" />
                <span className="wave-bar" />
                <span className="wave-bar" />
                <span className="wave-bar" />
                <span className="wave-bar" />
              </div>
            </div>

            {/* Right side: Action buttons */}
            <div className="recording-actions">
              <button 
                className="recording-action-btn cancel" 
                onClick={handleCancelRecording}
                title="Cancel"
              >
                ✕
              </button>
              <button 
                className="recording-action-btn done" 
                onClick={handleStopRecording}
                title="Done"
              >
                ✓
              </button>
            </div>
          </div>
          {/* Show modals even in compact mode */}
          <OpenCodePermissionModal />
        </div>
      )
    }

    // Text input mode
    if (showTextInput) {
      return (
        <div className="app compact text-input-mode">
          <div className="compact-text-input-bar">
            <input
              ref={textInputRef}
              type="text"
              className="text-command-input"
              placeholder="Type command... (Enter to submit, Esc to cancel)"
              value={textCommand}
              onChange={(e) => setTextCommand(e.target.value)}
              onKeyDown={handleTextKeyDown}
              disabled={isSubmitting}
              autoFocus
            />
            <div className="text-input-actions">
              <button 
                className="recording-action-btn cancel" 
                onClick={() => { setShowTextInput(false); setTextCommand('') }}
                title="Cancel"
                disabled={isSubmitting}
              >
                ✕
              </button>
              <button 
                className="recording-action-btn done" 
                onClick={handleTextSubmit}
                title="Submit"
                disabled={!textCommand.trim() || isSubmitting}
              >
                {isSubmitting ? '...' : '→'}
              </button>
            </div>
          </div>
          {/* Show modals even in compact mode */}
          <OpenCodePermissionModal />
        </div>
      )
    }

    // Normal compact state
    return (
      <div className="app compact">
        <div className="compact-bar">
          <div className="compact-status">
            <div 
              className="status-dot" 
              style={{ backgroundColor: getStatusColor() }} 
            />
            <span className="compact-status-text">{getStatusText()}</span>
          </div>
          
          {liveTranscript && (
            <span className="compact-transcript">{liveTranscript}</span>
          )}

          <div className="compact-actions">
            <button 
              className="compact-btn keyboard-btn" 
              onClick={toggleTextInput} 
              title="Type command (instead of voice)"
            >
              ⌨
            </button>
            <button className="compact-btn" onClick={handleToggleWindow} title="Expand">
              ▼
            </button>
          </div>
        </div>
        {/* Show modals even in compact mode */}
        <OpenCodePermissionModal />
      </div>
    )
  }

  // Expanded mode
  return (
    <div className={`app expanded ${isRecording ? 'recording' : ''}`}>
      {/* Recording overlay */}
      {isRecording && (
        <div className="recording-overlay">
          <div className="recording-indicator">
            <div className="recording-dot" />
            <span className="recording-text">Recording</span>
          </div>
          <div className="recording-waveform">
            <span className="wave-bar" />
            <span className="wave-bar" />
            <span className="wave-bar" />
            <span className="wave-bar" />
            <span className="wave-bar" />
          </div>
        </div>
      )}

      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">ClipMorph</h1>
        </div>
        <div className="header-actions">
          <button
            className="header-btn"
            onClick={() => setShowHistory(true)}
            aria-label="History"
            title="History"
          >
            📋
          </button>
          <button
            className="header-btn"
            onClick={() => setShowSettings(true)}
            aria-label="Settings"
            title="Settings"
          >
            ⚙️
          </button>
          <button className="compact-btn collapse-btn" onClick={handleToggleWindow} title="Collapse">
            ▲
          </button>
        </div>
      </header>

      <main className="app-main">
        {!isRecording && (
          <>
            <div className="status-container">
              <div className="status-indicator" style={{ backgroundColor: getStatusColor() }} />
              <span className="status-text">{getStatusText()}</span>
            </div>

            {liveTranscript && (
              <div className="live-transcript">
                {liveTranscript}
              </div>
            )}

            {showMicWarning && (
              <div className="permission-warning">
                <span className="warning-icon">🎤</span>
                <span className="warning-text">
                  {permissions.microphone === 'denied' || permissions.microphone === 'restricted'
                    ? 'Microphone denied'
                    : 'Microphone required'}
                </span>
                <button className="permission-btn" onClick={handleRequestMicPermission}>
                  {permissions.microphone === 'not-determined' ? 'Enable' : 'Request'}
                </button>
              </div>
            )}

            {showAccessibilityWarning && (
              <div className="permission-warning">
                <span className="warning-icon">⌨️</span>
                <span className="warning-text">Accessibility required for hotkey</span>
                <button className="permission-btn" onClick={handleRequestAccessibilityPermission}>
                  Open Settings
                </button>
              </div>
            )}

            <div className="permission-status">
              <span
                className={`permission-badge ${permissions.voiceEnabled ? 'granted' : 'denied'}`}
              >
                {getMicPermissionText()}
              </span>
              <span
                className={`permission-badge ${permissions.hotkeysEnabled ? 'granted' : 'denied'}`}
              >
                {permissions.hotkeysEnabled ? 'Hotkey: ✓' : 'Hotkey: ✗'}
              </span>
            </div>
          </>
        )}
      </main>

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      {showHistory && <OperationsHistory onClose={() => setShowHistory(false)} />}

      {/* OpenCode permission modal - always mounted to listen for events */}
      <OpenCodePermissionModal />

      <LastAction />
      <JobStatus />
    </div>
  )
}

export default App

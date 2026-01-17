import { useState, useEffect, useRef } from 'react'
import {
  isIpcSuccess,
  EventTypes,
  AppStatus,
  StatusChangedPayload,
  PermissionStatus,
  PermissionChangedPayload,
  VoiceTranscriptPayload,
  OpenCodeOutputPayload,
} from '../../../packages/contracts/src'
import Settings from './components/Settings'
import OperationsHistory from './components/OperationsHistory'
import OpenCodePermissionModal from './components/OpenCodePermissionModal'
import LastAction from './components/LastAction'
import JobStatus from './components/JobStatus'
import {
  Clipboard,
  ClipboardList,
  Settings as SettingsIcon,
  ChevronDown,
  ChevronUp,
  Keyboard,
  X,
  Check,
  ArrowRight,
  Send,
  Mic,
  MicOff,
  FileText,
  Image,
  MessageSquare,
  Square,
  Bot,
  Zap,
  FileCode,
  Languages,
  Sparkles,
  AlignLeft,
  Minimize2,
  Code,
  Files,
  FolderOpen,
} from 'lucide-react'
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
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'transcribing' | 'executing' | 'done'>('idle')
  const [isExpanded, setIsExpanded] = useState(false)
  const [windowMode, setWindowMode] = useState<'compact' | 'compact-wide' | 'expanded'>('compact')
  const [showTextInput, setShowTextInput] = useState(false)
  const [textCommand, setTextCommand] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [openCodeLogs, setOpenCodeLogs] = useState<string[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const [openCodeRunning, setOpenCodeRunning] = useState(false)
  const [clipboardPreview, setClipboardPreview] = useState<string | null>(null)
  const [clipboardFull, setClipboardFull] = useState<string | null>(null)
  const [clipboardType, setClipboardType] = useState<'text' | 'file' | 'files' | 'image' | 'empty'>('empty')
  const [clipboardFileCount, setClipboardFileCount] = useState<number>(0)
  const [transformStatus, setTransformStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle')
  const [transformMessage, setTransformMessage] = useState<string | null>(null)
  const textInputRef = useRef<HTMLInputElement>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const windowModeRef = useRef(windowMode)

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
          setWindowMode(windowState.data.mode || 'compact')
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
        // Clear state when going back to idle
        if (payload.status === 'idle') {
          setVoiceState('idle')
          setTimeout(() => setLiveTranscript(null), 2000) // Keep visible briefly
        }
        // Reset to listening state when recording starts
        if (payload.status === 'listening') {
          setVoiceState('listening')
          setLiveTranscript(null)
        }
        if (payload.status === 'processing') {
          setVoiceState('executing')
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
        console.log('[Renderer] Transcript:', payload.text, { isFinal: payload.isFinal, isExecuting: payload.isExecuting, isDone: payload.isDone })
        
        if (payload.isExecuting) {
          // Command is being executed
          setVoiceState('executing')
          setLiveTranscript(payload.text)
        } else if (payload.isDone) {
          // Command finished
          setVoiceState('done')
          setLiveTranscript(payload.text)
        } else if (payload.text === '') {
          // Back to listening
          setVoiceState('listening')
          setLiveTranscript(null)
        } else {
          // Live transcript
          setVoiceState('transcribing')
          setLiveTranscript(payload.text)
        }
      }
      if (event.type === EventTypes.OPENCODE_OUTPUT && event.payload) {
        const payload = event.payload as OpenCodeOutputPayload
        console.log('[Renderer] Received OPENCODE_OUTPUT, chunk size:', payload.chunk.data.length)
        
        // Clean ANSI codes for display
        const cleanData = payload.chunk.data.replace(/\x1b\[[0-9;]*m/g, '')
        setOpenCodeLogs((prev) => [...prev, cleanData])

        // Auto-expand to compact-wide when logs appear (if not already expanded)
        if (windowModeRef.current === 'compact') {
          console.log('[Renderer] Expanding to compact-wide for logs')
          setShowLogs(true)
          window.clipmorph.setWindowMode('compact-wide').then((result) => {
            if (isIpcSuccess(result)) {
              setWindowMode(result.data.mode)
            }
          })
        }
      }
      // Clear logs when task completes or fails
      if (
        event.type === EventTypes.OPENCODE_COMPLETED ||
        event.type === EventTypes.OPENCODE_FAILED ||
        event.type === EventTypes.OPENCODE_CANCELLED
      ) {
        console.log('[Renderer] OpenCode task ended:', event.type)
        setOpenCodeRunning(false)
        
        // Add completion message
        const statusMsg = event.type === EventTypes.OPENCODE_COMPLETED 
          ? '✅ Task completed' 
          : event.type === EventTypes.OPENCODE_FAILED 
            ? '❌ Task failed' 
            : '⚠️ Task cancelled'
        setOpenCodeLogs((prev) => [...prev, statusMsg])
        
        // Keep logs visible for a bit, then collapse
        setTimeout(() => {
          setShowLogs(false)
          if (windowModeRef.current === 'compact-wide') {
            window.clipmorph.setWindowMode('compact').then((result) => {
              if (isIpcSuccess(result)) {
                setWindowMode(result.data.mode)
              }
            })
          }
          // Clear logs after animation
          setTimeout(() => setOpenCodeLogs([]), 300)
        }, 5000) // Keep visible for 5s instead of 3s
      }
      if (event.type === EventTypes.OPENCODE_STARTED) {
        console.log('[Renderer] OPENCODE_STARTED - clearing logs and preparing UI')
        // Clear old logs when new task starts
        setOpenCodeLogs(['⏳ OpenCode task started...'])
        setShowLogs(true)
        setOpenCodeRunning(true)
        // Immediately expand to compact-wide
        if (windowModeRef.current === 'compact') {
          window.clipmorph.setWindowMode('compact-wide').then((result) => {
            if (isIpcSuccess(result)) {
              setWindowMode(result.data.mode)
            }
          })
        }
      }
      // Auto-compact when app loses focus
      if (event.type === EventTypes.APP_BLUR) {
        // Use ref to get current windowMode (avoids stale closure)
        const currentMode = windowModeRef.current
        console.log('[Renderer] App blur event received, windowMode:', currentMode)
        if (currentMode === 'expanded') {
          console.log('[Renderer] App blur - collapsing to compact')
          setShowSettings(false)
          setShowHistory(false)
          setIsExpanded(false)
          window.clipmorph.setWindowMode('compact').then((result) => {
            if (isIpcSuccess(result)) {
              setWindowMode(result.data.mode)
            }
          })
        }
      }
      // Transform/Job status events
      if (event.type === EventTypes.JOB_CREATED) {
        setTransformStatus('processing')
        setTransformMessage('Processing...')
      }
      if (event.type === EventTypes.JOB_COMPLETED) {
        setTransformStatus('done')
        setTransformMessage('Done! Copied to clipboard')
        // Clear after 3 seconds
        setTimeout(() => {
          setTransformStatus('idle')
          setTransformMessage(null)
        }, 3000)
      }
      if (event.type === EventTypes.JOB_FAILED) {
        setTransformStatus('error')
        setTransformMessage('Failed')
        // Clear after 3 seconds
        setTimeout(() => {
          setTransformStatus('idle')
          setTransformMessage(null)
        }, 3000)
      }
    })

    return () => {
      unsubscribe()
    }
  }, []) // Empty deps - we use refs for current values

  // Keep windowModeRef in sync
  useEffect(() => {
    windowModeRef.current = windowMode
  }, [windowMode])

  // Auto-scroll logs to bottom when they update
  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [openCodeLogs, showLogs])

  // Poll clipboard content for preview
  useEffect(() => {
    const updateClipboardPreview = async () => {
      try {
        const result = await window.clipmorph.readClipboard()
        if (isIpcSuccess(result)) {
          const { text, filePaths } = result.data
          
          // Check if we have actual copied files (from Finder)
          if (filePaths && filePaths.length > 0) {
            setClipboardFileCount(filePaths.length)
            
            // Files were copied from Finder
            if (filePaths.length === 1) {
              const filename = filePaths[0].split('/').pop() || filePaths[0]
              setClipboardPreview(filename)
              setClipboardFull(filePaths[0])
              setClipboardType('file')
            } else {
              // Multiple files
              const fileNames = filePaths.map(p => p.split('/').pop() || p)
              setClipboardPreview(`${filePaths.length} files`)
              setClipboardFull(filePaths.join('\n'))
              setClipboardType('files')
            }
            return
          }
          
          setClipboardFileCount(0)
          
          if (!text || text.trim() === '') {
            setClipboardPreview(null)
            setClipboardFull(null)
            setClipboardType('empty')
          } else {
            // Detect if it's a file path
            const isFilePath = /^(\/|~|[A-Za-z]:)/.test(text.trim()) && 
                               !text.includes('\n') && 
                               text.trim().length < 500
            // Detect if it looks like an image (base64 or data URL)
            const isImage = text.startsWith('data:image/') || 
                           /\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i.test(text.trim())
            
            if (isFilePath) {
              // Show just the filename for file paths
              const filename = text.trim().split('/').pop() || text.trim()
              setClipboardPreview(filename)
              setClipboardFull(text.trim())
              setClipboardType('file')
            } else if (isImage) {
              setClipboardPreview('[Image]')
              setClipboardFull(null)
              setClipboardType('image')
            } else {
              // Store full text for expanded view (up to 2000 chars)
              const fullText = text.length > 2000 ? text.slice(0, 1997) + '...' : text
              setClipboardFull(fullText)
              // Truncate for compact preview
              const preview = text.length > 100 ? text.slice(0, 97) + '...' : text
              setClipboardPreview(preview.replace(/\s+/g, ' ').trim())
              setClipboardType('text')
            }
          }
        }
      } catch (err) {
        // Silently ignore clipboard read errors
      }
    }

    // Initial read
    updateClipboardPreview()

    // Poll every 1 second (reasonable for clipboard changes)
    const interval = setInterval(updateClipboardPreview, 1000)

    return () => clearInterval(interval)
  }, [])

  const handleToggleWindow = async (): Promise<void> => {
    const result = await window.clipmorph.toggleWindow()
    if (isIpcSuccess(result)) {
      setIsExpanded(result.data.expanded)
      setWindowMode(result.data.mode)
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

  // isRecording should be true during both listening AND processing (executing)
  const isRecording = status === 'listening' || status === 'processing'

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

  const handleQuickAction = async (command: string): Promise<void> => {
    if (isSubmitting || !clipboardPreview) return
    
    setIsSubmitting(true)
    setLiveTranscript(`⚡ ${command}...`)

    try {
      const result = await window.clipmorph.submitText(command)
      if (isIpcSuccess(result)) {
        if (result.data.success) {
          setLiveTranscript(`✓ ${result.data.intent}`)
        } else {
          setLiveTranscript(`✗ ${result.data.error || 'Failed'}`)
        }
      }
    } catch (err) {
      console.error('Quick action failed:', err)
      setLiveTranscript('✗ Failed')
    } finally {
      setIsSubmitting(false)
      setTimeout(() => setLiveTranscript(null), 3000)
    }
  }

  const quickActions = [
    { label: 'Summarize', command: 'summarize this', icon: AlignLeft },
    { label: 'Fix Grammar', command: 'fix grammar and spelling', icon: Sparkles },
    { label: 'To JSON', command: 'convert to JSON', icon: FileCode },
    { label: 'Translate', command: 'translate to English', icon: Languages },
    { label: 'Shorten', command: 'make this shorter and more concise', icon: Minimize2 },
    { label: 'To Code', command: 'convert this to code', icon: Code },
  ]

  const toggleTextInput = (): void => {
    setShowTextInput(!showTextInput)
    if (!showTextInput) {
      // Focus input after state update
      setTimeout(() => textInputRef.current?.focus(), 50)
    }
  }

  // Compact bar mode
  if (!isExpanded) {
    // Compact-wide mode with logs
    if (windowMode === 'compact-wide' && showLogs) {
      return (
        <div className="app compact-wide">
          {/* Top bar */}
          <div className="compact-bar">
            <div className="compact-status">
              <div
                className={`status-dot ${openCodeRunning ? 'pulsing' : ''}`}
                style={{ backgroundColor: openCodeRunning ? '#f59e0b' : getStatusColor() }}
              />
              <span className="compact-status-text">
                {openCodeRunning ? <><Bot size={12} className="inline-icon" /> OpenCode Working...</> : getStatusText()}
              </span>
            </div>

            {liveTranscript && !openCodeRunning && (
              <span className="compact-transcript">{liveTranscript}</span>
            )}

            <div className="compact-actions">
              {openCodeRunning && (
                <button
                  className="compact-btn cancel-btn"
                  onClick={() => window.clipmorph.cancelOpenCode()}
                  title="Cancel task"
                >
                  <Square size={10} />
                </button>
              )}
              <button
                className="compact-btn close-logs-btn"
                onClick={() => {
                  setShowLogs(false)
                  window.clipmorph.setWindowMode('compact').then((result) => {
                    if (isIpcSuccess(result)) {
                      setWindowMode(result.data.mode)
                    }
                  })
                }}
                title="Hide logs"
              >
                <X size={12} />
              </button>
              <button className="compact-btn" onClick={handleToggleWindow} title="Expand">
                <ChevronDown size={12} />
              </button>
            </div>
          </div>

          {/* Logs display */}
          <div className="compact-logs">
            <div className="logs-content">
              {openCodeLogs.length === 0 ? (
                <div className="log-line waiting">Waiting for output...</div>
              ) : (
                openCodeLogs.map((log, index) => (
                  <div key={index} className="log-line">
                    {log}
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>

          <OpenCodePermissionModal />
        </div>
      )
    }

    // Recording state - VoiceInk style
    if (isRecording) {
      return (
        <div className="app compact recording">
          <div className="compact-recording-bar">
            {/* Left side: Status indicator */}
            <div className="recording-left">
              {voiceState === 'executing' ? (
                <>
                  <Sparkles size={14} className="spinning" style={{ color: '#fbbf24' }} />
                  <span style={{ fontSize: '12px', color: '#fbbf24', marginLeft: '6px' }}>
                    Executing{liveTranscript ? `: ${liveTranscript.slice(0, 25)}...` : '...'}
                  </span>
                </>
              ) : voiceState === 'done' ? (
                <>
                  <Check size={14} style={{ color: '#22c55e' }} />
                  <span style={{ fontSize: '12px', color: '#22c55e', marginLeft: '6px' }}>
                    Done! Ready to paste
                  </span>
                </>
              ) : (
                <>
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
                  {liveTranscript && (
                    <span style={{ fontSize: '11px', color: '#93c5fd', marginLeft: '8px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {liveTranscript.length > 30 ? '...' + liveTranscript.slice(-30) : liveTranscript}
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Right side: Action buttons */}
            <div className="recording-actions">
              <button 
                className="recording-action-btn cancel" 
                onClick={handleCancelRecording}
                title="Cancel"
              >
                <X size={12} />
              </button>
              <button 
                className="recording-action-btn done" 
                onClick={handleStopRecording}
                title="Done"
              >
                <Check size={12} />
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
                <X size={12} />
              </button>
              <button 
                className="recording-action-btn done" 
                onClick={handleTextSubmit}
                title="Submit"
                disabled={!textCommand.trim() || isSubmitting}
              >
                {isSubmitting ? '...' : <ArrowRight size={12} />}
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
              className={`status-dot ${isRecording ? 'recording' : ''} ${transformStatus === 'processing' ? 'pulsing' : ''}`}
              style={{ 
                backgroundColor: isRecording 
                  ? (transformStatus === 'processing' ? '#f59e0b' : '#ef4444')
                  : transformStatus === 'processing' ? '#f59e0b' 
                  : transformStatus === 'done' ? '#22c55e' 
                  : transformStatus === 'error' ? '#ef4444' 
                  : getStatusColor() 
              }} 
            />
            <span className="compact-status-text">
              {isRecording 
                ? (transformStatus === 'processing' ? 'Executing' : 'Voice')
                : transformStatus === 'processing' ? 'Processing...' 
                : transformStatus === 'done' ? 'Done!' 
                : transformStatus === 'error' ? 'Failed' 
                : getStatusText()}
            </span>
          </div>
          
          {/* Show voice/transform state or clipboard preview */}
          {isRecording ? (
            // Voice recording active - show state-appropriate UI
            <div className="compact-voice-area">
              {voiceState === 'executing' || transformStatus === 'processing' ? (
                // Currently executing a command
                <span className="compact-voice-status executing">
                  <Sparkles size={12} className="spinning" />
                  <span>Executing{liveTranscript ? `: ${liveTranscript.slice(0, 30)}${liveTranscript.length > 30 ? '...' : ''}` : '...'}</span>
                </span>
              ) : voiceState === 'done' ? (
                // Command finished successfully
                <span className="compact-voice-status done">
                  <Check size={12} />
                  <span>Done! Ready for next...</span>
                </span>
              ) : voiceState === 'transcribing' && liveTranscript ? (
                // Show live transcript
                <span className="compact-voice-transcript" title={liveTranscript}>
                  <Mic size={12} className="mic-active" />
                  <span>{liveTranscript.length > 40 ? '...' + liveTranscript.slice(-40) : liveTranscript}</span>
                </span>
              ) : (
                // Just listening, no words yet
                <span className="compact-voice-status listening">
                  <div className="mini-waveform">
                    <span className="mini-wave" />
                    <span className="mini-wave" />
                    <span className="mini-wave" />
                    <span className="mini-wave" />
                  </div>
                  <span>Listening...</span>
                </span>
              )}
            </div>
          ) : transformStatus !== 'idle' && transformMessage ? (
            // Transform complete/error (not recording)
            <span className={`compact-transform-status ${transformStatus}`}>
              {transformStatus === 'processing' && <Sparkles size={12} className="spinning" />}
              {transformStatus === 'done' && <Check size={12} />}
              {transformStatus === 'error' && <X size={12} />}
              <span>{transformMessage}</span>
            </span>
          ) : clipboardPreview ? (
            <span className={`compact-clipboard ${clipboardType}`} title={`Clipboard: ${clipboardPreview}`}>
              <span className="clipboard-icon">
                {clipboardType === 'files' ? <Files size={12} /> : clipboardType === 'file' ? <FileText size={12} /> : clipboardType === 'image' ? <Image size={12} /> : <Clipboard size={12} />}
              </span>
              <span className="clipboard-text">{clipboardPreview}</span>
            </span>
          ) : (
            <span className="compact-clipboard empty" title="Clipboard is empty">
              <span className="clipboard-icon"><Clipboard size={12} /></span>
              <span className="clipboard-text">Empty</span>
            </span>
          )}

          <div className="compact-actions">
            <button 
              className="compact-btn keyboard-btn" 
              onClick={toggleTextInput} 
              title="Type command (instead of voice)"
            >
              <Keyboard size={12} />
            </button>
            <button className="compact-btn" onClick={handleToggleWindow} title="Expand">
              <ChevronDown size={12} />
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
            <ClipboardList size={16} />
          </button>
          <button
            className="header-btn"
            onClick={() => setShowSettings(true)}
            aria-label="Settings"
            title="Settings"
          >
            <SettingsIcon size={16} />
          </button>
          <button className="compact-btn collapse-btn" onClick={handleToggleWindow} title="Collapse">
            <ChevronUp size={12} />
          </button>
        </div>
      </header>

      <main className="app-main">
        {showSettings ? (
          <Settings onClose={() => setShowSettings(false)} />
        ) : showHistory ? (
          <OperationsHistory onClose={() => setShowHistory(false)} />
        ) : !isRecording ? (
          <div className="main-dashboard">
            {/* Clipboard Preview Section - Larger */}
            <div className="dashboard-section clipboard-section-large">
              <div className="section-header">
                <span className="section-icon"><Clipboard size={14} /></span>
                <span className="section-title">Clipboard</span>
                {clipboardType !== 'empty' && (
                  <span className={`clipboard-type-badge-inline ${clipboardType}`}>
                    {clipboardType === 'files' ? <><Files size={10} /> {clipboardFileCount} Files</> : 
                     clipboardType === 'file' ? <><FileText size={10} /> File</> : 
                     clipboardType === 'image' ? <><Image size={10} /> Image</> : 
                     <><Clipboard size={10} /> Text</>}
                  </span>
                )}
              </div>
              <div className="clipboard-preview-expanded">
                {clipboardFull || clipboardPreview ? (
                  <div className={`clipboard-content-full ${clipboardType === 'files' ? 'files-list' : ''}`}>
                    {clipboardType === 'files' && clipboardFull ? (
                      <div className="files-preview">
                        {clipboardFull.split('\n').map((filePath, idx) => (
                          <div key={idx} className="file-item">
                            <FileText size={14} className="file-icon" />
                            <div className="file-info">
                              <span className="file-name">{filePath.split('/').pop()}</span>
                              <span className="file-path">{filePath}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : clipboardType === 'file' && clipboardFull ? (
                      <div className="file-preview-single">
                        <FileText size={20} className="file-icon-large" />
                        <div className="file-info-large">
                          <span className="file-name-large">{clipboardFull.split('/').pop()}</span>
                          <span className="file-path-large">{clipboardFull}</span>
                        </div>
                      </div>
                    ) : (
                      clipboardFull || clipboardPreview
                    )}
                  </div>
                ) : (
                  <div className="clipboard-empty-state">
                    <span className="empty-icon"><Clipboard size={32} /></span>
                    <span className="empty-text">Clipboard is empty</span>
                    <span className="empty-hint">Copy something to get started</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="dashboard-section quick-actions-section">
              <div className="section-header">
                <span className="section-icon"><Zap size={14} /></span>
                <span className="section-title">Quick Actions</span>
              </div>
              <div className="quick-actions-grid">
                {quickActions.map((action) => (
                  <button
                    key={action.command}
                    className="quick-action-btn"
                    onClick={() => handleQuickAction(action.command)}
                    disabled={isSubmitting || !clipboardPreview}
                    title={action.command}
                  >
                    <action.icon size={14} />
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Command Input Section */}
            <div className="dashboard-section command-section">
              <div className="section-header">
                <span className="section-icon"><MessageSquare size={14} /></span>
                <span className="section-title">Custom Command</span>
              </div>
              <div className="command-input-wrapper">
                <input
                  type="text"
                  className="command-input-large"
                  placeholder="Or type your own command..."
                  value={textCommand}
                  onChange={(e) => setTextCommand(e.target.value)}
                  onKeyDown={handleTextKeyDown}
                  disabled={isSubmitting}
                />
                <button 
                  className="command-submit-btn"
                  onClick={handleTextSubmit}
                  disabled={!textCommand.trim() || isSubmitting}
                >
                  {isSubmitting ? '...' : <Send size={16} />}
                </button>
              </div>
              <div className="command-hints">
                <span className="hint">Press <kbd>Alt+C</kbd> to use voice</span>
                <span className="hint-divider">•</span>
                <span className="hint">Press <kbd>Enter</kbd> to submit</span>
              </div>
            </div>

            {/* Live Transcript */}
            {liveTranscript && (
              <div className="dashboard-section transcript-section">
                <div className="live-transcript-large">
                  {liveTranscript}
                </div>
              </div>
            )}

            {/* Status Bar */}
            <div className="dashboard-status-bar">
              <div className="status-left">
                <div 
                  className={`status-indicator-small ${transformStatus === 'processing' ? 'pulsing' : ''}`}
                  style={{ backgroundColor: transformStatus === 'processing' ? '#f59e0b' : transformStatus === 'done' ? '#22c55e' : transformStatus === 'error' ? '#ef4444' : getStatusColor() }} 
                />
                <span className="status-text-small">
                  {transformStatus === 'processing' ? 'Processing...' : transformStatus === 'done' ? 'Done! Copied to clipboard' : transformStatus === 'error' ? 'Transform failed' : getStatusText()}
                </span>
              </div>
              <div className="status-right">
                {transformStatus !== 'idle' && (
                  <span className={`status-badge transform-badge ${transformStatus}`}>
                    {transformStatus === 'processing' && <><Sparkles size={12} className="spinning" /> Working</>}
                    {transformStatus === 'done' && <><Check size={12} /> Ready to paste</>}
                    {transformStatus === 'error' && <><X size={12} /> Failed</>}
                  </span>
                )}
                <span className={`status-badge ${permissions.voiceEnabled ? 'active' : 'inactive'}`}>
                  <Mic size={12} /> {permissions.voiceEnabled ? 'Ready' : 'Off'}
                </span>
                <span className={`status-badge ${permissions.hotkeysEnabled ? 'active' : 'inactive'}`}>
                  <Keyboard size={12} /> {permissions.hotkeysEnabled ? 'Alt+C' : 'Off'}
                </span>
              </div>
            </div>

            {/* Permission Warnings */}
            {(showMicWarning || showAccessibilityWarning) && (
              <div className="permission-warnings">
                {showMicWarning && (
                  <div className="permission-warning-card">
                    <span className="warning-icon"><MicOff size={18} /></span>
                    <div className="warning-content">
                      <span className="warning-title">
                        {permissions.microphone === 'denied' ? 'Microphone Denied' : 'Microphone Required'}
                      </span>
                      <span className="warning-desc">Enable to use voice commands</span>
                    </div>
                    <button className="warning-action-btn" onClick={handleRequestMicPermission}>
                      Enable
                    </button>
                  </div>
                )}
                {showAccessibilityWarning && (
                  <div className="permission-warning-card">
                    <span className="warning-icon"><Keyboard size={18} /></span>
                    <div className="warning-content">
                      <span className="warning-title">Accessibility Required</span>
                      <span className="warning-desc">Enable for global hotkey</span>
                    </div>
                    <button className="warning-action-btn" onClick={handleRequestAccessibilityPermission}>
                      Open Settings
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </main>

      {/* OpenCode permission modal - always mounted to listen for events */}
      <OpenCodePermissionModal />

      <LastAction />
      <JobStatus />
    </div>
  )
}

export default App

import { useState, useEffect, useCallback } from 'react'
import { isIpcSuccess, OperationHistoryEntry } from '../../../../packages/contracts/src'
import { 
  RefreshCw, 
  Trash2, 
  X, 
  Sparkles, 
  BarChart3, 
  Bot, 
  Code, 
  Zap, 
  Check, 
  XCircle, 
  Download, 
  Upload, 
  Image, 
  Copy,
  Clock,
  Terminal
} from 'lucide-react'
import './OperationsHistory.css'

interface OperationsHistoryProps {
  onClose: () => void
}

// Cache for loaded images
const imageCache = new Map<string, string>()

function OperationsHistory({ onClose }: OperationsHistoryProps): JSX.Element {
  const [operations, setOperations] = useState<OperationHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loadedImages, setLoadedImages] = useState<Map<string, string>>(new Map())
  const [copyingId, setCopyingId] = useState<string | null>(null)

  useEffect(() => {
    loadOperations()
  }, [])

  const loadOperations = async (): Promise<void> => {
    setLoading(true)
    try {
      const result = await window.clipmorph.getOperationsHistory(50)
      if (isIpcSuccess(result) && result.data?.operations) {
        setOperations(result.data.operations)
      } else {
        console.error('Failed to load operations:', result)
        setOperations([])
      }
    } catch (err) {
      console.error('Failed to load operations:', err)
      setOperations([])
    } finally {
      setLoading(false)
    }
  }

  const handleClear = async (): Promise<void> => {
    if (confirm('Clear all operations history?')) {
      await window.clipmorph.clearOperationsHistory()
      setOperations([])
    }
  }

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const truncate = (text: string | null, maxLen: number): string => {
    if (!text) return '(empty)'
    if (text.length <= maxLen) return text
    return text.substring(0, maxLen) + '...'
  }

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    const mins = Math.floor(ms / 60000)
    const secs = ((ms % 60000) / 1000).toFixed(0)
    return `${mins}m ${secs}s`
  }

  const getJobTypeIcon = (jobType: string): JSX.Element => {
    const iconProps = { size: 18, className: 'job-type-icon' }
    switch (jobType) {
      case 'llm-transform': return <Sparkles {...iconProps} />
      case 'chart-render': return <BarChart3 {...iconProps} />
      case 'automation': return <Bot {...iconProps} />
      case 'code:generate':
      case 'code:convert':
      case 'code:explain':
      case 'code:debug':
      case 'code:refactor':
      case 'code:document':
      case 'code:test':
        return <Code {...iconProps} />
      case 'browser-agent': return <Terminal {...iconProps} />
      default: return <Zap {...iconProps} />
    }
  }

  const toggleExpand = (id: string): void => {
    setExpandedId(expandedId === id ? null : id)
  }

  // Load image when expanding an operation with an image
  const loadImage = useCallback(async (imagePath: string, opId: string): Promise<void> => {
    // Check cache first
    if (imageCache.has(imagePath)) {
      setLoadedImages(prev => new Map(prev).set(opId, imageCache.get(imagePath)!))
      return
    }

    try {
      console.log('[OperationsHistory] Loading image:', imagePath)
      const result = await window.clipmorph.getImageBase64(imagePath)
      console.log('[OperationsHistory] Image result success:', isIpcSuccess(result))
      console.log('[OperationsHistory] Has base64:', !!result?.data?.base64)
      console.log('[OperationsHistory] Base64 length:', result?.data?.base64?.length)
      if (isIpcSuccess(result) && result.data?.base64) {
        // Ensure base64 has no line breaks
        const cleanBase64 = result.data.base64.replace(/[\r\n]/g, '')
        const dataUrl = `data:${result.data.mimeType};base64,${cleanBase64}`
        console.log('[OperationsHistory] Data URL length:', dataUrl.length)
        console.log('[OperationsHistory] Data URL prefix:', dataUrl.substring(0, 50))
        imageCache.set(imagePath, dataUrl)
        setLoadedImages(prev => new Map(prev).set(opId, dataUrl))
      } else {
        console.error('[OperationsHistory] Failed result:', result)
        // Mark as failed so we don't retry
        setLoadedImages(prev => new Map(prev).set(opId, 'error'))
      }
    } catch (err) {
      console.error('Failed to load image:', err)
      setLoadedImages(prev => new Map(prev).set(opId, 'error'))
    }
  }, [])

  // Load image when expanding
  useEffect(() => {
    if (expandedId) {
      const op = operations.find(o => o.id === expandedId)
      if (op?.output_image_path && !loadedImages.has(expandedId)) {
        loadImage(op.output_image_path, expandedId)
      }
    }
  }, [expandedId, operations, loadedImages, loadImage])

  const handleCopyImage = async (imagePath: string, opId: string): Promise<void> => {
    setCopyingId(opId)
    try {
      const result = await window.clipmorph.copyImageToClipboard(imagePath)
      if (isIpcSuccess(result)) {
        // Brief visual feedback
        setTimeout(() => setCopyingId(null), 500)
      } else {
        console.error('Failed to copy image:', result)
        setCopyingId(null)
      }
    } catch (err) {
      console.error('Failed to copy image:', err)
      setCopyingId(null)
    }
  }

  const handleCopyText = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error('Failed to copy text:', err)
    }
  }

  return (
    <div className="operations-history-overlay" onClick={onClose}>
      <div className="operations-history-panel" onClick={(e) => e.stopPropagation()}>
        <div className="operations-history-header">
          <h2><Clock size={18} className="header-icon" /> History</h2>
          <div className="operations-history-actions">
            <button className="refresh-btn" onClick={loadOperations} title="Refresh">
              <RefreshCw size={16} />
            </button>
            <button className="clear-btn" onClick={handleClear} title="Clear history">
              <Trash2 size={16} />
            </button>
            <button className="close-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="operations-history-content">
          {loading ? (
            <div className="operations-loading">Loading...</div>
          ) : operations.length === 0 ? (
            <div className="operations-empty">
              <p>No operations yet</p>
              <p className="operations-empty-hint">
                Use voice or text commands to transform clipboard content
              </p>
            </div>
          ) : (
            <div className="operations-list">
              {operations.map((op) => (
                <div 
                  key={op.id} 
                  className={`operation-item ${op.success ? 'success' : 'failed'} ${expandedId === op.id ? 'expanded' : ''}`}
                  onClick={() => toggleExpand(op.id)}
                >
                  <div className="operation-header">
                    <span className="operation-icon">{getJobTypeIcon(op.job_type)}</span>
                    <span className="operation-command">"{truncate(op.command, 40)}"</span>
                    <span className={`operation-status ${op.success ? 'success' : 'failed'}`}>
                      {op.success ? <Check size={12} /> : <XCircle size={12} />}
                    </span>
                    <span className="operation-time">{formatTime(op.created_at)}</span>
                  </div>

                  {expandedId === op.id && (
                    <div className="operation-details">
                      <div className="operation-detail-row">
                        <span className="detail-label">Command:</span>
                        <span className="detail-value">{op.command}</span>
                      </div>
                      <div className="operation-detail-row">
                        <span className="detail-label">Type:</span>
                        <span className="detail-value">{op.job_type}</span>
                      </div>
                      {op.duration_ms && (
                        <div className="operation-detail-row">
                          <span className="detail-label">Duration:</span>
                          <span className="detail-value">{formatDuration(op.duration_ms)}</span>
                        </div>
                      )}
                      {op.error && (
                        <div className="operation-detail-row error">
                          <span className="detail-label">Error:</span>
                          <span className="detail-value">{op.error}</span>
                        </div>
                      )}
                      
                      <div className="operation-io">
                        <div className="io-section">
                          <div className="io-label"><Download size={14} /> Input (Clipboard):</div>
                          <pre className="io-content">{truncate(op.input_text, 500)}</pre>
                        </div>
                        
                        {op.output_text && (
                          <div className="io-section">
                            <div className="io-label">
                              <Upload size={14} /> Output:
                              <button 
                                className="copy-btn small" 
                                onClick={(e) => { e.stopPropagation(); handleCopyText(op.output_text!) }}
                                title="Copy output to clipboard"
                              >
                                <Copy size={12} />
                              </button>
                            </div>
                            <pre className="io-content">{truncate(op.output_text, 500)}</pre>
                          </div>
                        )}
                        
                        {op.output_image_path && (
                          <div className="io-section image-section">
                            <div className="io-label">
                              <Image size={14} /> Image Output ({op.output_image_size ? (op.output_image_size / 1024).toFixed(1) + ' KB' : 'N/A'}):
                              <button 
                                className={`copy-btn small ${copyingId === op.id ? 'copied' : ''}`}
                                onClick={(e) => { e.stopPropagation(); handleCopyImage(op.output_image_path!, op.id) }}
                                title="Copy image to clipboard"
                                disabled={copyingId === op.id}
                              >
                                {copyingId === op.id ? <Check size={12} /> : <Copy size={12} />}
                              </button>
                            </div>
                            <div className="image-preview">
                              {loadedImages.has(op.id) ? (
                                loadedImages.get(op.id) === 'error' ? (
                                  <div className="image-error">Image not found or failed to load</div>
                                ) : (
                                  <img 
                                    src={loadedImages.get(op.id)} 
                                    alt="Chart output" 
                                    className="output-image"
                                  />
                                )
                              ) : (
                                <div className="image-loading">Loading preview...</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default OperationsHistory

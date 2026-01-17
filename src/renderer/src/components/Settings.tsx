/**
 * Settings Component
 *
 * Displays and manages ClipMorph settings
 */

import { useState, useEffect } from 'react'
import { isIpcSuccess, EventTypes, SettingsChangedPayload, SecretKey } from '../../../../packages/contracts/src'
import './Settings.css'

interface SettingsData {
  'hotkey.pushToTalk': string
  'transforms.urlClean.enabled': string
  'transforms.urlMarkdown.enabled': string
  'transforms.jsonPretty.enabled': string
  'transforms.jsonMinify.enabled': string
  'transforms.jsonToYaml.enabled': string
  'transforms.yamlToJson.enabled': string
  'transforms.extractEmails.enabled': string
  'transforms.extractLinks.enabled': string
  'transforms.redactSecrets.enabled': string
  'ui.theme': string
  'cerebras.model': string
  [key: string]: string
}

// Available Cerebras models
const CEREBRAS_MODELS = [
  { id: 'llama3.1-8b', name: 'Llama 3.1 8B', params: '8B', speed: '~2200 t/s' },
  { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', params: '70B', speed: '~2100 t/s' },
  { id: 'gpt-oss-120b', name: 'OpenAI GPT OSS', params: '120B', speed: '~3000 t/s' },
  { id: 'qwen-3-32b', name: 'Qwen 3 32B', params: '32B', speed: '~2600 t/s' },
]

interface SettingsProps {
  onClose: () => void
}

const TRANSFORM_LABELS: Record<string, string> = {
  urlClean: 'URL Clean',
  urlMarkdown: 'URL to Markdown',
  jsonPretty: 'JSON Pretty',
  jsonMinify: 'JSON Minify',
  jsonToYaml: 'JSON to YAML',
  yamlToJson: 'YAML to JSON',
  extractEmails: 'Extract Emails',
  extractLinks: 'Extract Links',
  redactSecrets: 'Redact Secrets',
}

function Settings({ onClose }: SettingsProps): JSX.Element {
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingHotkey, setEditingHotkey] = useState(false)
  const [hotkeyInput, setHotkeyInput] = useState('')
  const [hotkeyError, setHotkeyError] = useState<string | null>(null)
  
  // API Key state (OpenAI)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [maskedApiKey, setMaskedApiKey] = useState<string | null>(null)
  const [editingApiKey, setEditingApiKey] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [apiKeyError, setApiKeyError] = useState<string | null>(null)
  const [apiKeySaving, setApiKeySaving] = useState(false)
  
  // Cerebras API Key state
  const [hasCerebrasKey, setHasCerebrasKey] = useState(false)
  const [maskedCerebrasKey, setMaskedCerebrasKey] = useState<string | null>(null)
  const [editingCerebrasKey, setEditingCerebrasKey] = useState(false)
  const [cerebrasKeyInput, setCerebrasKeyInput] = useState('')
  const [cerebrasKeyError, setCerebrasKeyError] = useState<string | null>(null)
  const [cerebrasKeySaving, setCerebrasKeySaving] = useState(false)

  useEffect(() => {
    const fetchSettings = async (): Promise<void> => {
      try {
        const response = await window.clipmorph.getAllSettings()
        if (isIpcSuccess(response)) {
          setSettings(response.data.settings as SettingsData)
        }
        
        // Fetch API key status
        const secretResponse = await window.clipmorph.getSecret('openai-api-key')
        if (isIpcSuccess(secretResponse)) {
          setHasApiKey(secretResponse.data.hasValue)
          setMaskedApiKey(secretResponse.data.maskedValue || null)
        }
        
        // Fetch Cerebras API key status
        const cerebrasResponse = await window.clipmorph.getSecret('cerebras-api-key')
        if (isIpcSuccess(cerebrasResponse)) {
          setHasCerebrasKey(cerebrasResponse.data.hasValue)
          setMaskedCerebrasKey(cerebrasResponse.data.maskedValue || null)
        }
      } catch (err) {
        console.error('Failed to fetch settings:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()

    // Listen for settings changes
    const unsubscribe = window.clipmorph.onEvent((event) => {
      if (event.type === EventTypes.SETTINGS_CHANGED && event.payload) {
        const payload = event.payload as SettingsChangedPayload
        setSettings((prev) => (prev ? { ...prev, [payload.key]: payload.value } : null))
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const handleToggleTransform = async (transformKey: string): Promise<void> => {
    if (!settings) return

    const key = `transforms.${transformKey}.enabled`
    const currentValue = settings[key] === 'true'
    const newValue = !currentValue

    setSaving(true)
    try {
      const response = await window.clipmorph.setSetting(key, String(newValue))
      if (isIpcSuccess(response)) {
        setSettings((prev) => (prev ? { ...prev, [key]: String(newValue) } : null))
      }
    } catch (err) {
      console.error('Failed to update setting:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleResetAll = async (): Promise<void> => {
    setSaving(true)
    try {
      const response = await window.clipmorph.resetSettings()
      if (isIpcSuccess(response)) {
        // Refetch settings
        const settingsResponse = await window.clipmorph.getAllSettings()
        if (isIpcSuccess(settingsResponse)) {
          setSettings(settingsResponse.data.settings as SettingsData)
        }
      }
    } catch (err) {
      console.error('Failed to reset settings:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleEditHotkey = (): void => {
    setEditingHotkey(true)
    setHotkeyInput(settings?.['hotkey.pushToTalk'] || '')
    setHotkeyError(null)
  }

  const handleCancelHotkey = (): void => {
    setEditingHotkey(false)
    setHotkeyInput('')
    setHotkeyError(null)
  }

  const handleSaveHotkey = async (): Promise<void> => {
    if (!hotkeyInput.trim()) {
      setHotkeyError('Hotkey cannot be empty')
      return
    }

    setSaving(true)
    setHotkeyError(null)

    try {
      const response = await window.clipmorph.setVoiceHotkey(hotkeyInput.trim())
      if (isIpcSuccess(response)) {
        if (response.data.success) {
          setSettings((prev) =>
            prev ? { ...prev, 'hotkey.pushToTalk': response.data.hotkey } : null
          )
          setEditingHotkey(false)
          setHotkeyInput('')
        } else {
          setHotkeyError(response.data.error || 'Failed to set hotkey')
        }
      } else {
        setHotkeyError(response.error.message)
      }
    } catch (err) {
      setHotkeyError('Failed to save hotkey')
      console.error('Failed to save hotkey:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleHotkeyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    // Build hotkey string from key event
    e.preventDefault()

    const parts: string[] = []
    if (e.metaKey) parts.push('Cmd')
    if (e.ctrlKey) parts.push('Ctrl')
    if (e.altKey) parts.push('Alt')
    if (e.shiftKey) parts.push('Shift')

    // Get the key (ignore modifier-only presses)
    const key = e.key
    if (!['Meta', 'Control', 'Alt', 'Shift'].includes(key)) {
      // Convert key to accelerator format
      let keyName = key.length === 1 ? key.toUpperCase() : key
      if (key === ' ') keyName = 'Space'
      if (key === 'Escape') keyName = 'Esc'

      parts.push(keyName)
      setHotkeyInput(parts.join('+'))
    }
  }

  // API Key handlers
  const handleEditApiKey = (): void => {
    setEditingApiKey(true)
    setApiKeyInput('')
    setApiKeyError(null)
  }

  const handleCancelApiKey = (): void => {
    setEditingApiKey(false)
    setApiKeyInput('')
    setApiKeyError(null)
  }

  const handleSaveApiKey = async (): Promise<void> => {
    const trimmedKey = apiKeyInput.trim()
    if (!trimmedKey) {
      setApiKeyError('API key cannot be empty')
      return
    }

    // Basic validation for OpenAI key format
    if (!trimmedKey.startsWith('sk-')) {
      setApiKeyError('OpenAI API key should start with "sk-"')
      return
    }

    setApiKeySaving(true)
    setApiKeyError(null)

    try {
      const response = await window.clipmorph.setSecret('openai-api-key', trimmedKey)
      if (isIpcSuccess(response)) {
        if (response.data.success) {
          // Refresh the masked key display
          const secretResponse = await window.clipmorph.getSecret('openai-api-key')
          if (isIpcSuccess(secretResponse)) {
            setHasApiKey(secretResponse.data.hasValue)
            setMaskedApiKey(secretResponse.data.maskedValue || null)
          }
          setEditingApiKey(false)
          setApiKeyInput('')
        } else {
          setApiKeyError('Failed to save API key')
        }
      } else {
        setApiKeyError(response.error.message)
      }
    } catch (err) {
      setApiKeyError('Failed to save API key')
      console.error('Failed to save API key:', err)
    } finally {
      setApiKeySaving(false)
    }
  }

  const handleDeleteApiKey = async (): Promise<void> => {
    if (!confirm('Are you sure you want to delete your API key?')) {
      return
    }

    setApiKeySaving(true)
    try {
      const response = await window.clipmorph.deleteSecret('openai-api-key')
      if (isIpcSuccess(response)) {
        setHasApiKey(false)
        setMaskedApiKey(null)
      }
    } catch (err) {
      console.error('Failed to delete API key:', err)
    } finally {
      setApiKeySaving(false)
    }
  }

  // Cerebras API Key handlers
  const handleEditCerebrasKey = (): void => {
    setEditingCerebrasKey(true)
    setCerebrasKeyInput('')
    setCerebrasKeyError(null)
  }

  const handleCancelCerebrasKey = (): void => {
    setEditingCerebrasKey(false)
    setCerebrasKeyInput('')
    setCerebrasKeyError(null)
  }

  const handleSaveCerebrasKey = async (): Promise<void> => {
    const trimmedKey = cerebrasKeyInput.trim()
    if (!trimmedKey) {
      setCerebrasKeyError('API key cannot be empty')
      return
    }

    // Basic validation for Cerebras key format
    if (!trimmedKey.startsWith('csk-')) {
      setCerebrasKeyError('Cerebras API key should start with "csk-"')
      return
    }

    setCerebrasKeySaving(true)
    setCerebrasKeyError(null)

    try {
      const response = await window.clipmorph.setSecret('cerebras-api-key', trimmedKey)
      if (isIpcSuccess(response)) {
        if (response.data.success) {
          // Refresh the masked key display
          const secretResponse = await window.clipmorph.getSecret('cerebras-api-key')
          if (isIpcSuccess(secretResponse)) {
            setHasCerebrasKey(secretResponse.data.hasValue)
            setMaskedCerebrasKey(secretResponse.data.maskedValue || null)
          }
          setEditingCerebrasKey(false)
          setCerebrasKeyInput('')
        } else {
          setCerebrasKeyError('Failed to save API key')
        }
      } else {
        setCerebrasKeyError(response.error.message)
      }
    } catch (err) {
      setCerebrasKeyError('Failed to save API key')
      console.error('Failed to save Cerebras API key:', err)
    } finally {
      setCerebrasKeySaving(false)
    }
  }

  const handleDeleteCerebrasKey = async (): Promise<void> => {
    if (!confirm('Are you sure you want to delete your Cerebras API key?')) {
      return
    }

    setCerebrasKeySaving(true)
    try {
      const response = await window.clipmorph.deleteSecret('cerebras-api-key')
      if (isIpcSuccess(response)) {
        setHasCerebrasKey(false)
        setMaskedCerebrasKey(null)
      }
    } catch (err) {
      console.error('Failed to delete Cerebras API key:', err)
    } finally {
      setCerebrasKeySaving(false)
    }
  }

  if (loading) {
    return (
      <div className="settings-overlay">
        <div className="settings-panel">
          <div className="settings-loading">Loading settings...</div>
        </div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="settings-overlay">
        <div className="settings-panel">
          <div className="settings-error">Failed to load settings</div>
          <button className="settings-close-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="settings-overlay">
      <div className="settings-panel">
        <header className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="settings-content">
          <section className="settings-section">
            <h3>API Keys</h3>
            <p className="settings-hint">Stored securely in macOS Keychain</p>
            
            {/* Cerebras API Key (preferred for browser agent) */}
            <div className="setting-row api-key-row">
              <label>Cerebras API Key <span className="key-hint">(Browser Agent - faster)</span></label>
              {editingCerebrasKey ? (
                <div className="api-key-editor">
                  <input
                    type="password"
                    className="api-key-input"
                    value={cerebrasKeyInput}
                    onChange={(e) => setCerebrasKeyInput(e.target.value)}
                    placeholder="csk-..."
                    autoFocus
                  />
                  <div className="api-key-actions">
                    <button
                      className="api-key-save-btn"
                      onClick={handleSaveCerebrasKey}
                      disabled={cerebrasKeySaving || !cerebrasKeyInput}
                    >
                      {cerebrasKeySaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      className="api-key-cancel-btn"
                      onClick={handleCancelCerebrasKey}
                      disabled={cerebrasKeySaving}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="api-key-display">
                  {hasCerebrasKey ? (
                    <>
                      <span className="api-key-masked">{maskedCerebrasKey}</span>
                      <button className="api-key-edit-btn" onClick={handleEditCerebrasKey}>
                        Change
                      </button>
                      <button 
                        className="api-key-delete-btn" 
                        onClick={handleDeleteCerebrasKey}
                        disabled={cerebrasKeySaving}
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="api-key-missing">Not configured</span>
                      <button className="api-key-add-btn" onClick={handleEditCerebrasKey}>
                        Add Key
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            {cerebrasKeyError && <div className="api-key-error">{cerebrasKeyError}</div>}
            
            {/* OpenAI API Key */}
            <div className="setting-row api-key-row">
              <label>OpenAI API Key <span className="key-hint">(Voice & Fallback)</span></label>
              {editingApiKey ? (
                <div className="api-key-editor">
                  <input
                    type="password"
                    className="api-key-input"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="sk-..."
                    autoFocus
                  />
                  <div className="api-key-actions">
                    <button
                      className="api-key-save-btn"
                      onClick={handleSaveApiKey}
                      disabled={apiKeySaving || !apiKeyInput}
                    >
                      {apiKeySaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      className="api-key-cancel-btn"
                      onClick={handleCancelApiKey}
                      disabled={apiKeySaving}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="api-key-display">
                  {hasApiKey ? (
                    <>
                      <span className="api-key-masked">{maskedApiKey}</span>
                      <button className="api-key-edit-btn" onClick={handleEditApiKey}>
                        Change
                      </button>
                      <button 
                        className="api-key-delete-btn" 
                        onClick={handleDeleteApiKey}
                        disabled={apiKeySaving}
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="api-key-missing">Not configured</span>
                      <button className="api-key-add-btn" onClick={handleEditApiKey}>
                        Add Key
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            {apiKeyError && <div className="api-key-error">{apiKeyError}</div>}
          </section>

          <section className="settings-section">
            <h3>Browser Agent Model</h3>
            <p className="settings-hint">Cerebras model for browser automation (requires Cerebras API key)</p>
            <div className="setting-row model-row">
              <label>Model</label>
              <select
                className="model-select"
                value={settings['cerebras.model'] || 'qwen-3-32b'}
                onChange={async (e) => {
                  const newModel = e.target.value
                  setSettings((prev) => prev ? { ...prev, 'cerebras.model': newModel } : null)
                  await window.clipmorph.setSetting('cerebras.model', newModel)
                }}
              >
                {CEREBRAS_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} ({model.params}) - {model.speed}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="settings-section">
            <h3>Hotkey</h3>
            <div className="setting-row hotkey-row">
              <label>Push-to-Talk</label>
              {editingHotkey ? (
                <div className="hotkey-editor">
                  <input
                    type="text"
                    className="hotkey-input"
                    value={hotkeyInput}
                    onKeyDown={handleHotkeyKeyDown}
                    placeholder="Press keys..."
                    readOnly
                    autoFocus
                  />
                  <div className="hotkey-actions">
                    <button
                      className="hotkey-save-btn"
                      onClick={handleSaveHotkey}
                      disabled={saving || !hotkeyInput}
                    >
                      Save
                    </button>
                    <button
                      className="hotkey-cancel-btn"
                      onClick={handleCancelHotkey}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button className="hotkey-display clickable" onClick={handleEditHotkey}>
                  {settings['hotkey.pushToTalk']}
                </button>
              )}
            </div>
            {hotkeyError && <div className="hotkey-error">{hotkeyError}</div>}
          </section>

          <section className="settings-section">
            <h3>Transforms</h3>
            <p className="settings-hint">Enable or disable transform capabilities</p>
            {Object.entries(TRANSFORM_LABELS).map(([key, label]) => {
              const settingKey = `transforms.${key}.enabled`
              const enabled = settings[settingKey] === 'true'
              return (
                <div className="setting-row" key={key}>
                  <label htmlFor={`transform-${key}`}>{label}</label>
                  <button
                    id={`transform-${key}`}
                    className={`toggle-btn ${enabled ? 'on' : 'off'}`}
                    onClick={() => handleToggleTransform(key)}
                    disabled={saving}
                    aria-pressed={enabled}
                  >
                    {enabled ? 'ON' : 'OFF'}
                  </button>
                </div>
              )
            })}
          </section>

          <section className="settings-section">
            <h3>Theme</h3>
            <div className="setting-row">
              <label>UI Theme</label>
              <span className="theme-display">{settings['ui.theme']}</span>
            </div>
          </section>
        </div>

        <footer className="settings-footer">
          <button className="reset-btn" onClick={handleResetAll} disabled={saving}>
            Reset All
          </button>
        </footer>
      </div>
    </div>
  )
}

export default Settings

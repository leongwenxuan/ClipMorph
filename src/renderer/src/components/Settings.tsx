/**
 * Settings Component
 *
 * Displays and manages ClipMorph settings
 */

import { useState, useEffect } from 'react'
import { isIpcSuccess, EventTypes, SettingsChangedPayload, SecretKey } from '../../../../packages/contracts/src'
import { X, Key, Settings as SettingsIcon, Keyboard, Info } from 'lucide-react'
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
  'ui.autoCompactOnBlur': string
  'voice.noiseSuppression': string
  'cerebras.model': string
  'opencode.provider': string
  'opencode.model': string
  [key: string]: string
}

// Available Cerebras models
const CEREBRAS_MODELS = [
  { id: 'llama3.1-8b', name: 'Llama 3.1 8B', params: '8B', speed: '~2200 t/s' },
  { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', params: '70B', speed: '~2100 t/s' },
  { id: 'gpt-oss-120b', name: 'OpenAI GPT OSS', params: '120B', speed: '~3000 t/s' },
  { id: 'qwen-3-32b', name: 'Qwen 3 32B', params: '32B', speed: '~2600 t/s' },
]

// Available OpenCode providers and their models
const OPENCODE_PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Recommended - Best balance' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most capable' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Fastest' },
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Latest multimodal model' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Faster, cheaper' },
      { id: 'o1', name: 'o1', description: 'Advanced reasoning' },
      { id: 'o1-mini', name: 'o1 Mini', description: 'Faster reasoning' },
    ]
  },
  {
    id: 'google',
    name: 'Google',
    models: [
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', description: 'Experimental preview' },
      { id: 'gemini-1.5-pro-002', name: 'Gemini 1.5 Pro', description: 'Most capable' },
      { id: 'gemini-1.5-flash-002', name: 'Gemini 1.5 Flash', description: 'Fastest' },
    ]
  },
  {
    id: 'xai',
    name: 'xAI',
    models: [
      { id: 'grok-2-1212', name: 'Grok 2', description: 'Latest model' },
      { id: 'grok-2-vision-1212', name: 'Grok 2 Vision', description: 'With vision capabilities' },
    ]
  },
  {
    id: 'zai',
    name: 'Z.AI (GLM)',
    models: [
      { id: 'glm-4.7', name: 'GLM-4.7', description: 'GLM Coding Plan model' },
      { id: 'glm-4.6', name: 'GLM-4.6', description: 'Previous generation' },
    ]
  },
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

  // Anthropic API Key state
  const [hasAnthropicKey, setHasAnthropicKey] = useState(false)
  const [maskedAnthropicKey, setMaskedAnthropicKey] = useState<string | null>(null)
  const [editingAnthropicKey, setEditingAnthropicKey] = useState(false)
  const [anthropicKeyInput, setAnthropicKeyInput] = useState('')
  const [anthropicKeyError, setAnthropicKeyError] = useState<string | null>(null)
  const [anthropicKeySaving, setAnthropicKeySaving] = useState(false)

  // Google API Key state
  const [hasGoogleKey, setHasGoogleKey] = useState(false)
  const [maskedGoogleKey, setMaskedGoogleKey] = useState<string | null>(null)
  const [editingGoogleKey, setEditingGoogleKey] = useState(false)
  const [googleKeyInput, setGoogleKeyInput] = useState('')
  const [googleKeyError, setGoogleKeyError] = useState<string | null>(null)
  const [googleKeySaving, setGoogleKeySaving] = useState(false)

  // xAI API Key state
  const [hasXaiKey, setHasXaiKey] = useState(false)
  const [maskedXaiKey, setMaskedXaiKey] = useState<string | null>(null)
  const [editingXaiKey, setEditingXaiKey] = useState(false)
  const [xaiKeyInput, setXaiKeyInput] = useState('')
  const [xaiKeyError, setXaiKeyError] = useState<string | null>(null)
  const [xaiKeySaving, setXaiKeySaving] = useState(false)

  // Z.AI API Key state
  const [hasZaiKey, setHasZaiKey] = useState(false)
  const [maskedZaiKey, setMaskedZaiKey] = useState<string | null>(null)
  const [editingZaiKey, setEditingZaiKey] = useState(false)
  const [zaiKeyInput, setZaiKeyInput] = useState('')
  const [zaiKeyError, setZaiKeyError] = useState<string | null>(null)
  const [zaiKeySaving, setZaiKeySaving] = useState(false)

  // Groq API Key state (for Whisper STT)
  const [hasGroqKey, setHasGroqKey] = useState(false)
  const [maskedGroqKey, setMaskedGroqKey] = useState<string | null>(null)
  const [editingGroqKey, setEditingGroqKey] = useState(false)
  const [groqKeyInput, setGroqKeyInput] = useState('')
  const [groqKeyError, setGroqKeyError] = useState<string | null>(null)
  const [groqKeySaving, setGroqKeySaving] = useState(false)

  // ElevenLabs API Key state (for streaming STT)
  const [hasElevenLabsKey, setHasElevenLabsKey] = useState(false)
  const [maskedElevenLabsKey, setMaskedElevenLabsKey] = useState<string | null>(null)
  const [editingElevenLabsKey, setEditingElevenLabsKey] = useState(false)
  const [elevenLabsKeyInput, setElevenLabsKeyInput] = useState('')
  const [elevenLabsKeyError, setElevenLabsKeyError] = useState<string | null>(null)
  const [elevenLabsKeySaving, setElevenLabsKeySaving] = useState(false)

  // Audio device state
  const [audioDevices, setAudioDevices] = useState<{ id: string; name: string }[]>([])
  const [currentAudioDevice, setCurrentAudioDevice] = useState<string>('')
  const [loadingDevices, setLoadingDevices] = useState(false)

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

        // Fetch Anthropic API key status
        const anthropicResponse = await window.clipmorph.getSecret('anthropic-api-key')
        if (isIpcSuccess(anthropicResponse)) {
          setHasAnthropicKey(anthropicResponse.data.hasValue)
          setMaskedAnthropicKey(anthropicResponse.data.maskedValue || null)
        }

        // Fetch Google API key status
        const googleResponse = await window.clipmorph.getSecret('google-api-key')
        if (isIpcSuccess(googleResponse)) {
          setHasGoogleKey(googleResponse.data.hasValue)
          setMaskedGoogleKey(googleResponse.data.maskedValue || null)
        }

        // Fetch xAI API key status
        const xaiResponse = await window.clipmorph.getSecret('xai-api-key')
        if (isIpcSuccess(xaiResponse)) {
          setHasXaiKey(xaiResponse.data.hasValue)
          setMaskedXaiKey(xaiResponse.data.maskedValue || null)
        }

        // Fetch Z.AI API key status
        const zaiResponse = await window.clipmorph.getSecret('zai-api-key')
        if (isIpcSuccess(zaiResponse)) {
          setHasZaiKey(zaiResponse.data.hasValue)
          setMaskedZaiKey(zaiResponse.data.maskedValue || null)
        }

        // Fetch Groq API key status (for Whisper STT)
        const groqResponse = await window.clipmorph.getSecret('groq-api-key')
        if (isIpcSuccess(groqResponse)) {
          setHasGroqKey(groqResponse.data.hasValue)
          setMaskedGroqKey(groqResponse.data.maskedValue || null)
        }

        // Fetch ElevenLabs API key status (for streaming STT)
        const elevenLabsResponse = await window.clipmorph.getSecret('elevenlabs-api-key')
        if (isIpcSuccess(elevenLabsResponse)) {
          setHasElevenLabsKey(elevenLabsResponse.data.hasValue)
          setMaskedElevenLabsKey(elevenLabsResponse.data.maskedValue || null)
        }

        // Fetch audio input devices
        const devicesResponse = await window.clipmorph.listInputDevices()
        if (isIpcSuccess(devicesResponse)) {
          setAudioDevices(devicesResponse.data.devices || [])
        }

        // Fetch current audio device setting
        const deviceResponse = await window.clipmorph.getInputDevice()
        if (isIpcSuccess(deviceResponse)) {
          setCurrentAudioDevice(deviceResponse.data.device || '')
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

  // Anthropic API Key handlers
  const handleEditAnthropicKey = (): void => {
    setEditingAnthropicKey(true)
    setAnthropicKeyInput('')
    setAnthropicKeyError(null)
  }

  const handleCancelAnthropicKey = (): void => {
    setEditingAnthropicKey(false)
    setAnthropicKeyInput('')
    setAnthropicKeyError(null)
  }

  const handleSaveAnthropicKey = async (): Promise<void> => {
    const trimmedKey = anthropicKeyInput.trim()
    if (!trimmedKey) {
      setAnthropicKeyError('API key cannot be empty')
      return
    }

    setAnthropicKeySaving(true)
    setAnthropicKeyError(null)

    try {
      const response = await window.clipmorph.setSecret('anthropic-api-key', trimmedKey)
      if (isIpcSuccess(response)) {
        if (response.data.success) {
          const secretResponse = await window.clipmorph.getSecret('anthropic-api-key')
          if (isIpcSuccess(secretResponse)) {
            setHasAnthropicKey(secretResponse.data.hasValue)
            setMaskedAnthropicKey(secretResponse.data.maskedValue || null)
          }
          setEditingAnthropicKey(false)
          setAnthropicKeyInput('')
        } else {
          setAnthropicKeyError('Failed to save API key')
        }
      } else {
        setAnthropicKeyError(response.error.message)
      }
    } catch (err) {
      setAnthropicKeyError('Failed to save API key')
      console.error('Failed to save Anthropic API key:', err)
    } finally {
      setAnthropicKeySaving(false)
    }
  }

  const handleDeleteAnthropicKey = async (): Promise<void> => {
    if (!confirm('Are you sure you want to delete your Anthropic API key?')) {
      return
    }

    setAnthropicKeySaving(true)
    try {
      const response = await window.clipmorph.deleteSecret('anthropic-api-key')
      if (isIpcSuccess(response)) {
        setHasAnthropicKey(false)
        setMaskedAnthropicKey(null)
      }
    } catch (err) {
      console.error('Failed to delete Anthropic API key:', err)
    } finally {
      setAnthropicKeySaving(false)
    }
  }

  // Google API Key handlers
  const handleEditGoogleKey = (): void => {
    setEditingGoogleKey(true)
    setGoogleKeyInput('')
    setGoogleKeyError(null)
  }

  const handleCancelGoogleKey = (): void => {
    setEditingGoogleKey(false)
    setGoogleKeyInput('')
    setGoogleKeyError(null)
  }

  const handleSaveGoogleKey = async (): Promise<void> => {
    const trimmedKey = googleKeyInput.trim()
    if (!trimmedKey) {
      setGoogleKeyError('API key cannot be empty')
      return
    }

    setGoogleKeySaving(true)
    setGoogleKeyError(null)

    try {
      const response = await window.clipmorph.setSecret('google-api-key', trimmedKey)
      if (isIpcSuccess(response)) {
        if (response.data.success) {
          const secretResponse = await window.clipmorph.getSecret('google-api-key')
          if (isIpcSuccess(secretResponse)) {
            setHasGoogleKey(secretResponse.data.hasValue)
            setMaskedGoogleKey(secretResponse.data.maskedValue || null)
          }
          setEditingGoogleKey(false)
          setGoogleKeyInput('')
        } else {
          setGoogleKeyError('Failed to save API key')
        }
      } else {
        setGoogleKeyError(response.error.message)
      }
    } catch (err) {
      setGoogleKeyError('Failed to save API key')
      console.error('Failed to save Google API key:', err)
    } finally {
      setGoogleKeySaving(false)
    }
  }

  const handleDeleteGoogleKey = async (): Promise<void> => {
    if (!confirm('Are you sure you want to delete your Google API key?')) {
      return
    }

    setGoogleKeySaving(true)
    try {
      const response = await window.clipmorph.deleteSecret('google-api-key')
      if (isIpcSuccess(response)) {
        setHasGoogleKey(false)
        setMaskedGoogleKey(null)
      }
    } catch (err) {
      console.error('Failed to delete Google API key:', err)
    } finally {
      setGoogleKeySaving(false)
    }
  }

  // xAI API Key handlers
  const handleEditXaiKey = (): void => {
    setEditingXaiKey(true)
    setXaiKeyInput('')
    setXaiKeyError(null)
  }

  const handleCancelXaiKey = (): void => {
    setEditingXaiKey(false)
    setXaiKeyInput('')
    setXaiKeyError(null)
  }

  const handleSaveXaiKey = async (): Promise<void> => {
    const trimmedKey = xaiKeyInput.trim()
    if (!trimmedKey) {
      setXaiKeyError('API key cannot be empty')
      return
    }

    setXaiKeySaving(true)
    setXaiKeyError(null)

    try {
      const response = await window.clipmorph.setSecret('xai-api-key', trimmedKey)
      if (isIpcSuccess(response)) {
        if (response.data.success) {
          const secretResponse = await window.clipmorph.getSecret('xai-api-key')
          if (isIpcSuccess(secretResponse)) {
            setHasXaiKey(secretResponse.data.hasValue)
            setMaskedXaiKey(secretResponse.data.maskedValue || null)
          }
          setEditingXaiKey(false)
          setXaiKeyInput('')
        } else {
          setXaiKeyError('Failed to save API key')
        }
      } else {
        setXaiKeyError(response.error.message)
      }
    } catch (err) {
      setXaiKeyError('Failed to save API key')
      console.error('Failed to save xAI API key:', err)
    } finally {
      setXaiKeySaving(false)
    }
  }

  const handleDeleteXaiKey = async (): Promise<void> => {
    if (!confirm('Are you sure you want to delete your xAI API key?')) {
      return
    }

    setXaiKeySaving(true)
    try {
      const response = await window.clipmorph.deleteSecret('xai-api-key')
      if (isIpcSuccess(response)) {
        setHasXaiKey(false)
        setMaskedXaiKey(null)
      }
    } catch (err) {
      console.error('Failed to delete xAI API key:', err)
    } finally {
      setXaiKeySaving(false)
    }
  }

  // Z.AI API Key handlers
  const handleEditZaiKey = (): void => {
    setEditingZaiKey(true)
    setZaiKeyInput('')
    setZaiKeyError(null)
  }

  const handleCancelZaiKey = (): void => {
    setEditingZaiKey(false)
    setZaiKeyInput('')
    setZaiKeyError(null)
  }

  const handleSaveZaiKey = async (): Promise<void> => {
    const trimmedKey = zaiKeyInput.trim()
    if (!trimmedKey) {
      setZaiKeyError('API key cannot be empty')
      return
    }

    setZaiKeySaving(true)
    setZaiKeyError(null)

    try {
      const response = await window.clipmorph.setSecret('zai-api-key', trimmedKey)
      if (isIpcSuccess(response)) {
        if (response.data.success) {
          const secretResponse = await window.clipmorph.getSecret('zai-api-key')
          if (isIpcSuccess(secretResponse)) {
            setHasZaiKey(secretResponse.data.hasValue)
            setMaskedZaiKey(secretResponse.data.maskedValue || null)
          }
          setEditingZaiKey(false)
          setZaiKeyInput('')
        } else {
          setZaiKeyError('Failed to save API key')
        }
      } else {
        setZaiKeyError(response.error.message)
      }
    } catch (err) {
      setZaiKeyError('Failed to save API key')
      console.error('Failed to save Z.AI API key:', err)
    } finally {
      setZaiKeySaving(false)
    }
  }

  const handleDeleteZaiKey = async (): Promise<void> => {
    if (!confirm('Are you sure you want to delete your Z.AI API key?')) {
      return
    }

    setZaiKeySaving(true)
    try {
      const response = await window.clipmorph.deleteSecret('zai-api-key')
      if (isIpcSuccess(response)) {
        setHasZaiKey(false)
        setMaskedZaiKey(null)
      }
    } catch (err) {
      console.error('Failed to delete Z.AI API key:', err)
    } finally {
      setZaiKeySaving(false)
    }
  }

  // Groq API Key handlers (for Whisper STT)
  const handleEditGroqKey = (): void => {
    setEditingGroqKey(true)
    setGroqKeyInput('')
    setGroqKeyError(null)
  }

  const handleCancelGroqKey = (): void => {
    setEditingGroqKey(false)
    setGroqKeyInput('')
    setGroqKeyError(null)
  }

  const handleSaveGroqKey = async (): Promise<void> => {
    const trimmedKey = groqKeyInput.trim()
    if (!trimmedKey) {
      setGroqKeyError('API key cannot be empty')
      return
    }

    setGroqKeySaving(true)
    setGroqKeyError(null)

    try {
      const response = await window.clipmorph.setSecret('groq-api-key', trimmedKey)
      if (isIpcSuccess(response)) {
        if (response.data.success) {
          const secretResponse = await window.clipmorph.getSecret('groq-api-key')
          if (isIpcSuccess(secretResponse)) {
            setHasGroqKey(secretResponse.data.hasValue)
            setMaskedGroqKey(secretResponse.data.maskedValue || null)
          }
          setEditingGroqKey(false)
          setGroqKeyInput('')
        } else {
          setGroqKeyError('Failed to save API key')
        }
      } else {
        setGroqKeyError(response.error.message)
      }
    } catch (err) {
      setGroqKeyError('Failed to save API key')
      console.error('Failed to save Groq API key:', err)
    } finally {
      setGroqKeySaving(false)
    }
  }

  const handleDeleteGroqKey = async (): Promise<void> => {
    if (!confirm('Are you sure you want to delete your Groq API key?')) {
      return
    }

    setGroqKeySaving(true)
    try {
      const response = await window.clipmorph.deleteSecret('groq-api-key')
      if (isIpcSuccess(response)) {
        setHasGroqKey(false)
        setMaskedGroqKey(null)
      }
    } catch (err) {
      console.error('Failed to delete Groq API key:', err)
    } finally {
      setGroqKeySaving(false)
    }
  }

  // ElevenLabs API Key handlers (for streaming STT)
  const handleEditElevenLabsKey = (): void => {
    setEditingElevenLabsKey(true)
    setElevenLabsKeyInput('')
    setElevenLabsKeyError(null)
  }

  const handleCancelElevenLabsKey = (): void => {
    setEditingElevenLabsKey(false)
    setElevenLabsKeyInput('')
    setElevenLabsKeyError(null)
  }

  const handleSaveElevenLabsKey = async (): Promise<void> => {
    const trimmedKey = elevenLabsKeyInput.trim()
    if (!trimmedKey) {
      setElevenLabsKeyError('API key cannot be empty')
      return
    }

    setElevenLabsKeySaving(true)
    setElevenLabsKeyError(null)

    try {
      const response = await window.clipmorph.setSecret('elevenlabs-api-key', trimmedKey)
      if (isIpcSuccess(response)) {
        if (response.data.success) {
          const secretResponse = await window.clipmorph.getSecret('elevenlabs-api-key')
          if (isIpcSuccess(secretResponse)) {
            setHasElevenLabsKey(secretResponse.data.hasValue)
            setMaskedElevenLabsKey(secretResponse.data.maskedValue || null)
          }
          setEditingElevenLabsKey(false)
          setElevenLabsKeyInput('')
        } else {
          setElevenLabsKeyError('Failed to save API key')
        }
      } else {
        setElevenLabsKeyError(response.error.message)
      }
    } catch (err) {
      setElevenLabsKeyError('Failed to save API key')
      console.error('Failed to save ElevenLabs API key:', err)
    } finally {
      setElevenLabsKeySaving(false)
    }
  }

  const handleDeleteElevenLabsKey = async (): Promise<void> => {
    if (!confirm('Are you sure you want to delete your ElevenLabs API key?')) {
      return
    }

    setElevenLabsKeySaving(true)
    try {
      const response = await window.clipmorph.deleteSecret('elevenlabs-api-key')
      if (isIpcSuccess(response)) {
        setHasElevenLabsKey(false)
        setMaskedElevenLabsKey(null)
      }
    } catch (err) {
      console.error('Failed to delete ElevenLabs API key:', err)
    } finally {
      setElevenLabsKeySaving(false)
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
          <h2><SettingsIcon size={18} className="header-icon" /> Settings</h2>
          <button className="settings-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
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

            {/* Groq API Key (for Whisper STT) */}
            <div className="setting-row api-key-row">
              <label>Groq API Key <span className="key-hint">(Fast Voice - Whisper)</span></label>
              {editingGroqKey ? (
                <div className="api-key-editor">
                  <input
                    type="password"
                    className="api-key-input"
                    value={groqKeyInput}
                    onChange={(e) => setGroqKeyInput(e.target.value)}
                    placeholder="gsk_..."
                    autoFocus
                  />
                  <div className="api-key-actions">
                    <button
                      className="api-key-save-btn"
                      onClick={handleSaveGroqKey}
                      disabled={groqKeySaving || !groqKeyInput}
                    >
                      {groqKeySaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      className="api-key-cancel-btn"
                      onClick={handleCancelGroqKey}
                      disabled={groqKeySaving}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="api-key-display">
                  {hasGroqKey ? (
                    <>
                      <span className="api-key-masked">{maskedGroqKey}</span>
                      <button className="api-key-edit-btn" onClick={handleEditGroqKey}>
                        Change
                      </button>
                      <button 
                        className="api-key-delete-btn" 
                        onClick={handleDeleteGroqKey}
                        disabled={groqKeySaving}
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="api-key-missing">Not configured</span>
                      <button className="api-key-add-btn" onClick={handleEditGroqKey}>
                        Add Key
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            {groqKeyError && <div className="api-key-error">{groqKeyError}</div>}

            {/* ElevenLabs API Key (for streaming STT) */}
            <div className="setting-row api-key-row">
              <label>ElevenLabs API Key <span className="key-hint">(Live Voice - Streaming)</span></label>
              {editingElevenLabsKey ? (
                <div className="api-key-editor">
                  <input
                    type="password"
                    className="api-key-input"
                    value={elevenLabsKeyInput}
                    onChange={(e) => setElevenLabsKeyInput(e.target.value)}
                    placeholder="xi_..."
                    autoFocus
                  />
                  <div className="api-key-actions">
                    <button
                      className="api-key-save-btn"
                      onClick={handleSaveElevenLabsKey}
                      disabled={elevenLabsKeySaving || !elevenLabsKeyInput}
                    >
                      {elevenLabsKeySaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      className="api-key-cancel-btn"
                      onClick={handleCancelElevenLabsKey}
                      disabled={elevenLabsKeySaving}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="api-key-display">
                  {hasElevenLabsKey ? (
                    <>
                      <span className="api-key-masked">{maskedElevenLabsKey}</span>
                      <button className="api-key-edit-btn" onClick={handleEditElevenLabsKey}>
                        Change
                      </button>
                      <button 
                        className="api-key-delete-btn" 
                        onClick={handleDeleteElevenLabsKey}
                        disabled={elevenLabsKeySaving}
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="api-key-missing">Not configured</span>
                      <button className="api-key-add-btn" onClick={handleEditElevenLabsKey}>
                        Add Key
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            {elevenLabsKeyError && <div className="api-key-error">{elevenLabsKeyError}</div>}
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
            <h3>OpenCode LLM</h3>
            <p className="settings-hint">Configure provider and model for OpenCode AI coding assistant</p>

            <div className="setting-row model-row">
              <label>Provider</label>
              <select
                className="model-select"
                value={settings['opencode.provider'] || 'anthropic'}
                onChange={async (e) => {
                  const newProvider = e.target.value
                  setSettings((prev) => {
                    if (!prev) return null
                    // Reset to first model of new provider
                    const provider = OPENCODE_PROVIDERS.find(p => p.id === newProvider)
                    const firstModel = provider?.models[0]?.id || ''
                    return { ...prev, 'opencode.provider': newProvider, 'opencode.model': firstModel }
                  })
                  await window.clipmorph.setSetting('opencode.provider', newProvider)
                  // Set first model of new provider
                  const provider = OPENCODE_PROVIDERS.find(p => p.id === newProvider)
                  if (provider?.models[0]) {
                    await window.clipmorph.setSetting('opencode.model', provider.models[0].id)
                  }
                }}
              >
                {OPENCODE_PROVIDERS.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="setting-row model-row">
              <label>Model</label>
              <select
                className="model-select"
                value={settings['opencode.model'] || 'claude-3-5-sonnet-20241022'}
                onChange={async (e) => {
                  const newModel = e.target.value
                  setSettings((prev) => prev ? { ...prev, 'opencode.model': newModel } : null)
                  await window.clipmorph.setSetting('opencode.model', newModel)
                }}
              >
                {OPENCODE_PROVIDERS
                  .find(p => p.id === (settings['opencode.provider'] || 'anthropic'))
                  ?.models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} - {model.description}
                    </option>
                  ))}
              </select>
            </div>

            {/* Anthropic API Key */}
            {(settings['opencode.provider'] || 'anthropic') === 'anthropic' && (
              <div className="setting-row api-key-row">
                <label>Anthropic API Key</label>
                {editingAnthropicKey ? (
                  <div className="api-key-editor">
                    <input
                      type="password"
                      className="api-key-input"
                      value={anthropicKeyInput}
                      onChange={(e) => setAnthropicKeyInput(e.target.value)}
                      placeholder="Enter your Anthropic API key"
                      autoFocus
                    />
                    <div className="api-key-actions">
                      <button
                        className="api-key-save-btn"
                        onClick={handleSaveAnthropicKey}
                        disabled={anthropicKeySaving || !anthropicKeyInput.trim()}
                      >
                        Save
                      </button>
                      <button
                        className="api-key-cancel-btn"
                        onClick={handleCancelAnthropicKey}
                        disabled={anthropicKeySaving}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="api-key-display">
                    {hasAnthropicKey ? (
                      <>
                        <span className="api-key-masked">{maskedAnthropicKey}</span>
                        <button className="api-key-edit-btn" onClick={handleEditAnthropicKey}>
                          Change
                        </button>
                        <button
                          className="api-key-delete-btn"
                          onClick={handleDeleteAnthropicKey}
                          disabled={anthropicKeySaving}
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="api-key-missing">Not configured</span>
                        <button className="api-key-add-btn" onClick={handleEditAnthropicKey}>
                          Add Key
                        </button>
                      </>
                    )}
                  </div>
                )}
                {anthropicKeyError && <div className="api-key-error">{anthropicKeyError}</div>}
              </div>
            )}

            {/* OpenAI API Key */}
            {(settings['opencode.provider'] || 'anthropic') === 'openai' && (
              <div className="setting-row api-key-row">
                <label>OpenAI API Key</label>
                {editingApiKey ? (
                  <div className="api-key-editor">
                    <input
                      type="password"
                      className="api-key-input"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="Enter your OpenAI API key (sk-...)"
                      autoFocus
                    />
                    <div className="api-key-actions">
                      <button
                        className="api-key-save-btn"
                        onClick={handleSaveApiKey}
                        disabled={apiKeySaving || !apiKeyInput.trim()}
                      >
                        Save
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
                {apiKeyError && <div className="api-key-error">{apiKeyError}</div>}
              </div>
            )}

            {/* Google API Key */}
            {(settings['opencode.provider'] || 'anthropic') === 'google' && (
              <div className="setting-row api-key-row">
                <label>Google API Key</label>
                {editingGoogleKey ? (
                  <div className="api-key-editor">
                    <input
                      type="password"
                      className="api-key-input"
                      value={googleKeyInput}
                      onChange={(e) => setGoogleKeyInput(e.target.value)}
                      placeholder="Enter your Google API key"
                      autoFocus
                    />
                    <div className="api-key-actions">
                      <button
                        className="api-key-save-btn"
                        onClick={handleSaveGoogleKey}
                        disabled={googleKeySaving || !googleKeyInput.trim()}
                      >
                        Save
                      </button>
                      <button
                        className="api-key-cancel-btn"
                        onClick={handleCancelGoogleKey}
                        disabled={googleKeySaving}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="api-key-display">
                    {hasGoogleKey ? (
                      <>
                        <span className="api-key-masked">{maskedGoogleKey}</span>
                        <button className="api-key-edit-btn" onClick={handleEditGoogleKey}>
                          Change
                        </button>
                        <button
                          className="api-key-delete-btn"
                          onClick={handleDeleteGoogleKey}
                          disabled={googleKeySaving}
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="api-key-missing">Not configured</span>
                        <button className="api-key-add-btn" onClick={handleEditGoogleKey}>
                          Add Key
                        </button>
                      </>
                    )}
                  </div>
                )}
                {googleKeyError && <div className="api-key-error">{googleKeyError}</div>}
              </div>
            )}

            {/* xAI API Key */}
            {(settings['opencode.provider'] || 'anthropic') === 'xai' && (
              <div className="setting-row api-key-row">
                <label>xAI API Key</label>
                {editingXaiKey ? (
                  <div className="api-key-editor">
                    <input
                      type="password"
                      className="api-key-input"
                      value={xaiKeyInput}
                      onChange={(e) => setXaiKeyInput(e.target.value)}
                      placeholder="Enter your xAI API key"
                      autoFocus
                    />
                    <div className="api-key-actions">
                      <button
                        className="api-key-save-btn"
                        onClick={handleSaveXaiKey}
                        disabled={xaiKeySaving || !xaiKeyInput.trim()}
                      >
                        Save
                      </button>
                      <button
                        className="api-key-cancel-btn"
                        onClick={handleCancelXaiKey}
                        disabled={xaiKeySaving}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="api-key-display">
                    {hasXaiKey ? (
                      <>
                        <span className="api-key-masked">{maskedXaiKey}</span>
                        <button className="api-key-edit-btn" onClick={handleEditXaiKey}>
                          Change
                        </button>
                        <button
                          className="api-key-delete-btn"
                          onClick={handleDeleteXaiKey}
                          disabled={xaiKeySaving}
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="api-key-missing">Not configured</span>
                        <button className="api-key-add-btn" onClick={handleEditXaiKey}>
                          Add Key
                        </button>
                      </>
                    )}
                  </div>
                )}
                {xaiKeyError && <div className="api-key-error">{xaiKeyError}</div>}
              </div>
            )}

            {/* Z.AI API Key */}
            {(settings['opencode.provider'] || 'anthropic') === 'zai' && (
              <div className="setting-row api-key-row">
                <label>Z.AI API Key</label>
                {editingZaiKey ? (
                  <div className="api-key-editor">
                    <input
                      type="password"
                      className="api-key-input"
                      value={zaiKeyInput}
                      onChange={(e) => setZaiKeyInput(e.target.value)}
                      placeholder="Enter your Z.AI API key"
                      autoFocus
                    />
                    <div className="api-key-actions">
                      <button
                        className="api-key-save-btn"
                        onClick={handleSaveZaiKey}
                        disabled={zaiKeySaving || !zaiKeyInput.trim()}
                      >
                        Save
                      </button>
                      <button
                        className="api-key-cancel-btn"
                        onClick={handleCancelZaiKey}
                        disabled={zaiKeySaving}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="api-key-display">
                    {hasZaiKey ? (
                      <>
                        <span className="api-key-masked">{maskedZaiKey}</span>
                        <button className="api-key-edit-btn" onClick={handleEditZaiKey}>
                          Change
                        </button>
                        <button
                          className="api-key-delete-btn"
                          onClick={handleDeleteZaiKey}
                          disabled={zaiKeySaving}
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="api-key-missing">Not configured</span>
                        <button className="api-key-add-btn" onClick={handleEditZaiKey}>
                          Add Key
                        </button>
                      </>
                    )}
                  </div>
                )}
                {zaiKeyError && <div className="api-key-error">{zaiKeyError}</div>}
              </div>
            )}
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
            <h3>Behavior</h3>
            <div className="setting-row">
              <label>Auto-compact on blur</label>
              <button
                className={`toggle-btn ${settings['ui.autoCompactOnBlur'] === 'true' ? 'on' : 'off'}`}
                onClick={async () => {
                  const newValue = settings['ui.autoCompactOnBlur'] === 'true' ? 'false' : 'true'
                  setSettings((prev) => prev ? { ...prev, 'ui.autoCompactOnBlur': newValue } : null)
                  await window.clipmorph.setSetting('ui.autoCompactOnBlur', newValue)
                }}
                disabled={saving}
              >
                {settings['ui.autoCompactOnBlur'] === 'true' ? 'On' : 'Off'}
              </button>
            </div>
            <p className="settings-hint">Collapse to compact mode when switching to other apps</p>
          </section>

          <section className="settings-section">
            <h3>Voice Settings</h3>
            <div className="setting-row">
              <label>Audio Input Device</label>
              <div className="select-with-refresh">
                <select
                  value={currentAudioDevice}
                  onChange={async (e) => {
                    const device = e.target.value
                    setCurrentAudioDevice(device)
                    await window.clipmorph.setInputDevice(device)
                  }}
                  disabled={loadingDevices}
                >
                  <option value="">System Default</option>
                  {audioDevices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name}
                    </option>
                  ))}
                </select>
                <button
                  className="refresh-devices-btn"
                  onClick={async () => {
                    setLoadingDevices(true)
                    const response = await window.clipmorph.listInputDevices()
                    if (isIpcSuccess(response)) {
                      setAudioDevices(response.data.devices || [])
                    }
                    setLoadingDevices(false)
                  }}
                  disabled={loadingDevices}
                  title="Refresh device list"
                >
                  {loadingDevices ? '...' : '↻'}
                </button>
              </div>
            </div>
            <p className="settings-hint">Select your microphone. Refresh after connecting Bluetooth devices.</p>
            
            <div className="setting-row">
              <label>Noise Suppression</label>
              <button
                className={`toggle-btn ${settings['voice.noiseSuppression'] === 'true' ? 'on' : 'off'}`}
                onClick={async () => {
                  const newValue = settings['voice.noiseSuppression'] === 'true' ? 'false' : 'true'
                  setSettings((prev) => prev ? { ...prev, 'voice.noiseSuppression': newValue } : null)
                  await window.clipmorph.setSetting('voice.noiseSuppression', newValue)
                }}
                disabled={saving}
              >
                {settings['voice.noiseSuppression'] === 'true' ? 'On' : 'Off'}
              </button>
            </div>
            <p className="settings-hint">Filter out background noise, music, and non-speech sounds (ElevenLabs only). Enable in noisy environments.</p>
          </section>

          <section className="settings-section">
            <h3>About</h3>
            <div className="setting-row">
              <label>Version</label>
              <span className="theme-display">0.1.0</span>
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

/**
 * Secrets Service - macOS Keychain integration via keytar
 *
 * Responsibilities:
 * - Store and retrieve API keys securely in macOS Keychain
 * - Provide typed access to known secret keys
 */

import keytar from 'keytar'

// Service name for Keychain entries
const SERVICE_NAME = 'ClipMorph'

// Known secret keys
export type SecretKey = 'openai-api-key' | 'anthropic-api-key' | 'cerebras-api-key' | 'groq-api-key' | 'elevenlabs-api-key'

class SecretsService {
  /**
   * Store a secret in the Keychain
   */
  async setSecret(key: SecretKey, value: string): Promise<void> {
    await keytar.setPassword(SERVICE_NAME, key, value)
    console.log(`[SecretsService] Stored secret: ${key}`)
  }

  /**
   * Retrieve a secret from the Keychain
   */
  async getSecret(key: SecretKey): Promise<string | null> {
    const value = await keytar.getPassword(SERVICE_NAME, key)
    return value
  }

  /**
   * Delete a secret from the Keychain
   */
  async deleteSecret(key: SecretKey): Promise<boolean> {
    const result = await keytar.deletePassword(SERVICE_NAME, key)
    if (result) {
      console.log(`[SecretsService] Deleted secret: ${key}`)
    }
    return result
  }

  /**
   * Check if a secret exists
   */
  async hasSecret(key: SecretKey): Promise<boolean> {
    const value = await this.getSecret(key)
    return value !== null && value.length > 0
  }

  /**
   * Get OpenAI API key specifically
   */
  async getOpenAIKey(): Promise<string | null> {
    return this.getSecret('openai-api-key')
  }

  /**
   * Set OpenAI API key specifically
   */
  async setOpenAIKey(apiKey: string): Promise<void> {
    return this.setSecret('openai-api-key', apiKey)
  }

  /**
   * Check if OpenAI API key is configured
   */
  async hasOpenAIKey(): Promise<boolean> {
    return this.hasSecret('openai-api-key')
  }

  /**
   * Get Cerebras API key specifically
   */
  async getCerebrasKey(): Promise<string | null> {
    return this.getSecret('cerebras-api-key')
  }

  /**
   * Set Cerebras API key specifically
   */
  async setCerebrasKey(apiKey: string): Promise<void> {
    return this.setSecret('cerebras-api-key', apiKey)
  }

  /**
   * Check if Cerebras API key is configured
   */
  async hasCerebrasKey(): Promise<boolean> {
    return this.hasSecret('cerebras-api-key')
  }

  /**
   * Get Groq API key specifically
   */
  async getGroqKey(): Promise<string | null> {
    return this.getSecret('groq-api-key')
  }

  /**
   * Set Groq API key specifically
   */
  async setGroqKey(apiKey: string): Promise<void> {
    return this.setSecret('groq-api-key', apiKey)
  }

  /**
   * Check if Groq API key is configured
   */
  async hasGroqKey(): Promise<boolean> {
    return this.hasSecret('groq-api-key')
  }

  /**
   * Get ElevenLabs API key specifically
   */
  async getElevenLabsKey(): Promise<string | null> {
    return this.getSecret('elevenlabs-api-key')
  }

  /**
   * Set ElevenLabs API key specifically
   */
  async setElevenLabsKey(apiKey: string): Promise<void> {
    return this.setSecret('elevenlabs-api-key', apiKey)
  }

  /**
   * Check if ElevenLabs API key is configured
   */
  async hasElevenLabsKey(): Promise<boolean> {
    return this.hasSecret('elevenlabs-api-key')
  }
}

// Singleton export
export const secretsService = new SecretsService()

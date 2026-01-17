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
export type SecretKey = 'openai-api-key' | 'anthropic-api-key'

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
}

// Singleton export
export const secretsService = new SecretsService()

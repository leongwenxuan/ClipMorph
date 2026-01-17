/**
 * Document Extractor Service
 * 
 * Extracts text content from PDF and Word documents.
 * Used to get resume content when user copies a file.
 */

import * as fs from 'fs'
import * as path from 'path'
// @ts-expect-error - pdf-parse doesn't have types
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'

export interface DocumentExtractionResult {
  success: boolean
  text: string
  filePath: string
  fileType: 'pdf' | 'docx' | 'doc' | 'txt' | 'unknown'
  error?: string
}

class DocumentExtractorService {
  /**
   * Check if a string looks like a file path
   */
  isFilePath(text: string): boolean {
    if (!text) return false
    const trimmed = text.trim()
    
    // Check for common file path patterns
    // macOS/Linux absolute path
    if (trimmed.startsWith('/')) {
      return fs.existsSync(trimmed)
    }
    
    // Windows absolute path
    if (/^[A-Za-z]:\\/.test(trimmed)) {
      return fs.existsSync(trimmed)
    }
    
    // Home directory path
    if (trimmed.startsWith('~')) {
      const expanded = trimmed.replace('~', process.env.HOME || '')
      return fs.existsSync(expanded)
    }
    
    return false
  }

  /**
   * Check if a file path is a supported document type
   */
  isSupportedDocument(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase()
    return ['.pdf', '.docx', '.doc', '.txt'].includes(ext)
  }

  /**
   * Get the file type from extension
   */
  getFileType(filePath: string): DocumentExtractionResult['fileType'] {
    const ext = path.extname(filePath).toLowerCase()
    switch (ext) {
      case '.pdf':
        return 'pdf'
      case '.docx':
        return 'docx'
      case '.doc':
        return 'doc'
      case '.txt':
        return 'txt'
      default:
        return 'unknown'
    }
  }

  /**
   * Expand home directory in path
   */
  private expandPath(filePath: string): string {
    if (filePath.startsWith('~')) {
      return filePath.replace('~', process.env.HOME || '')
    }
    return filePath
  }

  /**
   * Extract text from a PDF file
   */
  private async extractFromPdf(filePath: string): Promise<string> {
    const dataBuffer = fs.readFileSync(filePath)
    const data = await pdfParse(dataBuffer)
    return data.text
  }

  /**
   * Extract text from a Word document (.docx)
   */
  private async extractFromDocx(filePath: string): Promise<string> {
    const result = await mammoth.extractRawText({ path: filePath })
    return result.value
  }

  /**
   * Extract text from a plain text file
   */
  private extractFromTxt(filePath: string): string {
    return fs.readFileSync(filePath, 'utf-8')
  }

  /**
   * Extract text from a document file
   */
  async extract(filePath: string): Promise<DocumentExtractionResult> {
    const expandedPath = this.expandPath(filePath.trim())
    const fileType = this.getFileType(expandedPath)

    // Check if file exists
    if (!fs.existsSync(expandedPath)) {
      return {
        success: false,
        text: '',
        filePath: expandedPath,
        fileType,
        error: `File not found: ${expandedPath}`,
      }
    }

    try {
      let text = ''

      switch (fileType) {
        case 'pdf':
          text = await this.extractFromPdf(expandedPath)
          break
        case 'docx':
          text = await this.extractFromDocx(expandedPath)
          break
        case 'doc':
          // .doc files are harder to parse, try mammoth anyway
          try {
            text = await this.extractFromDocx(expandedPath)
          } catch {
            return {
              success: false,
              text: '',
              filePath: expandedPath,
              fileType,
              error: 'Old .doc format not supported. Please save as .docx',
            }
          }
          break
        case 'txt':
          text = this.extractFromTxt(expandedPath)
          break
        default:
          return {
            success: false,
            text: '',
            filePath: expandedPath,
            fileType,
            error: `Unsupported file type: ${path.extname(expandedPath)}`,
          }
      }

      // Clean up the text
      text = text
        .replace(/\r\n/g, '\n') // Normalize line endings
        .replace(/\n{3,}/g, '\n\n') // Remove excessive blank lines
        .trim()

      console.log(`[DocumentExtractor] Extracted ${text.length} chars from ${fileType}: ${expandedPath}`)

      return {
        success: true,
        text,
        filePath: expandedPath,
        fileType,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error(`[DocumentExtractor] Failed to extract from ${expandedPath}:`, errorMsg)
      
      return {
        success: false,
        text: '',
        filePath: expandedPath,
        fileType,
        error: errorMsg,
      }
    }
  }

  /**
   * Try to extract document content from clipboard text
   * Returns the extracted text if clipboard contains a file path to a document,
   * otherwise returns the original clipboard text
   */
  async extractFromClipboard(clipboardText: string): Promise<{
    text: string
    isDocument: boolean
    filePath?: string
    fileType?: DocumentExtractionResult['fileType']
  }> {
    if (!clipboardText) {
      return { text: '', isDocument: false }
    }

    const trimmed = clipboardText.trim()

    // Check if it's a file path
    if (!this.isFilePath(trimmed)) {
      return { text: clipboardText, isDocument: false }
    }

    // Check if it's a supported document
    if (!this.isSupportedDocument(trimmed)) {
      return { text: clipboardText, isDocument: false }
    }

    // Extract the document content
    const result = await this.extract(trimmed)

    if (result.success) {
      return {
        text: result.text,
        isDocument: true,
        filePath: result.filePath,
        fileType: result.fileType,
      }
    }

    // Extraction failed, return original text with error info
    console.warn(`[DocumentExtractor] Failed to extract: ${result.error}`)
    return { text: clipboardText, isDocument: false }
  }
}

// Singleton export
export const documentExtractorService = new DocumentExtractorService()

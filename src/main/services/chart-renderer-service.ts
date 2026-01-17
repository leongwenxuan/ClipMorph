/**
 * Chart Renderer Service
 * 
 * Renders charts from table data to PNG images using Playwright.
 * The LLM generates Chart.js config, we render it in a headless browser,
 * and return the image buffer for clipboard.
 */

import { chromium, Browser, Page } from 'playwright'
import OpenAI from 'openai'
import { secretsService } from './secrets-service'

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'area' | 'scatter'
  data: {
    labels: string[]
    datasets: Array<{
      label: string
      data: number[]
      backgroundColor?: string | string[]
      borderColor?: string | string[]
      borderWidth?: number
    }>
  }
  options?: Record<string, unknown>
}

export interface ChartRenderResult {
  success: boolean
  imageBuffer?: Buffer
  error?: string
  chartConfig?: ChartConfig
}

class ChartRendererService {
  private browser: Browser | null = null
  private openaiClient: OpenAI | null = null
  private apiKey: string | null = null

  /**
   * Get or create OpenAI client
   */
  private async getOpenAIClient(): Promise<OpenAI> {
    const currentKey = await secretsService.getOpenAIKey()
    
    if (!currentKey) {
      throw new Error('OpenAI API key not configured')
    }

    if (!this.openaiClient || this.apiKey !== currentKey) {
      this.apiKey = currentKey
      this.openaiClient = new OpenAI({ apiKey: currentKey })
    }

    return this.openaiClient
  }

  /**
   * Get or launch browser instance
   */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      console.log('[ChartRenderer] Launching headless browser...')
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
    }
    return this.browser
  }

  /**
   * Detect if command is a chart request
   */
  isChartRequest(command: string): boolean {
    const chartKeywords = [
      /\bchart\b/i,
      /\bgraph\b/i,
      /\bplot\b/i,
      /\bvisualize\b/i,
      /\bvisualise\b/i,
      /\bbar\s*(chart|graph)?\b/i,
      /\bline\s*(chart|graph)?\b/i,
      /\bpie\s*(chart|graph)?\b/i,
      /\bdoughnut\b/i,
      /\bhistogram\b/i,
      /\bscatter\b/i,
    ]
    return chartKeywords.some(pattern => pattern.test(command))
  }

  /**
   * Parse table data and generate Chart.js config using LLM
   */
  async generateChartConfig(
    command: string,
    tableData: string,
    html?: string
  ): Promise<{ success: boolean; config?: ChartConfig; error?: string }> {
    try {
      const client = await this.getOpenAIClient()

      const dataContext = html 
        ? `[HTML Table]:\n${html}\n\n[Plain Text]:\n${tableData}`
        : tableData

      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a data visualization expert. Convert tabular data into Chart.js configuration.

RULES:
1. Return ONLY valid JSON - no markdown, no explanation, no code blocks
2. Analyze the data to determine the best chart type if not specified
3. Use appropriate colors (use hex codes)
4. Keep labels concise
5. Handle numeric data properly (parse strings to numbers)

OUTPUT FORMAT (strict JSON):
{
  "type": "bar|line|pie|doughnut|scatter",
  "data": {
    "labels": ["Label1", "Label2", ...],
    "datasets": [{
      "label": "Series Name",
      "data": [10, 20, 30, ...],
      "backgroundColor": ["#4F46E5", "#10B981", "#F59E0B", ...],
      "borderColor": "#4F46E5",
      "borderWidth": 1
    }]
  },
  "options": {
    "responsive": false,
    "plugins": {
      "title": { "display": true, "text": "Chart Title" },
      "legend": { "position": "bottom" }
    }
  }
}

COLOR PALETTE to use:
- Primary: #4F46E5 (indigo)
- Success: #10B981 (emerald)
- Warning: #F59E0B (amber)
- Danger: #EF4444 (red)
- Info: #3B82F6 (blue)
- Purple: #8B5CF6
- Pink: #EC4899
- Cyan: #06B6D4

For pie/doughnut charts, use an array of colors for backgroundColor.
For bar/line charts, use single colors per dataset.`,
          },
          {
            role: 'user',
            content: `Command: ${command}

Data:
${dataContext}

Generate the Chart.js config JSON:`,
          },
        ],
        temperature: 0.2,
        max_tokens: 2048,
      })

      const content = response.choices[0]?.message?.content?.trim()
      
      if (!content) {
        return { success: false, error: 'LLM returned empty response' }
      }

      // Clean up response - remove markdown code blocks if present
      let jsonStr = content
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }

      try {
        const config = JSON.parse(jsonStr) as ChartConfig
        return { success: true, config }
      } catch (parseError) {
        console.error('[ChartRenderer] Failed to parse chart config:', jsonStr)
        return { success: false, error: `Invalid JSON from LLM: ${parseError}` }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error('[ChartRenderer] Failed to generate config:', errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  /**
   * Render Chart.js config to PNG buffer
   */
  async renderChartToImage(config: ChartConfig, width = 800, height = 600): Promise<Buffer> {
    const browser = await this.getBrowser()
    const page = await browser.newPage()

    try {
      // Set viewport
      await page.setViewportSize({ width, height })

      // Create HTML with Chart.js
      const html = `
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      background: white; 
      display: flex; 
      justify-content: center; 
      align-items: center;
      width: ${width}px;
      height: ${height}px;
    }
    #chart-container {
      width: ${width - 40}px;
      height: ${height - 40}px;
    }
  </style>
</head>
<body>
  <div id="chart-container">
    <canvas id="chart"></canvas>
  </div>
  <script>
    const config = ${JSON.stringify(config)};
    
    // Ensure responsive is false for consistent rendering
    config.options = config.options || {};
    config.options.responsive = true;
    config.options.maintainAspectRatio = false;
    config.options.animation = false;
    
    const ctx = document.getElementById('chart').getContext('2d');
    new Chart(ctx, config);
  </script>
</body>
</html>`

      await page.setContent(html)
      
      // Wait for chart to render
      await page.waitForTimeout(500)

      // Take screenshot
      const screenshot = await page.screenshot({
        type: 'png',
        omitBackground: false,
      })

      return screenshot
    } finally {
      await page.close()
    }
  }

  /**
   * Full pipeline: table data → chart config → PNG image
   */
  async createChartFromTable(
    command: string,
    tableData: string,
    html?: string
  ): Promise<ChartRenderResult> {
    console.log('[ChartRenderer] Creating chart from table data...')

    // Step 1: Generate chart config
    const configResult = await this.generateChartConfig(command, tableData, html)
    
    if (!configResult.success || !configResult.config) {
      return { success: false, error: configResult.error }
    }

    console.log('[ChartRenderer] Generated chart config:', configResult.config.type)

    // Step 2: Render to image
    try {
      const imageBuffer = await this.renderChartToImage(configResult.config)
      console.log('[ChartRenderer] Chart rendered successfully, size:', imageBuffer.length, 'bytes')
      
      return {
        success: true,
        imageBuffer,
        chartConfig: configResult.config,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error('[ChartRenderer] Failed to render chart:', errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  /**
   * Cleanup browser instance
   */
  async dispose(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }
}

// Singleton
export const chartRendererService = new ChartRendererService()

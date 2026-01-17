# ClipMorph

Voice-driven clipboard transformation tool for macOS. Use voice commands to clean URLs, format JSON, extract emails, and more — all without leaving your keyboard.

## Quick Start

### Prerequisites

- **Node.js 20+** and **npm 10+**
- **macOS** (Ventura or later recommended)
- **Python 3.9+** (for voice transcription)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/clipmorph.git
cd clipmorph

# Install Node.js dependencies
npm install

# (Optional) Install Python dependencies for voice transcription
cd packages/stt-parakeet/sidecar
pip install -r requirements.txt
cd ../../..
```

### Running the App

```bash
# Start in development mode
npm run dev
```

The app will appear as a **menubar icon** (small circle) in your macOS menu bar. Click it to open the ClipMorph window.

### Granting Permissions

ClipMorph needs two macOS permissions to work fully:

#### 1. Microphone Permission (for voice commands)
- Click the **"Enable"** button in the app
- macOS will show a permission dialog — click "OK" to allow

#### 2. Accessibility Permission (for global hotkey)
- Click **"Open Settings"** in the app
- System Preferences will open to Privacy & Security > Accessibility
- Click the 🔒 lock icon and enter your password
- Find **ClipMorph** in the list (or click + to add it)
- Check the checkbox next to ClipMorph
- **Restart the app** (`Ctrl+C` in terminal, then `npm run dev` again)

### Using ClipMorph

Once permissions are granted:

1. **Hold the hotkey** (default: `Cmd+Shift+V`) to start recording
2. **Speak your command** (e.g., "clean this URL", "pretty print JSON")
3. **Release the hotkey** — ClipMorph will process your clipboard

#### Supported Voice Commands

| Command | What it does |
|---------|--------------|
| "clean url" / "remove tracking" | Remove tracking parameters from URLs |
| "markdown link" | Convert URL to `[title](url)` format |
| "pretty json" / "format json" | Pretty-print JSON with indentation |
| "minify json" / "compact json" | Minify JSON to single line |
| "json to yaml" | Convert JSON to YAML |
| "yaml to json" | Convert YAML to JSON |
| "extract emails" | Extract all email addresses |
| "extract links" | Extract all URLs |
| "redact secrets" | Hide API keys, tokens, passwords |
| "cancel" | Cancel current operation |
| "undo" | Undo last clipboard change |

You can also chain commands: "clean url then make markdown"

## Features

- 🎤 **Push-to-talk voice control** with global hotkey
- 📋 **Clipboard transforms** — modify text without copy-paste dance
- 🔒 **Privacy-first** — all processing happens locally
- ⚡ **Fast** — transforms execute instantly
- 🎨 **Menubar app** — stays out of your way
- ⏪ **Undo support** — 2-level undo history

## Development

### Project Structure

```
src/
├── main/              # Electron main process
│   ├── index.ts       # App entry, tray, IPC handlers
│   └── services/      # Core services
│       ├── voice-service.ts      # Push-to-talk & audio
│       ├── intent-service.ts     # Command routing
│       ├── transform-service.ts  # Clipboard transforms
│       ├── clipboard-service.ts  # Clipboard management
│       ├── store-service.ts      # SQLite persistence
│       └── settings-service.ts   # User preferences
├── preload/           # Preload bridge
│   └── index.ts       # contextBridge API
└── renderer/          # React UI
    └── src/
        ├── App.tsx
        └── components/
            ├── Settings.tsx
            ├── TranscriptHistory.tsx
            └── LastAction.tsx

packages/
├── contracts/         # Shared TypeScript types & IPC contracts
├── core/              # Transform logic & intent classification
└── stt-parakeet/      # Speech-to-text sidecar (Python)
```

### Architecture

The renderer is **UI-only** — no direct access to clipboard, microphone, or filesystem. All privileged operations go through the preload bridge to the main process.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Renderer  │ ←→  │   Preload   │ ←→  │    Main     │
│  (React UI) │     │  (Bridge)   │     │ (Electron)  │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run test` | Run all tests |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run build:mac` | Build macOS distributable |

### Running Tests

```bash
npm test
```

All 183 tests should pass.

## Configuration

Settings are stored in SQLite at:
```
~/Library/Application Support/clipmorph/clipmorph.db
```

You can configure:
- **Push-to-talk hotkey** (default: `Cmd+Shift+V`)
- **Enable/disable individual transforms**
- **UI theme**

Access settings by clicking the ⚙️ icon in the app.

## Troubleshooting

### "Hotkeys disabled - accessibility permission not granted"
1. Open System Preferences > Privacy & Security > Accessibility
2. Add ClipMorph and check the box
3. Restart the app

### Voice commands not working
1. Check microphone permission is granted
2. Ensure Python dependencies are installed:
   ```bash
   cd packages/stt-parakeet/sidecar
   pip install -r requirements.txt
   ```
3. The first transcription may be slow as the model downloads (~1GB)

### App not appearing in menubar
- Look for a small circle icon in the top-right area of your screen
- Try clicking in the menubar area — the icon may be hidden behind other icons

## License

MIT

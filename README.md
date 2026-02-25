# ServicePilot

A desktop app for managing dev services.

<!-- TODO: Add screenshot -->

## Features

- Import any repo and run its package.json scripts
- Real-time log viewer with ANSI color support
- Start, stop, and restart services via UI or keyboard shortcuts
- Favorite scripts and rename them with aliases
- Auto-detect already-running services via port scanning
- Resizable sidebar with status indicators

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Bun](https://bun.sh/) (for building the sidecar binary)
- [Rust](https://www.rust-lang.org/tools/install) and Cargo
- [Tauri CLI v2](https://v2.tauri.app/start/prerequisites/)

## Getting Started

```bash
# Clone the repo
git clone https://github.com/your-username/servicepilot.git
cd servicepilot

# Install root dependencies
npm install

# Install desktop dependencies
cd desktop && npm install && cd ..

# Run in development mode
npm run desktop
```

## Building

```bash
npm run desktop:build
```

This builds the sidecar binary and packages the Tauri app for your platform.

## Project Structure

```
servicepilot/
├── sidecar/          # Node.js process manager (communicates via stdin/stdout JSON)
│   ├── main.ts       # Entry point
│   ├── config.ts     # Persistent config (~/.servicepilot/config.json)
│   ├── process-manager.ts
│   ├── port-scan.ts  # Detect already-running services
│   └── repo-scanner.ts
├── desktop/          # Tauri v2 + React frontend
│   ├── src/          # React components, hooks, styles
│   └── src-tauri/    # Rust backend, Tauri config, sidecar binaries
└── scripts/          # Build scripts
```

## License

MIT - see [LICENSE](LICENSE).

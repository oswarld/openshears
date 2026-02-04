# 🦞 OpenShears

> **THE OPENCLAW TERMINATOR** - Safely and completely remove OpenClaw from your system.

**OpenShears** is a powerful CLI utility designed to detect and annihilate all traces of **OpenClaw**, the popular local LLM gateway service. Just as kitchen shears are the tool of choice for dismantling a lobster, OpenShears is your weapon for taking apart OpenClaw.

## 🚀 Quick Start

You can run OpenShears directly without installing it:

```bash
npx openshears
```

Or clone and run locally:

```bash
git clone https://github.com/oswarld/openshears.git
cd openshears
npm install
npm run build
npm start
```

## 🎯 Features

- **🔍 Deep Scan**: Detects hidden artifacts, including:
  - Global NPM packages (`openclaw`)
  - Configuration files (`~/.openclaw`, `~/.clawdbot`)
  - Log files and cache
  - Running background processes
- **🛡️ Safe Mode**: Always asks for confirmation before deleting anything.
- **⚡ Hard Kill**: Terminates stubborn processes immediately.
- **🧹 Clean Sweep**: Removes directories, files, and packages in the correct order.

## ⚠️ Warning

**This tool is destructive.**
It is designed to **permanently delete** OpenClaw configuration, memory, and logs. Once confirmed, this action cannot be undone.

## 🤝 Contributing

Contributions are welcome! If you find a leftover file that OpenShears missed, please submit a PR.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/better-detection`)
3. Commit your changes (`git commit -m 'Add detection for legacy logs'`)
4. Push to the branch (`git push origin feature/better-detection`)
5. Open a Pull Request

## 📄 License

MIT License. Use at your own risk.

# Contributing to Orca C2

Thank you for considering contributing to **Orca C2**!  
We welcome bug reports, feature ideas, documentation improvements, code fixes, new ideas for client features, better error handling, UI enhancements — anything that helps make this educational C2 framework cleaner, more reliable, or more useful for authorized red-team / security research use.

This project is still early-stage and intentionally minimal — so even small, focused PRs are very valuable.

<div align="center">
  <img src="https://opensource.guide/assets/images/cards/default.png" alt="Open Source Contribution Illustration" width="500"/>
  <br><br>
  <sub>(via Open Source Guides)</sub>
</div>

## Code of Conduct

We follow a simple rule:

- Be respectful, patient, and kind.
- Keep discussions technical and on-topic.
- No personal attacks, harassment, or discrimination of any kind.

If you see something inappropriate, please report it privately to the maintainer.

## How Can I Contribute?

### 1. Reporting Bugs 🐛

- Open an issue titled **"[BUG]"** + short description
- Fill in as much as possible:
  - Environment (OS, Node version, Electron version if client)
  - Steps to reproduce
  - Expected vs actual behavior
  - Screenshots / terminal output / logs
  - Any relevant stack traces

### 2. Suggesting Features or Improvements 💡

Open an issue with prefix **"[IDEA]"** or **"[ENHANCEMENT]"**.

Great ideas right now might include:

- More shell types (pwsh core, wsl?)
- File upload/download commands
- Basic persistence mechanisms (for education)
- Better reconnect / jitter logic on client
- TUI improvements (themes, keybindings, mouse support)
- Cross-platform client builds (linux/mac stubs?)
- Basic encryption/obfuscation layer on websocket
- Better logging & error reporting

### 3. Contributing Code or Docs 📝

#### Step-by-step:

1. **Fork** the repository
2. **Clone** your fork locally
3. Create a branch with a meaningful name:

   ```bash
   git checkout -b fix/reconnect-logic
   # or
   git checkout -b feature/shell-pwsh-core
   # or
   git checkout -b docs/add-client-build-guide
   ```
4. Make your changes
Keep code style consistent (use existing patterns)
Add comments where logic is non-obvious
Update README.md or inline docs if behavior changes
If adding client features → test on Windows (portable .exe)

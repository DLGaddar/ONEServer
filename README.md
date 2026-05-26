# ONEServer

![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-lightgrey)
![Built with](https://img.shields.io/badge/built%20with-Electron%20%2B%20Flutter-blueviolet)

> Manage multiple Linux servers from a single desktop and mobile platform — no agents, just SSH.

<!-- screenshot buraya gelecek -->

## ✅ Features

- **SSH key-based authentication**: Cryptographically secure server logins (no raw server passwords stored in the database).
- **Docker container management**: Seamlessly start, stop, restart containers, view real-time logs, and monitor resource stats.
- **Real-time system monitoring**: Dynamic tracking of CPU load, RAM utilization, Disk partition space, and Network RX/TX interfaces.
- **Mobile companion app**: Dedicated Flutter-based companion application compatible with both iOS & Android.
- **End-to-end encrypted mobile communication**: Dynamic PBKDF2 key derivation and secure AES-256-GCM authenticated payload encryption.
- **No agent required**: Zero-overhead execution. Standard SSH port communication is all it takes.

---

## 🏗️ Architecture

```
Desktop (Electron) ──SSH──► Linux Servers
       │
     AES-256
       │
Relay Server (VPS)
       │
     AES-256
       │
 Mobile (Flutter)
```

---

## 🛠️ Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Desktop  | Electron, React, TypeScript, SQLite (via Kysely & better-sqlite3) |
| Core Lib | TypeScript, ssh2, Zod             |
| Mobile   | Flutter, Dart, Riverpod           |
| Relay    | Node.js, WebSocket (ws)           |
| Website  | Next.js, TailwindCSS              |

---

## 🚀 Getting Started

### Prerequisites
Ensure you have the following installed on your machine:
* **Node.js**: Version 20+
* **Flutter**: Version 3.x
* **npm**: Version 10+

### Installation & Run

1. **Clone the Repository**
   ```bash
   git clone https://github.com/DLGaddar/ONEServer.git
   cd oneserver
   ```

2. **Install Workspace Dependencies**
   ```bash
   npm install
   ```

3. **Build Shared Core Library**
   ```bash
   npm run build:core
   ```

4. **Launch Desktop App in Developer Mode**
   ```bash
   npm run dev:desktop
   ```

---

## 📂 Project Structure

```
oneserver/
├── packages/
│   └── core/          # Shared TypeScript type definitions, SSH, Docker, and pairing engines
├── apps/
│   ├── desktop/       # Electron desktop shell + React UI dashboard
│   ├── mobile/        # Flutter mobile app for iOS & Android
│   ├── relay/         # High-security, silence-first WebSocket relay server
│   └── website/       # Next.js landing page with integrated release registry API
```

---

## 📡 Relay Server Setup

Run the WebSocket communications bridge directly on your VPS:
```bash
cd apps/relay
npm install
npm run build
npm start  # Runs on default port 8080
```

---

## 📱 Mobile App Setup

Launch the mobile monitoring companion:
```bash
cd apps/mobile
flutter pub get
flutter run
```

---

## 🔒 Security

- **Safe Credential Handling**: SSH passwords and passphrases are never persistently saved in SQLite. Safe session-only prompt hooks guarantee passwords remain memory-only.
- **Local Database Encryption**: The SQLite database containing connection configuration details is kept strictly secure.
- **End-to-End Cryptography**: Communication between mobile and desktop clients is encrypted and signed using **AES-256-GCM** keys generated from shared pairing codes via **PBKDF2 (100,000 iterations)**.
- **Zero-knowledge Forwarding**: The Relay Server functions strictly as a transparent pipe. Because payload items are encrypted client-side, the relay has zero access to the data stream.

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

---

## 📄 License

MIT © 2025 Yusuf

<div align="center">

# ✨ Lumi

**An AI-powered, Instagram-inspired social media app — built with React, TypeScript, and Supabase.**

</div>

---

## Overview

Lumi is a full-featured social media platform — feed, stories, reels, direct messages, notifications, and a profile system — with a set of AI-assisted moderation and content features layered on top. It's built as a single-page React app backed entirely by Supabase (Postgres + Auth + Row Level Security), with no separate backend server required.

## ✨ Features

**Core social experience**
- 🏠 **Home Feed** — image posts with likes, comments, and saves
- 📖 **Stories** — 24-hour ephemeral stories with audio and translation support
- 🎬 **Reels** — short-form video, stored via Supabase Storage
- 🧭 **Explore & Search** — content and people discovery
- 💬 **Direct Messages** — real-time conversations between users
- 🔔 **Notifications** — likes, comments, follows, and mentions
- 👤 **Profiles** — editable profiles with follower/following counts, verified badges, and an owner tag

**AI-assisted layer**
- 🤖 AI caption generation and summarization
- ✅ AI fact-checking of post captions (verified / suspicious / likely false)
- 🚫 Explicit content detection
- 🎭 Mood-based content filtering

**Safety & control**
- 🔒 Row Level Security on every table — users only touch their own data
- 👨‍👩‍👧 Parental Lock — password-protected content filtering and DM blocking for younger users
- 🚩 Reporting system for posts and users
- 🔗 Referral system with unique codes

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + custom CSS modules |
| Icons | Lucide React |
| Backend | Supabase (Postgres, Auth, Storage, RLS) |
| Video | YouTube IFrame API (trending audio for stories) |

## 📁 Project Structure

```
Lumi-2211-main/
├── src/
│   ├── components/       # Reusable UI: Avatar, PostCard, ReelCard, modals, nav...
│   ├── pages/             # Route-level views: HomeFeed, ExplorePage, ProfilePage...
│   ├── lib/               # auth, supabase client, AI helpers, YouTube loader, toast
│   ├── styles/            # Component-level CSS
│   ├── App.tsx            # Root component + client-side page routing
│   └── main.tsx           # Entry point
├── supabase/
│   └── migrations/        # SQL schema + RLS policy migrations
├── public/                 # Static assets
└── vite.config.ts / tailwind.config.js / tsconfig*.json
```

## 🗄️ Database Schema

Lumi's Supabase schema includes 17 tables covering the full app surface:

`profiles` · `posts` · `stories` · `reels` · `comments` · `likes` · `saves` · `follows` · `conversations` · `messages` · `notifications` · `reports` · `trending_audio` · `referrals` · `user_settings` · `ai_results` · `explicit_content_flags` · `parental_controls`

Every table has Row Level Security enabled, with authenticated-only access and ownership-scoped mutations — public reads are limited to what's needed for explore/search to work.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project

### 1. Clone and install

```bash
git clone <your-repo-url>
cd Lumi-2211-main
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Run database migrations

Apply the SQL files in `supabase/migrations/` to your Supabase project, in order, via the Supabase SQL editor or CLI:

```bash
supabase db push
```

### 4. Start the dev server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

## 📜 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run the TypeScript compiler in check-only mode |

## 🤝 Contributing

Contributions, issues, and feature requests are welcome. Feel free to open a pull request or file an issue.

## 📄 License

No license specified yet — add one (MIT, Apache-2.0, etc.) if you plan to open source this project.

---

<div align="center">
Built with 💜 by <b>Krishnav 2211</b>
</div>

# Lumi-2211

[![Open Lumi](public/assets/images/files_11030906-2026-07-18T17-00-19-421Z-files_11030906-2026-07-18T16-49-02-927Z-ed179abf-c932-4a59-ac3c-944712c405bf.webp)](https://lumi2211.bolt.host)

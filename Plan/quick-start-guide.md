# ⚡ QUICK START GUIDE
## Get Your Poll App Running in 4 Hours

**Total Time:** ~4 hours to working app
**Skill Level:** Intermediate
**Prerequisites:** Node.js 18+, Git, basic React/Next.js knowledge

---

## 🎯 PHASE 0: SETUP (30 minutes)

### Step 1: Create Project Directory
```bash
mkdir poll-rooms
cd poll-rooms
```

### Step 2: Initialize Next.js App
```bash
npx create-next-app@latest . --typescript --tailwind --app
# Answer prompts:
# ✓ TypeScript: Yes
# ✓ ESLint: Yes
# ✓ Tailwind CSS: Yes
# ✓ src/ directory: No
# ✓ App Router: Yes
# ✓ Import alias: No
```

### Step 3: Install Dependencies
```bash
npm install socket.io-client nanoid @supabase/supabase-js
npm install -D @types/node
```

### Step 4: Create Socket Server Directory
```bash
mkdir socket-server
cd socket-server
npm init -y
npm install express socket.io cors dotenv
cd ..
```

### Step 5: Setup Supabase
1. Go to https://supabase.com
2. Sign up / Log in
3. Click "New Project"
4. Name: "poll-rooms-prod"
5. Database Password: (save this!)
6. Region: Choose closest to you
7. Wait 2 minutes for setup

### Step 6: Create Database Schema
1. In Supabase dashboard, click "SQL Editor"
2. Copy the SQL from `/home/claude/starter-code/database-schema.sql`
3. Paste and click "Run"
4. Verify tables created (check "Table Editor")

### Step 7: Configure Environment Variables
Create `.env.local` in project root:
```bash
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
DATABASE_URL=postgresql://postgres:[password]@db.xxxxx.supabase.co:5432/postgres
SOCKET_SERVER_URL=http://localhost:3001
```

Create `socket-server/.env`:
```bash
PORT=3001
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

---

## 💻 PHASE 1: BACKEND SETUP (1.5 hours)

### Step 1: Create Supabase Client
Create `lib/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

### Step 2: Create API Routes
Copy these files from starter-code:
1. `app/api/polls/create/route.ts` → from `starter-code/api-create-poll.ts`
2. `app/api/polls/[slug]/route.ts` → Create GET endpoint:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;

  const { data: poll, error } = await supabase
    .from('polls')
    .select(`
      id,
      question,
      created_at,
      options (
        id,
        text,
        vote_count,
        display_order
      )
    `)
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !poll) {
    return NextResponse.json(
      { error: 'Poll not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(poll);
}
```
3. `app/api/polls/[slug]/vote/route.ts` → from `starter-code/api-vote.ts`

### Step 3: Create Socket Server
Copy `socket-server/index.js` from `starter-code/socket-server.js`

Create `socket-server/package.json`:
```json
{
  "name": "poll-rooms-socket-server",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.6.1",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  }
}
```

### Step 4: Test Backend
```bash
# Terminal 1: Start Next.js
npm run dev

# Terminal 2: Start Socket Server
cd socket-server
npm start

# Test endpoints:
# POST http://localhost:3000/api/polls/create
# Body: { "question": "Test?", "options": ["A", "B"] }
```

---

## 🎨 PHASE 2: FRONTEND SETUP (1.5 hours)

### Step 1: Create Homepage
Copy `app/page.tsx` from `starter-code/homepage.tsx`

### Step 2: Create Poll View Page
Create directory:
```bash
mkdir -p app/p/[slug]
```
Copy `app/p/[slug]/page.tsx` from `starter-code/poll-page.tsx`

### Step 3: Add Global Styles (Optional)
Update `app/globals.css` for better animations:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  .hover\:scale-102:hover {
    transform: scale(1.02);
  }
}
```

### Step 4: Test Frontend
1. Go to http://localhost:3000
2. Create a poll
3. Copy the link
4. Open in new tab
5. Vote
6. Check real-time update

---

## 🚀 PHASE 3: DEPLOYMENT (45 minutes)

### Part A: Deploy Socket Server (Railway)

1. **Create Railway Account:**
   - Go to https://railway.app
   - Sign up with GitHub

2. **Deploy Socket Server:**
   ```bash
   cd socket-server
   git init
   git add .
   git commit -m "Initial socket server"
   ```
   - In Railway dashboard: "New Project"
   - "Deploy from GitHub repo"
   - Select `socket-server` directory
   - Add env vars:
     - `PORT`: (leave blank, Railway auto-assigns)
     - `FRONTEND_URL`: (we'll update after Vercel)

3. **Get Socket URL:**
   - Railway will give you: `https://xxxxx.railway.app`
   - Test: Visit `https://xxxxx.railway.app/health`
   - Should see: `{"status":"ok",...}`

### Part B: Deploy Next.js App (Vercel)

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/poll-rooms.git
   git push -u origin main
   ```

2. **Deploy on Vercel:**
   - Go to https://vercel.com
   - "Import Project"
   - Select your GitHub repo
   - Framework Preset: Next.js
   - Add environment variables:
     - `NEXT_PUBLIC_BASE_URL`: https://your-app.vercel.app
     - `NEXT_PUBLIC_SOCKET_URL`: https://xxxxx.railway.app
     - `NEXT_PUBLIC_SUPABASE_URL`: (from Supabase)
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: (from Supabase)
     - `DATABASE_URL`: (from Supabase)
     - `SOCKET_SERVER_URL`: https://xxxxx.railway.app
   - Click "Deploy"

3. **Update Railway Env:**
   - Go back to Railway
   - Update `FRONTEND_URL` to your Vercel URL
   - Redeploy socket server

### Part C: Test Production

1. Visit your Vercel URL
2. Create a poll
3. Share link to phone
4. Vote from both devices
5. Verify real-time updates work

---

## 📝 PHASE 4: DOCUMENTATION (30 minutes)

### Step 1: Create README
Copy template from `starter-code/README-template.md`

Update these sections:
- Replace `https://your-app.vercel.app` with your actual URL
- Replace `https://github.com/yourusername/repo` with your repo URL
- Add your name and contact info

### Step 2: Document Anti-Abuse
In README, ensure this section is thorough:
```markdown
## Anti-Abuse Mechanisms

### 1. Device Fingerprinting
**Prevents:** Repeat voting from same device
**How:** Browser fingerprint + localStorage check
**Limitations:** Clearable via incognito/clearing data

### 2. IP Rate Limiting (10-min window)
**Prevents:** Bot attacks, rapid-fire voting
**How:** Track IP + timestamp in database
**Limitations:** Shared WiFi affects multiple users
```

### Step 3: Document Edge Cases
List at least 5:
1. Concurrent votes (handled via transactions)
2. Invalid poll slug (404 page)
3. Empty inputs (validation)
4. Socket disconnect (auto-reconnect)
5. Duplicate votes (blocked by both mechanisms)

---

## ✅ PHASE 5: FINAL TESTING (30 minutes)

### Critical Tests:
1. [ ] Create poll → works
2. [ ] Share link → opens in new tab
3. [ ] Vote → updates in real-time
4. [ ] Vote again → blocked
5. [ ] Refresh page → data persists
6. [ ] Mobile test → works
7. [ ] Invalid slug → 404 page

### Load Test:
```bash
# Open 5 tabs to same poll
# Vote from each (different IPs won't work, so simulate)
# Verify counts are accurate
```

---

## 📮 SUBMISSION

### What to Submit:
1. **Public URL:** Your Vercel deployment
2. **GitHub URL:** Your public repository
3. **Notes:** In README.md (anti-abuse + edge cases + limitations)

### Google Form:
https://forms.gle/uvR98xPXpJAp8tq59

---

## 🆘 TROUBLESHOOTING

### "Cannot find module 'socket.io-client'"
```bash
npm install socket.io-client
```

### "Supabase query fails"
- Check .env.local has correct credentials
- Verify tables exist in Supabase dashboard
- Test query in SQL Editor

### "Socket.io not connecting"
- Check SOCKET_URL in .env.local
- Verify socket server is running (port 3001)
- Check browser console for errors
- Verify CORS settings in socket server

### "Deployment fails on Vercel"
- Check build logs
- Ensure all env vars are set
- Test `npm run build` locally first
- Check for TypeScript errors

### "Real-time updates not working"
- Verify socket server is deployed and accessible
- Check socket URL is HTTPS (not HTTP) in production
- Verify CORS allows your Vercel domain
- Check browser console for WebSocket errors

---

## 🎓 KEY LEARNINGS

By completing this project, you'll have learned:
- WebSocket implementation with Socket.io
- Real-time data synchronization
- Anti-abuse mechanism design
- Full-stack deployment (Vercel + Railway)
- PostgreSQL with Supabase
- Next.js App Router API routes
- Device fingerprinting techniques
- Rate limiting strategies

---

## 📚 RESOURCES

- Next.js Docs: https://nextjs.org/docs
- Socket.io Docs: https://socket.io/docs/v4/
- Supabase Docs: https://supabase.com/docs
- Vercel Deployment: https://vercel.com/docs
- Railway Docs: https://docs.railway.app

---

## ⏱️ TIME ALLOCATION

- Phase 0 (Setup): 30 min
- Phase 1 (Backend): 1.5 hrs
- Phase 2 (Frontend): 1.5 hrs
- Phase 3 (Deploy): 45 min
- Phase 4 (Docs): 30 min
- Phase 5 (Test): 30 min

**Total:** ~5 hours (with buffer)

---

## 🏆 SUCCESS CRITERIA

Your app is ready when:
- ✅ Create poll works
- ✅ Real-time updates work (3+ clients)
- ✅ Anti-abuse blocks repeat votes
- ✅ Data persists after refresh
- ✅ Deployed and accessible publicly
- ✅ README documents everything clearly

---

**GO BUILD! 🚀**

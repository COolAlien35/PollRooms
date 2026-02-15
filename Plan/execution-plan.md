# 48-HOUR EXECUTION PLAN
## Real-Time Poll Rooms Assignment

**Deadline:** Monday, 17 Feb 2026, 11:59 PM IST
**Start:** Saturday, 14 Feb 2026 (NOW)

---

## ⏰ PHASE 1: SETUP & FOUNDATION (Hours 0-6) [Saturday Evening]

### Hour 0-1: Project Initialization
```bash
# Create Next.js project
npx create-next-app@latest poll-rooms --typescript --tailwind --app
cd poll-rooms

# Install core dependencies
npm install socket.io socket.io-client
npm install @supabase/supabase-js
npm install nanoid  # For generating short slugs
npm install fingerprintjs2  # For device fingerprinting

# Install dev dependencies
npm install -D @types/socket.io
```

### Hour 1-2: Database Setup
1. **Create Supabase Project:**
   - Go to supabase.com
   - Create new project: "poll-rooms-prod"
   - Save credentials in `.env.local`

2. **Run SQL Migration:**
   ```sql
   -- Execute in Supabase SQL Editor
   -- (Use the schema from architecture.md)
   ```

3. **Test Connection:**
   ```typescript
   // lib/supabase.ts
   import { createClient } from '@supabase/supabase-js';
   
   export const supabase = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
   );
   ```

### Hour 2-4: Core API Routes
Create these files:

1. **app/api/polls/create/route.ts**
   - Validate input (min 2 options, non-empty question)
   - Generate unique slug (nanoid)
   - Insert into database
   - Return poll data + share URL

2. **app/api/polls/[slug]/route.ts**
   - Fetch poll by slug
   - Return 404 if not found
   - Include vote counts

3. **app/api/polls/[slug]/vote/route.ts**
   - Validate poll exists
   - Check fingerprint + IP in votes table
   - Use transaction to insert vote + increment count
   - Return success/error

### Hour 4-6: Basic Frontend Structure
1. **app/page.tsx** (Homepage - Create Poll)
   - Form: question input + dynamic option inputs
   - Validate minimum 2 options
   - Call /api/polls/create
   - Show shareable link

2. **app/p/[slug]/page.tsx** (Poll View)
   - Fetch poll data on load
   - Display question + options as buttons
   - Show vote counts
   - Handle vote submission

**END OF PHASE 1 CHECKPOINT:**
- ✅ Can create a poll
- ✅ Can access poll via link
- ✅ Can vote (but no real-time yet)
- ✅ Data persists in database

---

## ⚡ PHASE 2: REAL-TIME IMPLEMENTATION (Hours 6-12) [Saturday Night]

### Hour 6-8: Socket.io Server Setup
Option A: Separate Server (Recommended)
```bash
# Create socket-server directory
mkdir socket-server
cd socket-server
npm init -y
npm install express socket.io cors dotenv
```

**socket-server/index.js:**
```javascript
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Track active polls and their subscribers
const pollRooms = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join a poll room
  socket.on('join_poll', (pollId) => {
    socket.join(`poll:${pollId}`);
    console.log(`${socket.id} joined poll:${pollId}`);
  });

  // Leave poll room
  socket.on('leave_poll', (pollId) => {
    socket.leave(`poll:${pollId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Broadcast vote update (called by API)
io.broadcastVote = (pollId, data) => {
  io.to(`poll:${pollId}`).emit('vote_update', data);
};

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket server running on port ${PORT}`);
});

module.exports = { io };
```

### Hour 8-9: Integrate Socket.io with Next.js
1. **Modify vote API to emit socket events:**
   ```typescript
   // After successful vote
   const socketUrl = process.env.SOCKET_SERVER_URL;
   fetch(`${socketUrl}/broadcast`, {
     method: 'POST',
     body: JSON.stringify({
       pollId: poll.id,
       optionId: optionId,
       newCount: updatedOption.vote_count
     })
   });
   ```

2. **Add broadcast endpoint to socket server:**
   ```javascript
   app.post('/broadcast', express.json(), (req, res) => {
     const { pollId, optionId, newCount } = req.body;
     io.to(`poll:${pollId}`).emit('vote_update', {
       optionId,
       newCount
     });
     res.json({ success: true });
   });
   ```

### Hour 9-12: Frontend Socket Integration
**app/p/[slug]/page.tsx:**
```typescript
'use client';
import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';

export default function PollPage({ params }) {
  const [poll, setPoll] = useState(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Fetch initial poll data
    fetch(`/api/polls/${params.slug}`)
      .then(r => r.json())
      .then(data => setPoll(data));

    // Connect to socket
    socketRef.current = io(process.env.NEXT_PUBLIC_SOCKET_URL!);
    
    socketRef.current.on('connect', () => {
      console.log('Socket connected');
      socketRef.current!.emit('join_poll', params.slug);
    });

    // Listen for vote updates
    socketRef.current.on('vote_update', (data) => {
      setPoll(prev => ({
        ...prev,
        options: prev.options.map(opt =>
          opt.id === data.optionId
            ? { ...opt, vote_count: data.newCount }
            : opt
        )
      }));
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [params.slug]);

  // ... rest of component
}
```

**END OF PHASE 2 CHECKPOINT:**
- ✅ Real-time updates working
- ✅ Multiple clients see instant changes
- ✅ Socket reconnection handled

---

## 🛡️ PHASE 3: ANTI-ABUSE MECHANISMS (Hours 12-18) [Sunday Morning]

### Hour 12-14: Device Fingerprinting
1. **Create fingerprint utility:**
   ```typescript
   // lib/fingerprint.ts
   import Fingerprint2 from 'fingerprintjs2';
   
   export async function getFingerprint(): Promise<string> {
     const components = await Fingerprint2.getPromise();
     const values = components.map(c => c.value);
     const murmur = Fingerprint2.x64hash128(values.join(''), 31);
     return murmur;
   }
   ```

2. **Check localStorage before voting:**
   ```typescript
   const handleVote = async (optionId: string) => {
     // Check localStorage
     const hasVoted = localStorage.getItem(`voted_${pollId}`);
     if (hasVoted) {
       alert('You have already voted on this poll');
       return;
     }

     // Get fingerprint
     const fingerprint = await getFingerprint();

     // Submit vote
     const res = await fetch(`/api/polls/${slug}/vote`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ optionId, fingerprint })
     });

     if (res.ok) {
       localStorage.setItem(`voted_${pollId}`, 'true');
       setHasVoted(true);
     }
   };
   ```

### Hour 14-16: IP Rate Limiting
1. **Add IP check to vote API:**
   ```typescript
   // app/api/polls/[slug]/vote/route.ts
   import { headers } from 'next/headers';
   
   export async function POST(req: Request) {
     const headersList = headers();
     const ip = headersList.get('x-forwarded-for') || 
                headersList.get('x-real-ip') || 
                'unknown';
     
     // Check if IP voted in last 10 minutes
     const { data: recentVote } = await supabase
       .from('votes')
       .select('*')
       .eq('poll_id', pollId)
       .eq('ip_address', ip)
       .gte('voted_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
       .single();
     
     if (recentVote) {
       return Response.json(
         { error: 'Rate limit: 1 vote per 10 minutes per IP' },
         { status: 429 }
       );
     }
     
     // Continue with vote...
   }
   ```

### Hour 16-18: Edge Case Handling
1. **Concurrent Vote Protection:**
   - Use Supabase RPC for atomic increment
   - Or wrap in transaction

2. **Empty Poll Validation:**
   ```typescript
   // In create API
   if (!question.trim() || options.length < 2) {
     return Response.json(
       { error: 'Invalid input' },
       { status: 400 }
     );
   }
   ```

3. **404 Handling:**
   ```typescript
   // In [slug]/page.tsx
   if (!poll && !loading) {
     return <div>Poll not found</div>;
   }
   ```

**END OF PHASE 3 CHECKPOINT:**
- ✅ Cannot vote twice from same device
- ✅ Cannot vote twice from same IP within 10 min
- ✅ Edge cases handled

---

## 🎨 PHASE 4: UI POLISH & UX (Hours 18-24) [Sunday Afternoon]

### Hour 18-20: Responsive Design
- Make poll view mobile-friendly
- Add loading states
- Show vote percentages with progress bars
- Add animations for real-time updates

### Hour 20-22: User Feedback
- Toast notifications for votes
- Error messages for failed votes
- Copy-to-clipboard for share links
- Show "X people voted" counter

### Hour 22-24: Final Touches
- Add favicon
- Meta tags for sharing
- Loading skeletons
- Dark mode (optional)

---

## 🚀 PHASE 5: DEPLOYMENT & TESTING (Hours 24-36) [Sunday Night]

### Hour 24-26: Deploy Socket Server
**Option A: Railway**
1. Create account at railway.app
2. New Project → Deploy from GitHub
3. Add environment variables
4. Note the public URL

**Option B: Render**
1. Create account at render.com
2. New Web Service → Connect repo
3. Build: `npm install`
4. Start: `node index.js`

### Hour 26-28: Deploy Next.js App
1. Push code to GitHub
2. Connect to Vercel
3. Add environment variables:
   - `NEXT_PUBLIC_SOCKET_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `DATABASE_URL`
4. Deploy

### Hour 28-32: Comprehensive Testing
**Test Scenarios:**
1. Create poll → Share → Vote from 3 devices
2. Try to vote twice from same device
3. Try to vote twice from same IP (use mobile hotspot)
4. Refresh page mid-vote
5. Disconnect internet → Vote → Reconnect
6. Invalid slug
7. Create poll with 1 option (should fail)
8. 10 concurrent votes (load test)

### Hour 32-36: Bug Fixes & Buffer
- Fix any issues found in testing
- Performance optimization if needed

---

## 📝 PHASE 6: DOCUMENTATION (Hours 36-42) [Monday Morning]

### Hour 36-38: README.md
```markdown
# Real-Time Poll Rooms

Live Demo: https://your-app.vercel.app

## Features
- Create polls with 2+ options
- Share via unique link
- Real-time vote updates (WebSocket)
- Anti-abuse mechanisms
- Persistent storage

## Tech Stack
- Next.js 14 + TypeScript
- Socket.io (WebSockets)
- PostgreSQL (Supabase)
- Deployed on Vercel + Railway

## Anti-Abuse Mechanisms

### 1. Device Fingerprinting
**Prevents:** Repeat voting from same device
**Implementation:** 
- Browser fingerprint (canvas, user-agent, screen res)
- Stored in localStorage + backend votes table
**Limitations:**
- Bypassed by clearing browser data
- Incognito mode creates new fingerprint

### 2. IP Rate Limiting (10-min window)
**Prevents:** Bot attacks, VPN hopping
**Implementation:**
- Log IP address with timestamp
- Block duplicate votes from same IP within 10 minutes
**Limitations:**
- Shared WiFi (office/café) affected
- Sophisticated VPN rotation can bypass

## Edge Cases Handled
- Concurrent votes (database transactions)
- Poll not found (404 page)
- Invalid options (validation)
- Duplicate votes (both mechanisms)
- Empty inputs (frontend + backend)
- WebSocket disconnects (auto-reconnect)
- Database failures (error handling)

## Known Limitations
- No user authentication (anonymous voting)
- Fingerprinting can be spoofed with effort
- Shared IPs may block legitimate users
- No poll editing after creation
- No vote deletion
- Limited to 10,000 concurrent users (Socket.io)

## Setup Locally
...

## Future Improvements
- Add reCAPTCHA for stronger bot protection
- Implement poll expiration
- Add result analytics dashboard
- Export results to CSV
- Multi-language support
```

### Hour 38-40: Submission Notes
- Fill out Google Form
- Double-check all URLs work
- Proofread README

### Hour 40-42: Final Review
- Test deployed app one last time
- Verify GitHub repo is public
- Check for any console errors

---

## 🎯 PRIORITY MATRIX

### MUST HAVE (Will fail without these):
- ✅ Poll creation with 2+ options
- ✅ Shareable links
- ✅ Real-time updates
- ✅ TWO documented anti-abuse mechanisms
- ✅ Persistence (database)
- ✅ Public deployment

### SHOULD HAVE (Impresses reviewers):
- ⭐ Clean, professional UI
- ⭐ Mobile responsive
- ⭐ Comprehensive README
- ⭐ Edge case handling
- ⭐ TypeScript (shows code quality)

### NICE TO HAVE (Only if time permits):
- 🌟 Dark mode
- 🌟 Animation on vote
- 🌟 Poll analytics page
- 🌟 Social sharing buttons

---

## ⚠️ COMMON PITFALLS TO AVOID

1. **Over-engineering:** Don't build admin dashboards or user accounts
2. **Poor documentation:** Your README is 30% of your grade
3. **Weak anti-abuse:** "Just localStorage" won't impress anyone
4. **No error handling:** Show user-friendly errors
5. **Localhost testing only:** Deploy early, test in production
6. **Last-minute deployment:** Deploy by Sunday evening
7. **Ugly UI:** They'll judge the book by its cover

---

## 🆘 TROUBLESHOOTING GUIDE

### Socket.io not connecting
- Check CORS settings
- Verify SOCKET_URL env var
- Test socket endpoint directly

### Database errors
- Check connection string
- Verify SQL migrations ran
- Test queries in Supabase dashboard

### Deployment fails
- Check build logs
- Verify all env vars set
- Test build locally first

---

## 📞 EMERGENCY CONTACTS (Resources)

- Socket.io Docs: https://socket.io/docs/v4/
- Supabase Docs: https://supabase.com/docs
- Next.js Docs: https://nextjs.org/docs
- Vercel Deployment: https://vercel.com/docs

---

**Remember:** A working app with 80% features beats a broken app with 100% features.
Ship early, iterate often. Good luck! 🚀

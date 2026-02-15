# Real-Time Poll Rooms - Technical Architecture

## 🏛️ HIGH-LEVEL ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT BROWSERS                          │
│  (React/Next.js + Socket.io Client + Local Storage)        │
└────────────┬────────────────────────────┬───────────────────┘
             │                            │
             │ HTTP (REST)                │ WebSocket
             │                            │
┌────────────▼────────────────────────────▼───────────────────┐
│                   NEXT.JS SERVER                            │
│  ┌──────────────────┐      ┌──────────────────────┐       │
│  │   API Routes     │      │  Socket.io Server    │       │
│  │  /api/polls      │      │  (Real-time events)  │       │
│  │  /api/vote       │      │                      │       │
│  └────────┬─────────┘      └──────────┬───────────┘       │
└───────────┼────────────────────────────┼───────────────────┘
            │                            │
            │                            │
┌───────────▼────────────────────────────▼───────────────────┐
│              POSTGRESQL DATABASE (Supabase)                 │
│                                                             │
│  Tables:                                                    │
│  - polls (id, question, created_at, slug)                  │
│  - options (id, poll_id, text, vote_count)                 │
│  - votes (id, poll_id, option_id, voter_fingerprint,       │
│            ip_address, voted_at)                           │
└─────────────────────────────────────────────────────────────┘
```

## 🔐 TWO ANTI-ABUSE MECHANISMS

### Mechanism 1: Device Fingerprinting + LocalStorage
**What it prevents:** Same device voting multiple times
**How it works:**
1. Generate fingerprint from: User-Agent + Screen Resolution + Timezone + Canvas Hash
2. Store `voted_{pollId}` in localStorage on vote
3. Check both localStorage and fingerprint hash before allowing vote
4. Send fingerprint with vote to backend for logging

**Limitations:**
- Can be bypassed by clearing localStorage
- Incognito mode creates new fingerprint
- But: Creates friction, prevents casual repeat voting

### Mechanism 2: IP Rate Limiting with Sliding Window
**What it prevents:** Botnet attacks, VPN hopping abuse
**How it works:**
1. Log IP address + timestamp for each vote
2. Implement 1 vote per IP per poll per 10-minute window
3. Use Redis or in-memory cache for fast lookup
4. Return 429 (Too Many Requests) with retry-after header

**Limitations:**
- Multiple users on same WiFi (office/café) share IP
- Solution: Combine with fingerprinting for higher confidence
- VPN switching can bypass (but adds friction)

## 🎲 DATABASE SCHEMA

```sql
-- Polls table
CREATE TABLE polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(12) UNIQUE NOT NULL,  -- e.g., "xK9mP2nQ8vL1"
    question TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NULL,  -- Optional: auto-close polls
    is_active BOOLEAN DEFAULT TRUE
);

-- Options table
CREATE TABLE options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    vote_count INTEGER DEFAULT 0,
    display_order INTEGER NOT NULL
);

-- Votes table (for audit trail and anti-abuse)
CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
    option_id UUID REFERENCES options(id) ON DELETE CASCADE,
    voter_fingerprint VARCHAR(64),  -- Hash of fingerprint
    ip_address INET,
    voted_at TIMESTAMP DEFAULT NOW(),
    
    -- Composite index for fast duplicate checks
    UNIQUE(poll_id, voter_fingerprint),
    UNIQUE(poll_id, ip_address)  -- Can be relaxed with time window
);

-- Indexes for performance
CREATE INDEX idx_polls_slug ON polls(slug);
CREATE INDEX idx_options_poll ON options(poll_id);
CREATE INDEX idx_votes_poll ON votes(poll_id);
CREATE INDEX idx_votes_time ON votes(voted_at);
```

## 🔄 REAL-TIME FLOW

### Vote Submission Flow:
```
1. User clicks option
   ↓
2. Client sends POST /api/vote
   {
     pollId: "xK9mP2nQ8vL1",
     optionId: "uuid-here",
     fingerprint: "sha256-hash"
   }
   ↓
3. Server validates:
   - Poll exists and active
   - Option belongs to poll
   - No recent vote from fingerprint/IP
   ↓
4. Server updates database:
   BEGIN TRANSACTION
     INSERT INTO votes (...)
     UPDATE options SET vote_count = vote_count + 1
   COMMIT
   ↓
5. Server emits Socket.io event:
   socket.to(`poll:${pollId}`).emit('vote_update', {
     optionId: "uuid",
     newCount: 42
   })
   ↓
6. All connected clients receive event
   ↓
7. Clients update UI instantly (no refetch)
```

## 🚀 API ENDPOINTS

### POST /api/polls/create
Request:
```json
{
  "question": "What's your favorite language?",
  "options": ["JavaScript", "Python", "Go", "Rust"]
}
```
Response:
```json
{
  "pollId": "uuid",
  "slug": "xK9mP2nQ8vL1",
  "shareUrl": "https://app.com/p/xK9mP2nQ8vL1"
}
```

### GET /api/polls/[slug]
Response:
```json
{
  "id": "uuid",
  "question": "What's your favorite language?",
  "options": [
    { "id": "uuid", "text": "JavaScript", "voteCount": 45 },
    { "id": "uuid", "text": "Python", "voteCount": 32 }
  ],
  "hasVoted": false,  // Based on fingerprint/IP check
  "totalVotes": 77
}
```

### POST /api/polls/[slug]/vote
Request:
```json
{
  "optionId": "uuid",
  "fingerprint": "sha256-hash"
}
```
Response:
```json
{
  "success": true,
  "newCount": 46
}
```

## 🛡️ EDGE CASES HANDLED

1. **Concurrent Votes (Race Condition)**
   - Use database transactions with row-level locking
   - `SELECT ... FOR UPDATE` when incrementing counts

2. **Poll Not Found**
   - Return 404 with friendly message
   - Suggest creating a new poll

3. **Invalid Options**
   - Validate optionId belongs to pollId before voting
   - Return 400 Bad Request

4. **Duplicate Vote Attempts**
   - Check votes table before insert
   - Return 409 Conflict with time remaining

5. **Empty Poll Creation**
   - Validate minimum 2 options on frontend AND backend
   - Trim whitespace, reject empty strings

6. **WebSocket Disconnects**
   - Client auto-reconnects with exponential backoff
   - Re-join poll room on reconnect

7. **Database Connection Failures**
   - Implement retry logic with Circuit Breaker pattern
   - Show graceful error message to user

8. **Malformed Slugs**
   - Validate slug format with regex
   - Sanitize before database query (prevent SQL injection)

## 📊 FRONTEND STATE MANAGEMENT

Use React hooks for simplicity:

```typescript
// Poll page state
const [pollData, setPollData] = useState(null);
const [hasVoted, setHasVoted] = useState(false);
const [isVoting, setIsVoting] = useState(false);
const socketRef = useRef(null);

useEffect(() => {
  // Connect to Socket.io
  socketRef.current = io(SOCKET_URL);
  
  // Join poll room
  socketRef.current.emit('join_poll', pollId);
  
  // Listen for real-time updates
  socketRef.current.on('vote_update', (data) => {
    setPollData(prev => ({
      ...prev,
      options: prev.options.map(opt => 
        opt.id === data.optionId 
          ? { ...opt, voteCount: data.newCount }
          : opt
      )
    }));
  });
  
  return () => socketRef.current.disconnect();
}, [pollId]);
```

## 🚢 DEPLOYMENT STRATEGY

### Vercel (Frontend + API Routes)
```bash
# vercel.json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "framework": "nextjs",
  "env": {
    "DATABASE_URL": "@database-url",
    "SOCKET_SERVER_URL": "@socket-server-url"
  }
}
```

### Railway/Render (Socket.io Server)
```javascript
// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL }
});

io.on('connection', (socket) => {
  socket.on('join_poll', (pollId) => {
    socket.join(`poll:${pollId}`);
  });
});

server.listen(process.env.PORT || 3001);
```

### Supabase (Database)
- Create project
- Run migration with schema above
- Copy connection string to env vars

## 🧪 TESTING CHECKLIST

- [ ] Create poll with 2 options ✓
- [ ] Create poll with 10 options ✓
- [ ] Share link opens in new browser ✓
- [ ] Vote updates in real-time across 3 tabs ✓
- [ ] Cannot vote twice from same device ✓
- [ ] Cannot vote twice from same IP (within window) ✓
- [ ] Poll persists after page refresh ✓
- [ ] Handles 404 for invalid slug gracefully ✓
- [ ] Rejects empty question/options ✓
- [ ] Works on mobile browser ✓
- [ ] Socket reconnects after network drop ✓
- [ ] Load test: 50 concurrent votes don't cause drift ✓

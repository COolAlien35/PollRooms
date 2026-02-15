# 📋 PRE-SUBMISSION CHECKLIST
## Real-Time Poll Rooms Assignment

**Deadline:** Monday, 17 Feb 2026, 11:59 PM IST
**Use this checklist 2-3 hours BEFORE submission**

---

## ✅ PART 1: FUNCTIONALITY VERIFICATION

### Core Features
- [ ] **Poll Creation**
  - [ ] Can create poll with 2 options
  - [ ] Can create poll with 10 options
  - [ ] Cannot create poll with 1 option (validation works)
  - [ ] Cannot create poll with empty question (validation works)
  - [ ] Shareable link is generated correctly
  - [ ] Link is copyable to clipboard

- [ ] **Join by Link**
  - [ ] Clicking share link opens poll in new browser/tab
  - [ ] Poll displays question correctly
  - [ ] All options are visible
  - [ ] Vote counts are shown

- [ ] **Real-Time Updates**
  - [ ] Open poll in 3 different tabs/browsers
  - [ ] Vote in one tab
  - [ ] Verify other 2 tabs update WITHOUT refresh (within 2 seconds)
  - [ ] Vote counts match across all tabs
  - [ ] No console errors during real-time update

- [ ] **Anti-Abuse Mechanisms**
  - [ ] **Test Device Fingerprinting:**
    - [ ] Vote on a poll
    - [ ] Try to vote again → Should be blocked
    - [ ] Error message is user-friendly
    - [ ] Refresh page → Still blocked
  - [ ] **Test IP Rate Limiting:**
    - [ ] Vote on a poll
    - [ ] Open poll in incognito/private mode
    - [ ] Try to vote → Should be blocked (same IP)
    - [ ] Wait 10 minutes OR use mobile hotspot → Should work

- [ ] **Persistence**
  - [ ] Create a poll
  - [ ] Close browser completely
  - [ ] Re-open poll link → Data is still there
  - [ ] Vote counts are preserved
  - [ ] Restart your computer → Link still works

---

## 🌐 PART 2: DEPLOYMENT VERIFICATION

### Live URLs
- [ ] Production app URL is accessible: `https://_____.vercel.app`
- [ ] Socket server URL is accessible: `https://_____.railway.app/health`
- [ ] Both URLs are HTTPS (not HTTP)
- [ ] No CORS errors in browser console

### End-to-End Test on Production
- [ ] Create poll on production site
- [ ] Share link to a friend/another device
- [ ] Both vote simultaneously
- [ ] Real-time updates work on production
- [ ] No 500 errors in network tab

### Mobile Testing
- [ ] Open poll on mobile browser (Chrome/Safari)
- [ ] UI is responsive (no horizontal scroll)
- [ ] Can vote successfully
- [ ] Real-time updates work on mobile

---

## 📝 PART 3: CODE QUALITY

### GitHub Repository
- [ ] Repo is PUBLIC (not private)
- [ ] All code is pushed to main branch
- [ ] No `.env` files committed (check .gitignore)
- [ ] No API keys exposed in code
- [ ] Repository name is professional (e.g., "poll-rooms", not "test-app")

### Code Structure
- [ ] No commented-out code blocks
- [ ] No `console.log` debug statements (or minimal)
- [ ] Proper error handling (try/catch blocks)
- [ ] TypeScript types are defined (not using `any`)
- [ ] Code is formatted consistently

### Dependencies
- [ ] `package.json` has all dependencies
- [ ] No unused packages
- [ ] Versions are specified (not `^` wildcard)

---

## 📄 PART 4: DOCUMENTATION

### README.md
- [ ] Live demo URL is correct and clickable
- [ ] Tech stack is listed
- [ ] **Anti-abuse mechanisms section includes:**
  - [ ] Clear explanation of BOTH mechanisms
  - [ ] What each prevents
  - [ ] Known limitations
  - [ ] Code examples (bonus points)
- [ ] Edge cases section lists at least 5 cases
- [ ] Known limitations section is honest and thorough
- [ ] Setup instructions are clear
- [ ] No typos or grammatical errors

### README.md Template Check
Use this structure:
```markdown
# Title
Live Demo: [URL]

## Features (bullet points)

## Tech Stack (bullet points)

## Anti-Abuse Mechanisms
### 1. [Name]
**Prevents:** ...
**How it works:** ...
**Limitations:** ...

### 2. [Name]
**Prevents:** ...
**How it works:** ...
**Limitations:** ...

## Edge Cases Handled
1. ...
2. ...
3. ...

## Known Limitations
1. ...
2. ...
3. ...

## Setup Instructions
...
```

---

## 🔒 PART 5: SECURITY CHECK

- [ ] No hardcoded database credentials
- [ ] No API keys in frontend code
- [ ] Environment variables are used correctly
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (React escapes by default, but check)
- [ ] CSRF protection (not critical for this assignment)

---

## 🎨 PART 6: UI/UX POLISH

### Visual
- [ ] No broken layouts on desktop (1920x1080)
- [ ] No broken layouts on mobile (375x667)
- [ ] Colors are pleasant (not default blue/gray)
- [ ] Loading states are shown (spinners, skeletons)
- [ ] Error messages are user-friendly (not "Error 500")

### User Experience
- [ ] Voting is intuitive (clear buttons)
- [ ] Success feedback after voting (toast/message)
- [ ] Share button is prominent
- [ ] Copy-to-clipboard works
- [ ] No unexpected page reloads

---

## 🧪 PART 7: EDGE CASE TESTING

### Test These Specific Scenarios:
- [ ] **404 Poll:**
  - [ ] Visit `https://your-app.com/p/invalid-slug`
  - [ ] Should show "Poll not found" page
  - [ ] Should NOT crash or show error page

- [ ] **Empty Inputs:**
  - [ ] Try to create poll with blank question
  - [ ] Try to create poll with 1 empty option
  - [ ] Should show validation error

- [ ] **Long Inputs:**
  - [ ] Create poll with 200-character question
  - [ ] Create poll with 100-character options
  - [ ] Should work without breaking UI

- [ ] **Concurrent Voting:**
  - [ ] Have 2 people vote at EXACT same time
  - [ ] Vote counts should be accurate (not drift)
  - [ ] No race conditions

- [ ] **Socket Disconnect:**
  - [ ] Open poll
  - [ ] Disconnect WiFi for 10 seconds
  - [ ] Reconnect WiFi
  - [ ] Should auto-reconnect and sync
  - [ ] No manual refresh needed

- [ ] **Special Characters:**
  - [ ] Create poll with emojis: "What's your favorite? 🍕🍔🍟"
  - [ ] Should display correctly
  - [ ] Voting should work

---

## 📊 PART 8: PERFORMANCE CHECK

- [ ] Page loads in <3 seconds on 3G
- [ ] No memory leaks (leave poll open for 5 minutes, check DevTools)
- [ ] Socket reconnects automatically (test by restarting socket server)
- [ ] Database queries are optimized (check Supabase logs)

---

## 📮 PART 9: SUBMISSION FORM

Before filling out the Google Form:

### Prepare These:
- [ ] **Public URL:** `https://_____.vercel.app`
- [ ] **GitHub URL:** `https://github.com/username/repo`
- [ ] **Notes Document:** Can be in README or separate file

### Notes Must Include:
- [ ] Anti-abuse mechanism #1 explanation
- [ ] Anti-abuse mechanism #2 explanation
- [ ] Edge cases handled (minimum 5)
- [ ] Known limitations (minimum 3)

### Final Checks:
- [ ] All URLs are clickable (no typos)
- [ ] GitHub repo is PUBLIC
- [ ] README is visible on repo homepage
- [ ] Test all links one final time

---

## 🚀 PART 10: LAST-MINUTE VERIFICATION (2 hours before deadline)

### The Nuclear Test:
1. [ ] Clear browser cache completely
2. [ ] Open production URL in incognito mode
3. [ ] Create a poll
4. [ ] Vote on it
5. [ ] Share to mobile device
6. [ ] Vote from mobile
7. [ ] Verify real-time update on both devices

If ANY step fails, DO NOT SUBMIT. Fix it first.

---

## 🎯 PART 11: COMPETITIVE ADVANTAGE

### Go Above and Beyond (Optional but Impressive):
- [ ] Add loading animations (e.g., fade-in for options)
- [ ] Add vote animation (e.g., confetti on vote)
- [ ] Add dark mode toggle
- [ ] Add poll expiration feature
- [ ] Add poll result export (CSV)
- [ ] Add social sharing meta tags
- [ ] Add favicon
- [ ] Add 404 page design
- [ ] Add analytics (how many polls created)

### Code Quality Bonuses:
- [ ] Add TypeScript types for all components
- [ ] Add JSDoc comments for complex functions
- [ ] Add unit tests (Jest) for utility functions
- [ ] Add integration tests (Playwright)
- [ ] Add CI/CD pipeline (GitHub Actions)

---

## ⚠️ COMMON MISTAKES TO AVOID

### ❌ DO NOT:
- [ ] Submit without testing on production
- [ ] Forget to make GitHub repo public
- [ ] Leave `.env` file in repo
- [ ] Submit broken links
- [ ] Copy-paste README from template without customizing
- [ ] Use weak anti-abuse (just localStorage)
- [ ] Ignore mobile responsiveness
- [ ] Have console errors on production
- [ ] Submit at 11:58 PM (too risky)

### ✅ DO:
- [ ] Test EVERYTHING one final time
- [ ] Proofread README for typos
- [ ] Check all URLs are correct
- [ ] Have a friend test your app
- [ ] Submit at least 2 hours early
- [ ] Take screenshots of working app (backup)
- [ ] Export database backup
- [ ] Save all logs/screenshots

---

## 📞 EMERGENCY TROUBLESHOOTING (If Something Breaks)

### Deployment Fails:
1. Check build logs in Vercel/Railway
2. Verify all env vars are set
3. Test build locally: `npm run build`
4. Check for TypeScript errors
5. Worst case: Deploy to Netlify instead

### Database Connection Fails:
1. Check Supabase dashboard status
2. Verify connection string in env vars
3. Test query in Supabase SQL editor
4. Check IP allowlist (should be 0.0.0.0/0)
5. Worst case: Spin up new Supabase project

### Socket.io Not Working:
1. Check socket server is running (visit /health)
2. Verify CORS settings
3. Check SOCKET_URL env var in Vercel
4. Test socket connection directly (Postman/curl)
5. Worst case: Use Firebase Realtime Database

---

## 🏁 FINAL SUBMISSION CHECKLIST

**30 minutes before submission:**

- [ ] ✅ Functionality works end-to-end
- [ ] ✅ Deployment is stable
- [ ] ✅ GitHub repo is public
- [ ] ✅ README is comprehensive
- [ ] ✅ Notes explain anti-abuse clearly
- [ ] ✅ All URLs are correct
- [ ] ✅ Tested on mobile
- [ ] ✅ No console errors
- [ ] ✅ No broken features
- [ ] ✅ Form is filled out

**If ALL boxes are checked: SUBMIT ✅**
**If ANY box is unchecked: FIX IT FIRST ⚠️**

---

## 📧 AFTER SUBMISSION

- [ ] Take screenshots of submitted app
- [ ] Save submission confirmation email
- [ ] Export database backup
- [ ] Document any known issues
- [ ] Prepare to demo if asked
- [ ] Keep app running until results are announced

---

## 🎉 CONFIDENCE METER

Rate your confidence (1-5) on each:

| Feature | Confidence (1-5) |
|---------|------------------|
| Core functionality | __/5 |
| Real-time updates | __/5 |
| Anti-abuse strength | __/5 |
| Deployment stability | __/5 |
| Code quality | __/5 |
| Documentation | __/5 |

**If any score is <4: Fix it before submitting.**

---

## 💪 FINAL MOTIVATION

You've got this! Remember:
- **Working app > Perfect app**
- **Test everything twice**
- **Document clearly**
- **Submit early**
- **Stay calm**

Good luck! 🚀

---

**Checklist Version:** 1.0
**Last Updated:** Feb 14, 2026
**Time Remaining:** ~58 hours

# RIPER PLAN: Agent Registration UI Implementation

**Project:** Clawork - AI Agent Bounty Marketplace
**Date:** 2026-02-06
**Branch:** main
**Status:** PLAN MODE - READY FOR REVIEW

---

## Executive Summary

This plan implements a comprehensive UI for agent registration in the Clawork bounty marketplace. The feature will add "Register Agent" navigation links and integrate the existing `AgentRegistrationForm` component into the user experience flow.

**Scope:**
- Add "Register Agent" button to main navigation (Navbar component)
- Add "Register Agent" option to Dashboard page (for users not yet registered)
- Ensure consistent UX patterns with existing bounty/dashboard flows
- Leverage existing AgentRegistrationForm component and API endpoints

**Impact:**
- Makes agent registration discoverable from any page
- Provides clear onboarding path for new agents
- Improves user experience for first-time users
- No breaking changes to existing functionality

**Files Modified:** 2 files
- `frontend/components/Navbar.tsx` - Add navigation link
- `frontend/app/dashboard/page.tsx` - Add registration prompt

**Files Utilized (no changes):**
- `frontend/app/register/page.tsx` - Existing registration page
- `frontend/components/agents/AgentRegistrationForm.tsx` - Existing form component
- `frontend/app/api/agents/route.ts` - Existing API endpoint

**Risk Level:** LOW - Minimal changes, no breaking modifications
**Estimated Implementation Time:** 30-45 minutes

---

## Context Analysis

### Current State

#### Existing Registration Infrastructure
The codebase already has a complete agent registration system:

1. **Registration Page** (`frontend/app/register/page.tsx`)
   - Clean, centered layout with title and description
   - Imports and renders `AgentRegistrationForm` component
   - Route: `/register`

2. **Registration Form Component** (`frontend/components/agents/AgentRegistrationForm.tsx`)
   - Three-step flow: form → minting → complete
   - Wallet connection requirement
   - Skills selection (common + custom)
   - Firebase registration + optional ERC-8004 minting
   - Comprehensive error handling and loading states
   - Integration with `useRegisterIdentity` hook

3. **API Endpoint** (`frontend/app/api/agents/route.ts`)
   - POST `/api/agents` - Creates agent in Firebase
   - PATCH `/api/agents` - Updates with ERC-8004 ID after minting
   - GET `/api/agents` - Lists agents with filtering
   - Full validation and error handling

4. **Hooks** (`frontend/lib/hooks/useIdentityRegistry.ts`)
   - `useRegisterIdentity()` - Mints ERC-8004 NFT
   - IPFS metadata upload
   - Transaction waiting and confirmation

#### Current Navigation Structure (`frontend/components/Navbar.tsx`)
```
Desktop Navigation:
- Bounties (always visible)
- Post Bounty (only when wallet connected)
- Dashboard (only when wallet connected)
- Blog (always visible)
- Docs (always visible)
- Twitter (always visible)
- Connect Wallet button (RainbowKit)

Mobile Navigation:
- Bounties (always visible)
- Connect Wallet button (simplified)
```

**Observations:**
- Navigation links are conditionally rendered based on wallet connection
- No current link to `/register` page
- Uses consistent styling: `text-sm font-medium hover:text-primary transition-colors`
- Responsive design with different mobile/desktop layouts

#### Current Dashboard Structure (`frontend/app/dashboard/page.tsx`)
```
When NOT connected:
- Shows "Connect your wallet" prompt with ConnectButton

When connected but NO agent profile:
- Currently shows stats with zeros
- Shows "No active bounties" message
- Does NOT prompt user to register as agent

When connected WITH agent profile:
- Shows agent card with name, wallet, skills, reputation
- Shows tabs: Active Work, My Bounties, Completed, Feedback
- Shows various empty states with CTAs to Browse Bounties or Post Bounty
```

**Gap Identified:**
The Dashboard currently does not guide users who haven't registered as agents. They see empty stats and no clear path to register.

---

## Technical Specification

### 1. Navigation Bar Enhancement

**File:** `frontend/components/Navbar.tsx`

**Goal:** Add "Register Agent" link to navigation when:
- User wallet is connected
- User is NOT already registered as an agent (optional enhancement)

**Design Decisions:**

**Option A: Always Show When Connected (RECOMMENDED)**
- Simpler implementation
- Visible to all connected users
- Page handles "already registered" state gracefully
- Consistent with existing "Post Bounty" pattern

**Option B: Conditionally Show Based on Registration Status**
- Requires fetching agent status in Navbar
- Adds complexity and potential loading states
- Better UX but more code

**Selected Approach:** Option A (simpler, sufficient)

**Placement:**
- Desktop: After "Bounties", before "Post Bounty"
- Mobile: Not shown (space constraints) - users can access via Dashboard

**Visual Design:**
- Matches existing navigation link styling
- Same hover effect and transitions
- Primary color highlight on hover

---

### 2. Dashboard Registration Prompt

**File:** `frontend/app/dashboard/page.tsx`

**Goal:** When user is connected but NOT registered, show prominent registration prompt

**Design Pattern:**
Similar to existing empty states, but prioritized above stats since registration is a prerequisite for meaningful dashboard use.

**Visual Design:**
- Info banner style (blue/primary background)
- Icon + text + CTA button
- Positioned above stats section
- Dismissible (optional enhancement)

**Conditions:**
```
if (isConnected && !agent) {
  // Show registration prompt
}
```

---

## Implementation Plan

### Step 1: Add Register Agent Link to Navbar

**File:** `frontend/components/Navbar.tsx`
**Lines to modify:** Around 30-46 (desktop navigation section)

**Change 1.1: Add Register Agent link in desktop navigation**

**Current code (lines 25-47):**
```typescript
<div className="hidden md:flex items-center space-x-6">
  <Link
    className="text-sm font-medium hover:text-primary transition-colors"
    href="/bounties"
  >
    Bounties
  </Link>
  {isConnected && (
    <>
      <Link
        className="text-sm font-medium hover:text-primary transition-colors"
        href="/bounties/create"
      >
        Post Bounty
      </Link>
      <Link
        className="text-sm font-medium hover:text-primary transition-colors"
        href="/dashboard"
      >
        Dashboard
      </Link>
    </>
  )}
  <Link ... >Blog</Link>
  <Link ... >Docs</Link>
  <a ... >Twitter</a>
  <ConnectButton ... />
</div>
```

**New code:**
```typescript
<div className="hidden md:flex items-center space-x-6">
  <Link
    className="text-sm font-medium hover:text-primary transition-colors"
    href="/bounties"
  >
    Bounties
  </Link>
  {isConnected && (
    <>
      <Link
        className="text-sm font-medium hover:text-primary transition-colors"
        href="/register"
      >
        Register Agent
      </Link>
      <Link
        className="text-sm font-medium hover:text-primary transition-colors"
        href="/bounties/create"
      >
        Post Bounty
      </Link>
      <Link
        className="text-sm font-medium hover:text-primary transition-colors"
        href="/dashboard"
      >
        Dashboard
      </Link>
    </>
  )}
  <Link ... >Blog</Link>
  <Link ... >Docs</Link>
  <a ... >Twitter</a>
  <ConnectButton ... />
</div>
```

**Changes:**
- Add new Link component pointing to `/register`
- Place after "Bounties", before "Post Bounty"
- Use exact same styling as other links
- Inside `{isConnected && (<> ... </>)}` block

**Validation:**
- Link appears only when wallet is connected
- Link navigates to `/register` page
- Hover effect matches other links
- Spacing is consistent (space-x-6)

---

### Step 2: Add Registration Prompt to Dashboard

**File:** `frontend/app/dashboard/page.tsx`
**Lines to modify:** Around 110-116 (after Navbar, before stats)

**Change 2.1: Add registration prompt banner**

**Current code (lines 110-136):**
```typescript
return (
  <div className="min-h-screen bg-background-dark">
    <Navbar />

    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-8">Dashboard</h1>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="text-slate-400 text-sm mb-1">Total Earnings</div>
          <div className="text-2xl font-bold text-primary">${totalEarnings}</div>
        </div>
        {/* ... more stats ... */}
      </div>

      {/* Agent Profile Card */}
      {agent && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-8">
          {/* ... agent profile ... */}
        </div>
      )}
```

**New code:**
```typescript
return (
  <div className="min-h-screen bg-background-dark">
    <Navbar />

    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-8">Dashboard</h1>

      {/* Registration Prompt - Show when connected but not registered */}
      {!agent && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 text-primary text-2xl mt-1">
              <span className="material-symbols-outlined">person_add</span>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white mb-2">
                Register as an Agent
              </h2>
              <p className="text-slate-300 mb-4">
                Register your AI agent to claim bounties, build reputation, and earn rewards.
                Registration includes optional on-chain identity (ERC-8004) for portable reputation.
              </p>
              <button
                onClick={() => router.push('/register')}
                className="bg-primary text-background-dark px-6 py-3 rounded-lg font-bold hover:opacity-90 transition-opacity"
              >
                Register Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="text-slate-400 text-sm mb-1">Total Earnings</div>
          <div className="text-2xl font-bold text-primary">${totalEarnings}</div>
        </div>
        {/* ... more stats ... */}
      </div>

      {/* Agent Profile Card */}
      {agent && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-8">
          {/* ... agent profile ... */}
        </div>
      )}
```

**Changes:**
- Add conditional banner before stats section
- Show only when `!agent` (not registered)
- Use Material Symbols icon `person_add` (already loaded in layout.tsx)
- Primary color theme for visibility
- Clear heading and description
- CTA button navigates to `/register`
- Matches existing banner pattern (similar to `pendingReview` alert)

**Design Notes:**
- Background: `bg-primary/10` (subtle primary tint)
- Border: `border-primary/30` (visible primary accent)
- Icon: Material Symbols (consistent with existing usage)
- Button: Full primary style (high contrast)
- Layout: Flexbox with icon on left, content on right

**Validation:**
- Banner shows only when connected and `!agent`
- Banner hides when agent is registered
- Click "Register Now" navigates to `/register`
- Responsive layout (mobile-friendly)

---

### Step 3: Optional Enhancement - "Already Registered" State on Register Page

**File:** `frontend/app/register/page.tsx` (NO CHANGES REQUIRED)

**Current Behavior:**
The `AgentRegistrationForm` component already handles "already registered" state:
- Lines 42-53: Checks for existing ERC-8004 identity
- Lines 131-136: If agent already exists in Firebase, shows success message and redirects

**Enhancement Opportunity (Future):**
Could add a banner at the top of the register page:
```typescript
{agent && (
  <div className="max-w-md mx-auto mb-4 bg-primary/10 border border-primary/30 rounded-xl p-4 text-center">
    <p className="text-primary">You're already registered!</p>
    <Link href="/dashboard" className="text-white underline">Go to Dashboard</Link>
  </div>
)}
```

**Decision:** Skip this for now. The form component already handles it gracefully.

---

## Component Interaction Flow

### User Journey: New Agent Registration

**Path 1: Via Navigation**
```
1. User connects wallet (any page)
2. "Register Agent" link appears in Navbar
3. Click "Register Agent"
4. Navigate to /register
5. Fill out form (name, skills)
6. Submit to Firebase
7. Optional: Mint ERC-8004 NFT
8. Redirect to /bounties
```

**Path 2: Via Dashboard**
```
1. User connects wallet
2. Navigate to /dashboard (or lands there after connecting)
3. See "Register as an Agent" banner
4. Click "Register Now"
5. Navigate to /register
6. Fill out form (name, skills)
7. Submit to Firebase
8. Optional: Mint ERC-8004 NFT
9. Redirect to /bounties
10. Return to /dashboard → see full agent profile
```

**Path 3: Already Registered**
```
1. User connects wallet (already registered previously)
2. "Register Agent" link still visible in Navbar
3. Navigate to /register
4. Form detects existing registration
5. Shows success message: "Agent already registered"
6. Redirects to /bounties
```

### State Management

**Navbar Component:**
- State: `{ isConnected }` from `useAccount()`
- No need to fetch agent data (keep simple)
- Link always visible when connected

**Dashboard Component:**
- State: `{ address, isConnected }` from `useAccount()`
- State: `{ agent, loading }` from API fetch
- Conditional rendering: `{!agent && (<registration prompt>)}`

**Register Page:**
- No state management (static layout)
- Delegates to `AgentRegistrationForm` component

**AgentRegistrationForm Component:**
- Complex state (already implemented):
  - Form state: name, skills
  - Registration step: form | minting | complete
  - Loading states: loading, isMinting, isConfirming
  - Error handling
  - ERC-8004 identity check

---

## Visual Design Specifications

### Navbar Link Styling

**Desktop:**
```css
Link {
  className: "text-sm font-medium hover:text-primary transition-colors"
}

Default state:
- Font size: 0.875rem (14px)
- Font weight: 500
- Color: inherit (white from parent)

Hover state:
- Color: var(--color-primary) (emerald green #10B981)
- Transition: colors
```

**Mobile:**
Not shown (space constraints, access via Dashboard)

### Dashboard Registration Banner

**Container:**
```css
div {
  className: "bg-primary/10 border border-primary/30 rounded-xl p-6 mb-8"
}

Styles:
- Background: rgba(16, 185, 129, 0.1) (10% opacity primary)
- Border: 1px solid rgba(16, 185, 129, 0.3) (30% opacity primary)
- Border radius: 0.75rem (12px)
- Padding: 1.5rem (24px)
- Margin bottom: 2rem (32px)
```

**Layout:**
```css
Inner flex container:
- Flexbox with gap-4 (1rem / 16px)
- Align items: start
- Icon: flex-shrink-0, size 2xl, primary color
- Content: flex-1
```

**Typography:**
```css
Heading (h2):
- Font size: 1.25rem (20px)
- Font weight: 700 (bold)
- Color: white
- Margin bottom: 0.5rem (8px)

Description (p):
- Color: slate-300
- Margin bottom: 1rem (16px)

Button:
- Background: primary (#10B981)
- Text: background-dark (dark slate)
- Padding: 0.75rem 1.5rem (12px 24px)
- Border radius: 0.5rem (8px)
- Font weight: 700
- Hover: opacity-90
```

**Icon:**
Material Symbols Outlined: `person_add`
- Already loaded in layout.tsx (line 29-31)
- Font size: 2xl (1.5rem / 24px)
- Color: primary

---

## Testing & Validation Checklist

### Pre-Implementation
- [ ] Review existing registration flow
- [ ] Confirm API endpoint is functional
- [ ] Verify `/register` route exists
- [ ] Check AgentRegistrationForm component works

### Post-Implementation - Navbar

**Desktop View:**
- [ ] "Register Agent" link appears when wallet connected
- [ ] Link is hidden when wallet not connected
- [ ] Link navigates to `/register` on click
- [ ] Hover effect shows primary color
- [ ] Spacing between links is consistent
- [ ] Link order: Bounties → Register Agent → Post Bounty → Dashboard

**Mobile View:**
- [ ] Navigation still functional (Register Agent not shown)
- [ ] No layout issues or overflow
- [ ] Connect button still works

**Responsive:**
- [ ] Test at breakpoints: 768px, 1024px, 1440px
- [ ] No horizontal scroll
- [ ] Links don't wrap awkwardly

### Post-Implementation - Dashboard

**When NOT Connected:**
- [ ] No changes to existing "Connect wallet" prompt
- [ ] Registration banner not shown

**When Connected, NOT Registered:**
- [ ] Registration banner appears
- [ ] Banner shows above stats section
- [ ] Icon renders correctly (Material Symbols)
- [ ] Text is readable and properly styled
- [ ] "Register Now" button navigates to `/register`
- [ ] Button hover effect works
- [ ] Stats section still visible below

**When Connected, REGISTERED:**
- [ ] Registration banner is hidden
- [ ] Agent profile card shows
- [ ] No layout shifts or gaps
- [ ] Dashboard functions normally

**Responsive:**
- [ ] Banner is readable on mobile (320px width)
- [ ] Icon doesn't overflow
- [ ] Button doesn't overflow
- [ ] Text wraps properly

### End-to-End User Flow

**Test Case 1: New User Registration via Navbar**
1. [ ] Open app without wallet connected
2. [ ] Connect wallet → "Register Agent" link appears
3. [ ] Click "Register Agent" → navigate to `/register`
4. [ ] Fill form → submit → success
5. [ ] Redirected to `/bounties`
6. [ ] Return to Dashboard → see agent profile (no banner)

**Test Case 2: New User Registration via Dashboard**
1. [ ] Connect wallet
2. [ ] Navigate to `/dashboard`
3. [ ] See registration banner
4. [ ] Click "Register Now" → navigate to `/register`
5. [ ] Fill form → submit → success
6. [ ] Return to Dashboard → see agent profile (no banner)

**Test Case 3: Already Registered User**
1. [ ] Connect wallet (with existing agent)
2. [ ] Navigate to Dashboard → NO registration banner
3. [ ] See agent profile card
4. [ ] Click "Register Agent" in Navbar → navigate to `/register`
5. [ ] Form shows "Agent already registered" → redirects

**Test Case 4: Wallet State Changes**
1. [ ] Connect wallet → links appear
2. [ ] Disconnect wallet → links disappear
3. [ ] Reconnect wallet → links reappear
4. [ ] Switch wallet → state updates correctly

### Accessibility

- [ ] Links are keyboard navigable (Tab key)
- [ ] Links have visible focus state
- [ ] Button is keyboard accessible
- [ ] Screen reader announces link text correctly
- [ ] Color contrast meets WCAG AA (primary green on dark background)

### Cross-Browser

- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (desktop)
- [ ] Safari (iOS)
- [ ] Chrome (Android)

### Performance

- [ ] No additional network requests in Navbar
- [ ] Dashboard: Agent fetch already exists (no new API calls)
- [ ] No layout shift when banner appears
- [ ] No jank when navigating to /register

---

## Edge Cases & Error Handling

### Edge Case 1: Slow Network
**Scenario:** Dashboard agent data takes time to load
**Current Behavior:** `loading` state shows "Loading dashboard..."
**Impact:** Registration banner won't show during loading
**Resolution:** Acceptable - loading state is brief

### Edge Case 2: API Error
**Scenario:** Agent fetch fails
**Current Behavior:** `agent` remains `null`
**Impact:** Registration banner shows (correct behavior)
**Resolution:** Works as intended

### Edge Case 3: User Registers in Another Tab
**Scenario:** User has Dashboard open, registers in new tab
**Current Behavior:** Dashboard doesn't auto-refresh
**Impact:** Banner still shows until page refresh
**Resolution:** Acceptable - user can manually refresh

### Edge Case 4: Partial Registration
**Scenario:** User submits form but skips ERC-8004 minting
**Current Behavior:** Agent created in Firebase, redirects to bounties
**Impact:** Dashboard shows agent profile (correct)
**Resolution:** Works as intended

### Edge Case 5: Network Switch
**Scenario:** User switches networks after connecting
**Current Behavior:** Wagmi handles network state
**Impact:** Agent data may be stale
**Resolution:** Acceptable - agent registration is network-agnostic (stored in Firebase)

---

## Risk Assessment

### Low Risk
- **Navigation link addition:** Minimal code change, standard pattern
- **Dashboard banner:** Conditional rendering, no state mutations
- **No API changes:** Using existing endpoints
- **No breaking changes:** Purely additive features

### Potential Issues

**Issue 1: Layout Shift**
- **Risk:** Banner appearance causes jarring layout shift
- **Mitigation:** Banner has fixed height, appears before stats
- **Severity:** Low - CSS handles smoothly

**Issue 2: Mobile Overflow**
- **Risk:** Long text in banner overflows on small screens
- **Mitigation:** Use responsive text sizing, test at 320px
- **Severity:** Low - Tailwind handles responsively

**Issue 3: Icon Not Loading**
- **Risk:** Material Symbols icon fails to render
- **Mitigation:** Icons already loaded in layout.tsx, verify with DevTools
- **Severity:** Very Low - fallback is acceptable (no icon)

**Issue 4: Double Registration Prompt**
- **Risk:** User sees banner AND could navigate to /register
- **Mitigation:** Intended behavior - multiple paths improve UX
- **Severity:** Not an issue - by design

---

## Success Criteria

### Critical (Must Have)
- [ ] "Register Agent" link appears in Navbar when wallet connected
- [ ] Link navigates to `/register` page
- [ ] Dashboard shows registration banner when not registered
- [ ] Banner button navigates to `/register` page
- [ ] Banner disappears when user is registered
- [ ] No visual bugs or layout issues
- [ ] Mobile responsive design works

### Important (Should Have)
- [ ] Hover effects work correctly
- [ ] Color contrast meets accessibility standards
- [ ] Icon renders properly
- [ ] Smooth transitions and no layout shift

### Nice to Have (Could Have)
- [ ] Analytics tracking for registration CTA clicks
- [ ] A/B test banner text variations
- [ ] Dismissible banner (localStorage persistence)
- [ ] Animated icon on hover

---

## Implementation Steps Summary

### Step 1: Modify Navbar Component (10 minutes)
1. Open `frontend/components/Navbar.tsx`
2. Locate desktop navigation section (lines 25-47)
3. Add new Link component for "Register Agent"
4. Place after "Bounties", before "Post Bounty"
5. Use existing Link styling pattern
6. Save and verify TypeScript compiles

### Step 2: Modify Dashboard Component (20 minutes)
1. Open `frontend/app/dashboard/page.tsx`
2. Locate main return statement (around line 110)
3. Add registration banner conditional block
4. Insert after `<h1>` and before stats grid
5. Implement Material Symbols icon
6. Add onClick handler for button
7. Save and verify TypeScript compiles

### Step 3: Testing (15 minutes)
1. Run `npm run dev` in frontend directory
2. Test with wallet connected/disconnected
3. Test registration flow end-to-end
4. Test on mobile viewport
5. Verify accessibility with keyboard navigation
6. Check browser console for errors

### Total Time: 45 minutes

---

## Rollback Plan

### If Issues Arise

**Rollback Navbar Changes:**
```typescript
// Remove the Register Agent link (3 lines):
<Link
  className="text-sm font-medium hover:text-primary transition-colors"
  href="/register"
>
  Register Agent
</Link>
```

**Rollback Dashboard Changes:**
```typescript
// Remove the registration banner (entire conditional block):
{!agent && (
  <div className="bg-primary/10 border border-primary/30 rounded-xl p-6 mb-8">
    {/* ... entire banner ... */}
  </div>
)}
```

**Emergency Rollback:**
```bash
git restore frontend/components/Navbar.tsx
git restore frontend/app/dashboard/page.tsx
```

---

## Post-Implementation Tasks

### Code Quality
- [ ] Remove any debug console.logs
- [ ] Verify TypeScript strict checks pass
- [ ] Run ESLint and fix warnings
- [ ] Check for unused imports

### Documentation
- [ ] Update internal README if needed
- [ ] Document user flow in team wiki
- [ ] Add screenshots to design system

### Future Enhancements
- [ ] Track registration conversion rate (analytics)
- [ ] Add tooltip explaining ERC-8004 benefits
- [ ] Implement banner dismiss functionality
- [ ] Consider highlighting "Register Agent" link on first visit
- [ ] Add agent count to homepage ("Join X+ agents")

---

## File Structure Summary

### Files to Modify
```
frontend/
├── components/
│   └── Navbar.tsx                    # ADD: Register Agent link
└── app/
    └── dashboard/
        └── page.tsx                  # ADD: Registration banner
```

### Files Used (No Changes)
```
frontend/
├── app/
│   ├── register/
│   │   └── page.tsx                 # Existing registration page
│   └── api/
│       └── agents/
│           └── route.ts             # Existing API endpoints
├── components/
│   └── agents/
│       └── AgentRegistrationForm.tsx # Existing form component
└── lib/
    └── hooks/
        └── useIdentityRegistry.ts    # Existing hooks
```

---

## References

### Existing Patterns to Follow

**Navigation Link Pattern:**
```typescript
<Link
  className="text-sm font-medium hover:text-primary transition-colors"
  href="/path"
>
  Link Text
</Link>
```

**Banner Pattern (from Dashboard):**
```typescript
{pendingReview.length > 0 && (
  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
    <div className="flex items-center gap-2">
      <span className="text-yellow-400 text-lg">!</span>
      <span className="text-yellow-400">
        You have {pendingReview.length} submission{pendingReview.length > 1 ? 's' : ''} to review
      </span>
    </div>
  </div>
)}
```

**Material Symbols Usage (from layout.tsx):**
```html
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
/>
```

**Router Navigation:**
```typescript
import { useRouter } from 'next/navigation';
const router = useRouter();
router.push('/path');
```

---

## Approval Checklist

Before moving to EXECUTE mode, verify:

- [x] Existing registration infrastructure is complete
- [x] Changes are minimal and non-breaking
- [x] Design specifications are clear
- [x] Component interaction flow is documented
- [x] Edge cases are considered
- [x] Testing checklist is comprehensive
- [x] Rollback plan is simple and clear
- [x] Implementation steps are numbered and specific
- [x] Timeline is realistic (45 minutes)

**Status:** READY FOR IMPLEMENTATION

---

## Implementation Code Blocks

### Navbar.tsx - Complete Modified Section

**Location:** Lines 25-47

```typescript
<div className="hidden md:flex items-center space-x-6">
  <Link
    className="text-sm font-medium hover:text-primary transition-colors"
    href="/bounties"
  >
    Bounties
  </Link>
  {isConnected && (
    <>
      <Link
        className="text-sm font-medium hover:text-primary transition-colors"
        href="/register"
      >
        Register Agent
      </Link>
      <Link
        className="text-sm font-medium hover:text-primary transition-colors"
        href="/bounties/create"
      >
        Post Bounty
      </Link>
      <Link
        className="text-sm font-medium hover:text-primary transition-colors"
        href="/dashboard"
      >
        Dashboard
      </Link>
    </>
  )}
  <Link
    className="text-sm font-medium hover:text-primary transition-colors"
    href="/blog"
  >
    Blog
  </Link>
  <Link
    className="text-sm font-medium hover:text-primary transition-colors"
    href="/docs/agents"
  >
    Docs
  </Link>
  <a
    className="text-sm font-medium hover:text-primary transition-colors"
    href="https://twitter.com/clawork"
    target="_blank"
    rel="noopener noreferrer"
  >
    Twitter
  </a>
  <ConnectButton
    chainStatus="icon"
    showBalance={false}
    accountStatus={{
      smallScreen: 'avatar',
      largeScreen: 'full',
    }}
  />
</div>
```

### Dashboard.tsx - Registration Banner

**Location:** Insert after line 115 (after `<h1>` tag)

```typescript
{/* Registration Prompt - Show when connected but not registered */}
{!agent && (
  <div className="bg-primary/10 border border-primary/30 rounded-xl p-6 mb-8">
    <div className="flex items-start gap-4">
      <div className="flex-shrink-0 text-primary text-2xl mt-1">
        <span className="material-symbols-outlined">person_add</span>
      </div>
      <div className="flex-1">
        <h2 className="text-xl font-bold text-white mb-2">
          Register as an Agent
        </h2>
        <p className="text-slate-300 mb-4">
          Register your AI agent to claim bounties, build reputation, and earn rewards.
          Registration includes optional on-chain identity (ERC-8004) for portable reputation.
        </p>
        <button
          onClick={() => router.push('/register')}
          className="bg-primary text-background-dark px-6 py-3 rounded-lg font-bold hover:opacity-90 transition-opacity"
        >
          Register Now
        </button>
      </div>
    </div>
  </div>
)}
```

---

## Timeline

| Step | Task | Time | Cumulative |
|------|------|------|------------|
| 1 | Read and understand existing code | 5 min | 5 min |
| 2 | Modify Navbar.tsx | 5 min | 10 min |
| 3 | Modify Dashboard.tsx | 15 min | 25 min |
| 4 | Manual testing (desktop) | 10 min | 35 min |
| 5 | Manual testing (mobile) | 5 min | 40 min |
| 6 | Cross-browser verification | 5 min | 45 min |

**Total:** 45 minutes

---

## Conclusion

This plan implements a simple, effective UI enhancement to make agent registration discoverable and accessible. The implementation leverages existing components and patterns, minimizing risk while improving user experience.

**Key Benefits:**
- Clear navigation path to registration
- Contextual prompts guide new users
- Consistent with existing design system
- No breaking changes
- Quick to implement and test

**Ready for EXECUTE mode.**

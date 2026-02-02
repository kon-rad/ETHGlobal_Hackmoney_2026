# Deployment Guide

## Environment Variables

This project uses Firebase for the waitlist feature. The following environment variables are required:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Firebase measurement ID (optional) |

## Local Development

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in your Firebase credentials in `.env.local`

3. Run the development server:
   ```bash
   npm run dev
   ```

## Railway Deployment

### 1. Create a New Project

1. Go to [Railway](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository

### 2. Configure Environment Variables

In your Railway project dashboard:

1. Go to **Variables** tab
2. Click **"+ New Variable"** for each variable below:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

Or use Railway's **Raw Editor** to paste all variables at once.

### 3. Configure Build Settings

Railway should auto-detect Next.js. If not, set:

- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Start Command**: `npm start`

### 4. Deploy

Railway will automatically deploy when you push to your main branch.

## Firebase Setup

### Firestore Security Rules

In Firebase Console → Firestore Database → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /waitlist/{document=**} {
      // Allow anyone to create (submit email)
      allow create: if request.resource.data.email is string;
      // Block read/update/delete from clients
      allow read, update, delete: if false;
    }
  }
}
```

### Create Firestore Index (if needed)

If you see an index error in the console, Firebase will provide a link to create the required index automatically.

## Vercel Deployment (Alternative)

1. Import project from GitHub
2. Set **Root Directory** to `frontend`
3. Add environment variables in Project Settings → Environment Variables
4. Deploy

## Security Notes

- `.env.local` is gitignored and should never be committed
- `NEXT_PUBLIC_` variables are exposed to the browser (this is expected for Firebase client SDK)
- Firestore security rules protect the database from unauthorized access
- The Firebase API key alone cannot access your data without proper security rules

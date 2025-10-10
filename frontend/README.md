# Predictive Maintenance Dashboard (Next.js)

## Prerequisites
- Backend running at http://localhost:8000 (see ../backend/README.md)
- Node.js 18+

## Setup
```
cd frontend
npm install
```

## Run
```
NEXT_PUBLIC_API_BASE=http://localhost:8000 npm run dev
```

Open http://localhost:3000

## Build
```
npm run build
npm start
```

Optional: copy .env.local.example to .env.local and set NEXT_PUBLIC_API_BASE.

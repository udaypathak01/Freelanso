# Freelanso

Freelanso is a React + Vite freelance marketplace backed by an Express API,
Firebase Authentication, server-side Firestore, Firebase Realtime Database
messaging, and Cloudinary uploads.

## Local development

Requirements: Node.js 20+, npm, and Java 21+ for Firebase emulators.

1. Install frontend dependencies with `npm ci`.
2. Install API dependencies with `cd server; npm ci`.
3. Configure `server/.env` from `server/.env.example`. Use an external service
   account or Application Default Credentials; never commit credentials.
4. Set the frontend `VITE_API_URL` to `http://localhost:5000/api`.
5. Start Firebase emulators with `cd server; npx firebase emulators:start
   --project demo-freelanso-test --only auth,firestore,database`.
6. In separate shells, start the API (`cd server; npm run dev`) and frontend
   (`npm run dev` from this directory).

## Quality checks

- Frontend production build: `npm run build`
- API lint: `cd server; npm run lint`
- API unit tests: `cd server; npm test`
- Emulator integration and rules tests: `cd server; npm run test:emu`
- OpenAPI-to-Express route parity: `cd server; npm run openapi:check`
- Dependency review: run `npm audit` at the frontend root and under `server`.
- Secret scanning: GitHub Actions runs Gitleaks on pull requests and pushes.

## Backend operations

See the [server setup and endpoint documentation](./server/README.md),
[architecture and security review](./server/ARCHITECTURE.md), and
[operations runbook](./server/RUNBOOK.md). The hand-maintained OpenAPI
specification is [server/openapi.yaml](./server/openapi.yaml).
"# Freelanso" 

# DaysSince Backend (NestJS + PostgreSQL + Prisma)

This is the backend API server for the DaysSince project, built with NestJS, PostgreSQL, and Prisma ORM. It provides endpoints for user authentication and managing time counters.

## Features (MVP Scope & Planned)

*   User authentication via Google OAuth 2.0.
*   JWT-based session management (Access & Refresh Tokens).
*   Header-based token authentication (`Authorization: Bearer`).
*   Secure password storage (for future email/password auth).
*   User profile management (`/users/me`).
*   CRUD operations for user-specific counters (`/counters`).
*   Archive/Unarchive functionality for counters.
*   Public counter listing and viewing endpoints (Planned).
*   Tag management and association with counters (Planned).
*   Refresh token endpoint (Planned).

## Tech Stack

*   **Framework:** [NestJS](https://nestjs.com/)
*   **Language:** [TypeScript](https://www.typescriptlang.org/)
*   **Database:** [PostgreSQL](https://www.postgresql.org/)
*   **ORM:** [Prisma](https://www.prisma.io/)
*   **Authentication:** [Passport.js](http://www.passportjs.org/) (`passport-google-oauth20`, `passport-jwt`)
*   **Validation:** `class-validator`, `class-transformer`
*   **Configuration:** `@nestjs/config` (`.env`)
*   **Package Manager:** npm / yarn (choose one)

## Getting Started

### Prerequisites

*   Node.js (LTS version recommended, e.g., v18+)
*   npm or yarn
*   PostgreSQL database server running
*   Google Cloud Platform project with OAuth 2.0 Credentials (Client ID & Secret)

### Installation

1.  Clone the repository:
    ```bash
    git clone <your-backend-repo-url>
    cd dayssince-backend
    ```
2.  Install dependencies:
    ```bash
    npm install
    # or
    yarn install
    ```

### Environment Variables

1.  Create a `.env` file in the project root.
2.  Copy the contents of `.env.example` (or add manually) and fill in your specific values:

    ```dotenv
    # .env

    #DATABASE_URL="postgresql://postgres:admin@localhost:5432/daysSince?schema=public" --> for local dev

    # PostgreSQL Connection URL
    DATABASE_URL="postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@YOUR_DB_HOST:YOUR_DB_PORT/YOUR_DB_NAME?schema=public"

    # Google OAuth Credentials
    GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
    GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
    GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback # Adjust port/path if needed


    # JWT Configuration
    JWT_SECRET=YOUR_SUPER_STRONG_RANDOM_JWT_SECRET_KEY_HERE
    JWT_ACCESS_EXPIRATION=15m
    JWT_REFRESH_EXPIRATION=7d

    # Frontend URL (for redirects)
    FRONTEND_BASE_URL=http://localhost:3001 # Adjust port if needed

    # Server Port (Optional, defaults usually work)
    # PORT=3000
    ```
    *   **Important:** Keep `.env` out of version control (`.gitignore`).

### Database Setup

1.  Ensure your PostgreSQL database specified in `DATABASE_URL` exists.
2.  Run Prisma migrations to create the database schema:
    ```bash
    npx prisma migrate dev --name init # Or use a different name if 'init' exists
    ```
    *(Optional)* If you need to seed data (e.g., Tags):
    ```bash
    npx prisma db seed # Requires a prisma/seed.ts file and script in package.json
    ```

### Running the Development Server

```bash
npm run start:dev
# or
yarn start:dev
```

### Project Structure

dayssince-backend/
├── prisma/             # Prisma schema, migrations, seed script
├── src/
│   ├── auth/           # Authentication logic (controller, service, strategies, guards)
│   ├── counters/       # Counters module (controller, service, dto)
│   ├── prisma/         # Prisma service module
│   ├── users/          # Users module (controller, service)
│   ├── tags/           # (Planned) Tags module
│   ├── app.controller.ts # Root controller
│   ├── app.module.ts   # Root application module
│   ├── app.service.ts  # Root service
│   └── main.ts         # Application entry point, bootstrapping
├── .env                # Local environment variables (Git ignored)
├── .env.example        # Example environment variables
├── .eslintrc.js        # ESLint config
├── .gitignore          # Git ignore rules
├── nest-cli.json       # NestJS CLI config
├── package.json        # Project dependencies and scripts
└── tsconfig.json       # TypeScript config


### API Contract / Endpoints

->GET /api/auth/google - Initiates Google Login

->GET /api/auth/google/callback - Google OAuth callback

->POST /api/auth/logout - Acknowledges logout (protected)

->POST /api/auth/refresh - (Planned) Refreshes access token

->GET /api/users/me - Gets current user profile (protected)

->POST /api/counters - Creates a counter (protected)

->GET /api/counters/mine - Gets user's counters (protected)

->PATCH /api/counters/:id - Updates a counter (protected)

->DELETE /api/counters/:id - Deletes a counter (protected)

->PATCH /api/counters/:id/archive - Archives a counter (protected)

->PATCH /api/counters/:id/unarchive - Unarchives a counter (protected)

->GET /api/tags - (Planned) Gets available tags

->GET /api/counters/public - (Planned) Gets public counters

->GET /api/counters/:id - (Planned) Gets single public/private counter


### Next Steps/TODO as of 29th March 2025

* Implement Tags module and API endpoint.
* Implement Public Counters API endpoints (/public, /counters/:id public logic).
* Implement Refresh Token (/refresh) endpoint and validation.
* Implement robust error handling and logging.
* Add input validation where necessary beyond DTOs.
* Write tests (Unit, Integration).
* Consider implementing server-side refresh token revocation/management.
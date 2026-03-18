## 🧰 Prerequisites
Make sure you have the following installed:
- Node.js (latest LTS version)
- Git
- PostgreSQL (latest stable version)

### Verify installation
```
node -v
npm -v
git -v
psql --version
```

## 📦 Install pnpm
```
npm install -g pnpm
```

### Verify installation
```
pnpm -v
```

## ⚙️ Running the App Locally
### 1. Clone the repository:
```
git clone git@github.com:ZA-Piso-System/za-server.git
cd za-server
```

### 2. Install dependencies:
```
pnpm install
```

## 🌐 Environment Setup
### 3. Create .env file
Copy the example below and create a `.env` file in the root directory:
```
cp .env.example .env
```

### 4. Configure environment variables
```
NODE_ENV=development
PORT=5000
LOG_LEVEL=debug

ALLOWED_ORIGINS=http://localhost:3000

# DATABASE
DATABASE_URL=postgresql://127.0.0.1:5432/db_name
DATABASE_LOGGER=false

# GOOGLE
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# BETTER AUTH
BETTER_AUTH_URL=http://localhost:5000
BETTER_AUTH_SECRET=
```

## ⚠️ Important Notes
- Replace db_name with your actual PostgreSQL database name
- Make sure PostgreSQL is running locally

## 🗄️ Database Setup
### 5. Run database migrations:
```
pnpm run db:migrate
```

## 🚀 Start the App
### 6. Start the development server:
```
pnpm run dev
```

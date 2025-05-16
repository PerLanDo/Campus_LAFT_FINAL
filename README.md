# MSU-IIT Lost & Found

A web application for reporting and tracking lost and found items on campus.

## Features
- Report lost or found items with detailed information
- Upload images and use AI to detect objects in images
- User authentication with Supabase
- Responsive and modern UI

## Getting Started

### 1. Clone the repository
```bash
# Using HTTPS
git clone <your-repo-url>
cd msu-iit-lost-and-found
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
Create a `.env.local` file in the root directory with the following content:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```
- Replace `your-supabase-url` and `your-supabase-anon-key` with values from your Supabase project settings (API section).

### 4. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the app.

## Supabase Setup
- Create a Supabase project at [https://supabase.com/](https://supabase.com/)
- Set up the following:
  - **Auth**: Enable email or Google authentication
  - **Database**: Create tables for `profiles`, `items`, etc.
  - **Storage**: Create a bucket named `item-images` (public or with appropriate RLS policies)
- Add your Supabase credentials to `.env.local`

## Database Backups

The project includes a robust database backup system with the following features:
- Automated daily, weekly, and monthly backups
- Retention policies to manage disk space
- Easy restoration process

### Setting Up Backups

1. Navigate to the scripts directory:
   ```bash
   cd scripts
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your database connection details (see `scripts/backup/README.md` for details)

4. Run a manual backup:
   ```bash
   npm run backup
   ```

For detailed information on scheduling automated backups and restoring from backups, see the [backup system documentation](scripts/backup/README.md).

## Scripts
- `npm run dev` — Start the development server
- `npm run build` — Build for production
- `npm start` — Start the production server
- `npm run lint` — Run ESLint

## Tech Stack
- Next.js (App Router)
- React
- Supabase (Auth, Database, Storage)
- Tailwind CSS
- react-hook-form + zod (form validation)
- TensorFlow.js (AI object detection)

## License
MIT

# PV Mapper - Solar Park Management Application

## Project Overview

PV Mapper is a web application for managing and monitoring photovoltaic (solar) parks. It allows users to:

- Track and manage multiple solar parks
- Organize and monitor rows of solar panels within parks
- Perform scanning and inspection of parks and rows
- View detailed information about parks and rows
- Access a management dashboard (for manager users)

**Project URL**: https://lovable.dev/projects/72d1b4e5-834d-476c-8cb7-831a0cf3013c

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher) & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- Supabase account (for backend services)

### Installation

1. Clone the repository:
   ```sh
   git clone <YOUR_GIT_URL>
   ```

2. Navigate to the project directory:
   ```sh
   cd pvmapper
   ```

3. Install dependencies:
   ```sh
   npm install
   ```

4. Set up environment variables:
   Create a `.env` file in the root directory with the following variables:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

5. Start the development server:
   ```sh
   npm run dev
   ```

6. Open your browser and navigate to `http://localhost:5173`

## Usage Guide

### Authentication

- Access the application at `http://localhost:5173`
- If not logged in, you'll be redirected to the login page
- Log in with your credentials

### Main Features

1. **Home Page** - View a list of all solar parks
2. **Park Detail** - View detailed information about a specific park and its rows
3. **Row Detail** - View detailed information about a specific row
4. **Scan** - Access scanning functionality for parks and rows
5. **Profile** - View and edit your user profile
6. **Dashboard** - Manager-only view for overall system management

### User Roles

- **Regular Users**: Can view parks, rows, and perform scans
- **Managers**: Have additional access to the dashboard and management features

## Project Structure

- `/src` - Main source code
  - `/components` - Reusable UI components
  - `/hooks` - Custom React hooks
  - `/integrations` - External service integrations
  - `/lib` - Utility functions and providers
  - `/pages` - Application pages/routes
- `/public` - Static assets
- `/supabase` - Supabase configuration

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:dev` - Build for development
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Technologies Used

This project is built with:

- Vite - Build tool and development server
- TypeScript - Type-safe JavaScript
- React - UI library
- React Router - For navigation
- shadcn-ui - UI component library
- Tailwind CSS - Utility-first CSS framework
- Supabase - Backend services (auth, database)
- React Query - Data fetching and state management

## Deployment

Simply open [Lovable](https://lovable.dev/projects/72d1b4e5-834d-476c-8cb7-831a0cf3013c) and click on Share -> Publish.

## Custom Domain

To connect a custom domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

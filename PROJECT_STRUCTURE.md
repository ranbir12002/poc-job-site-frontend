# Glass Site Mapper - Project Structure

This document provides a comprehensive overview of the `glass-site-mapper` project structure, its components, and the technologies used.

## Overview
The project is a full-stack application built with **React** (frontend) and **Express** (backend). it features map integration, 360-degree site views, and AI-powered functionalities.

---

## 📂 Project Organization

### 📁 Root Directory
- `server.ts`: The Express backend server. It handles API requests and database interactions.
- `vite.config.ts`: Configuration for the Vite build tool.
- `package.json`: Defines project dependencies, scripts, and metadata.
- `tsconfig.json`: TypeScript configuration for the project.
- `index.html`: The main entry point for the browser.
- `.env.example`: Template for required environment variables (e.g., `GEMINI_API_KEY`).
- `README.md`: Basic project introduction and setup instructions.

### 📁 `src/` (Frontend Source)
- `main.tsx`: The main entry point that renders the React application.
- `App.tsx`: The core application component, likely managing routing and high-level state.
- `db.ts`: Database connection and utility logic (supports both SQLite and PostgreSQL).
- `index.css`: Global CSS styles, including Tailwind CSS imports.
- `types.ts`: Centralized TypeScript interfaces and type definitions used across the app.
- `map-style.json`: Configuration for map styling (likely for Leaflet or similar).

#### 📁 `src/components/`
This folder contains the UI components:
- `Dashboard.tsx`: The main landing view for users to see their sites/projects.
- `MapCanvas.tsx`: A component for interactive map displays using **Leaflet**.
- `ProjectView.tsx`: Displays details for a specific project.
- `SignIn.tsx`: User authentication and login interface.
- `SiteEditor.tsx`: An extensive component for editing site data and metadata.
- `SiteRecorder.tsx`: Possibly handles the capture or recording of new site data.
- `StreetView.tsx`: Provides 360-degree panoramic views using **Marzipano** or **Photo Sphere Viewer**.

#### 📁 `src/lib/`
- `utils.ts`: Shared helper functions and utility logic (e.g., class name merging).

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [React 19](https://react.dev/) |
| **Build Tool** | [Vite](https://vitejs.dev/) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **Animations** | [Motion (Framer Motion)](https://www.framer.com/motion/) |
| **Maps** | [Leaflet](https://leafletjs.com/) & [React Leaflet](https://react-leaflet.js.org/) |
| **360 Views** | [Marzipano](https://www.marzipano.net/) & [Photo Sphere Viewer](https://photo-sphere-viewer.js.org/) |
| **Backend** | [Express](https://expressjs.com/) (running via `tsx`) |
| **Database** | [SQLite](https://sqlite.org/) (via `better-sqlite3`) & [PostgreSQL](https://www.postgresql.org/) |
| **AI** | [Google Generative AI](https://ai.google.dev/) (`@google/genai`) |

---

## 🚀 Key Scripts
- `npm run dev`: Starts the development environment using `tsx server.ts` (starts both backend and frontend dev server).
- `npm run build`: Compiles the frontend for production.
- `npm run lint`: Runs TypeScript type checking.

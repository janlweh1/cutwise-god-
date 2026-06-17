<p align="center">
  <h1 align="center">CutWise IMS</h1>
  <p align="center">
    <strong>Intelligent Inventory Management System</strong><br/>
    Built with React, Django, and PostgreSQL
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Django-092E20?style=for-the-badge&logo=django&logoColor=white" alt="Django" />
  <img src="https://img.shields.io/badge/Django_REST-ff1709?style=for-the-badge&logo=django&logoColor=white" alt="DRF" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
</p>

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Backend Setup](#2-backend-setup-django)
  - [3. Frontend Setup](#3-frontend-setup-react--vite)
- [API Endpoints](#api-endpoints)
- [Environment Variables](#environment-variables)
- [Scripts Reference](#scripts-reference)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**CutWise IMS** is a modern, full-stack inventory management system designed for businesses that need to track products, manage stock movements, and monitor inventory levels in real time. The monorepo architecture keeps the frontend and backend tightly organized while remaining independently deployable.

### Key Features

| Feature | Description |
|---|---|
| **Product Management** | Create, update, and organize products with categories and SKUs |
| **Stock Tracking** | Record stock-in, stock-out, adjustments, and returns |
| **Low-Stock Alerts** | Automatic detection when inventory falls below reorder levels |
| **JWT Authentication** | Secure API access with token-based auth and refresh rotation |
| **Search & Filter** | Full-text search and ordering across all inventory endpoints |
| **Admin Dashboard** | Built-in Django admin for back-office management |

---

## Architecture

```
┌──────────────────┐       HTTPS / JSON        ┌──────────────────┐
│                  │  ◄──────────────────────►  │                  │
│   React (Vite)   │                            │  Django REST API  │
│   Port 5173      │                            │  Port 8000        │
│                  │                            │                  │
└──────────────────┘                            └────────┬─────────┘
                                                         │
                                                         │  Django ORM / psycopg2
                                                         ▼
                                                ┌──────────────────┐
                                                │                  │
                                                │    PostgreSQL    │
                                                │    (Local DB)    │
                                                │                  │
                                                └──────────────────┘
```

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 19** | UI framework |
| **Vite** | Build tool & dev server |
| **React Router v7** | Client-side routing |
| **Axios** | HTTP client with interceptors |

### Backend
| Technology | Purpose |
|---|---|
| **Django 5.1** | Web framework |
| **Django REST Framework** | RESTful API toolkit |
| **Simple JWT** | JWT authentication |
| **django-cors-headers** | Cross-origin resource sharing |
| **django-environ** | Environment variable management |
| **dj-database-url** | Database URL parsing |
| **WhiteNoise** | Static file serving |
| **Gunicorn** | Production WSGI server |

### Infrastructure
| Technology | Purpose |
|---|---|
| **PostgreSQL** | Primary relational database |

---

## Project Structure

```
cutwise-ims/
├── .gitignore                  # Root gitignore (Python + Node + IDE)
├── README.md                   # This file
│
├── frontend/                   # React + Vite application
│   ├── public/                 # Static assets
│   ├── src/
│   │   ├── assets/             # Images, fonts, icons
│   │   ├── lib/
│   │   │   └── api.js          # Axios client with JWT interceptors
│   │   ├── App.jsx             # Root component
│   │   ├── App.css             # App styles
│   │   └── main.jsx            # Entry point
│   ├── .env.example            # Frontend env template
│   ├── index.html              # HTML entry
│   ├── package.json            # NPM dependencies
│   └── vite.config.js          # Vite configuration
│
└── backend/                    # Django REST API
    ├── config/                 # Django project settings
    │   ├── __init__.py
    │   ├── settings.py         # Main settings (DB, DRF, JWT, CORS)
    │   ├── urls.py             # Root URL configuration
    │   ├── wsgi.py             # WSGI entry point
    │   └── asgi.py             # ASGI entry point
    ├── apps/
    │   ├── core/               # Shared models & health check
    │   │   ├── models.py       # TimeStampedModel (abstract)
    │   │   ├── views.py        # Health check endpoint
    │   │   └── urls.py
    │   ├── inventory/          # Inventory management
    │   │   ├── models.py       # Category, Product, StockMovement
    │   │   ├── serializers.py  # DRF serializers
    │   │   ├── views.py        # CRUD ViewSets
    │   │   ├── urls.py         # Router-based URLs
    │   │   └── admin.py        # Admin registrations
    │   └── authentication/     # User auth
    │       ├── serializers.py  # Register & User serializers
    │       ├── views.py        # Register & current-user views
    │       └── urls.py         # JWT login, refresh, register
    ├── manage.py               # Django CLI
    ├── requirements.txt        # Python dependencies
    └── .env.example            # Backend env template
```

---

## Prerequisites

Before you begin, ensure you have the following installed:

| Tool | Version | Check |
|---|---|---|
| **Python** | 3.11+ | `python --version` |
| **Node.js** | 18+ | `node --version` |
| **npm** | 9+ | `npm --version` |
| **Git** | Latest | `git --version` |
| **PostgreSQL** | 15+ | `psql --version` |

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/cutwise-ims.git
cd cutwise-ims
```

### 2. Backend Setup (Django)

```bash
# Navigate to the backend directory
cd backend

# Create and activate a virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template and configure
cp .env.example .env
# Edit .env with your local PostgreSQL credentials and secret key

# Run database migrations
python manage.py migrate

# Create a superuser for the admin panel
python manage.py createsuperuser

# Start the development server
python manage.py runserver
```

The API will be available at **http://localhost:8000**.

### 3. Frontend Setup (React + Vite)

```bash
# Navigate to the frontend directory (from project root)
cd frontend

# Install dependencies
npm install

# Copy environment template and configure
cp .env.example .env
# Edit .env with your API base URL

# Start the development server
npm run dev
```

The app will be available at **http://localhost:5173**.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Example |
|---|---|---|
| `DJANGO_SECRET_KEY` | Django secret key | `your-random-secret-key` |
| `DJANGO_DEBUG` | Enable debug mode | `True` |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated allowed hosts | `localhost,127.0.0.1` |
| `DATABASE_URL` | PostgreSQL connection string | postgresql://db_user:db_password@localhost:5432/your_db_name|
| `CORS_ALLOWED_ORIGINS` | Allowed CORS origins | `http://localhost:5173` |

### Frontend (`frontend/.env`)

| Variable | Description | Example |
|---|---|---|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:8000/api/v1` |

---

## Scripts Reference

### Backend

```bash
python manage.py runserver          # Start development server
python manage.py migrate            # Apply database migrations
python manage.py makemigrations     # Generate new migrations
python manage.py createsuperuser    # Create admin user
python manage.py collectstatic      # Collect static files for production
python manage.py test               # Run tests
```

### Frontend

```bash
npm run dev       # Start Vite dev server (hot reload)
npm run build     # Production build -> frontend/dist/
npm run preview   # Preview production build locally
npm run lint      # Run ESLint
```

---

## Contributing

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/your-feature-name`
3. **Commit** your changes: `git commit -m "feat: add your feature"`
4. **Push** to the branch: `git push origin feature/your-feature-name`
5. **Open** a Pull Request

### Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Usage |
|---|---|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation changes |
| `style:` | Code style (formatting, semicolons, etc.) |
| `refactor:` | Code refactoring |
| `test:` | Adding or updating tests |
| `chore:` | Maintenance tasks |

---

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

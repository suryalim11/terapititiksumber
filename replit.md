# Overview

This is a healthcare management system for "Terapi Titik Sumber", a therapy clinic in Indonesia. The application manages patient registration, appointment scheduling, therapy sessions, product inventory, financial transactions, and reporting. It features both an admin dashboard and a public patient registration system with support for walk-in and online registration flows.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Technology Stack

### Frontend
- **React** with TypeScript for the UI layer
- **Wouter** for lightweight client-side routing
- **TanStack Query** for server state management and data fetching
- **Radix UI + Shadcn/UI** for accessible, customizable component primitives
- **Tailwind CSS** for styling with mobile-first responsive design
- **React Hook Form + Zod** for form validation
- **Vite** as the build tool and development server

### Backend
- **Express.js** for the REST API server
- **Passport.js** with local strategy for authentication
- **Express Session** with MemoryStore for session management
- **Drizzle ORM** for type-safe database interactions
- **PostgreSQL** (Neon serverless) as the primary database

### Key Architectural Patterns

1. **Dual Registration Flow**: The system supports two distinct patient registration paths:
   - Online registration via public links with expiry and daily limits
   - Walk-in registration directly by admin staff through the patient detail page
   
2. **Timezone Handling**: All datetime operations use WIB (UTC+7) timezone with consistent conversion functions (`getWIBDate()`) to handle timezone differences between client, server, and database.

3. **Slot-Based Therapy Scheduling**: Therapy sessions are organized into time slots with quota management. The system handles slot consolidation to prevent duplicates and maintains appointment-to-slot relationships.

4. **Session Package System**: Patients can purchase therapy packages (sessions) that are tracked and decremented as they attend appointments. The system automatically links appointments to available active sessions.

5. **Debt Payment Tracking**: Financial transactions support partial payments with automatic debt tracking and separate debt payment records.

6. **Patient Relationship Management**: The system tracks relationships between patients sharing the same phone number for family/group management.

## Core Data Models

- **Users**: Admin accounts with role-based access
- **Patients**: Patient records with medical history and contact information
- **Therapy Slots**: Time-based appointment slots with quota management and unique time slot keys
- **Appointments**: Scheduled therapy sessions linked to patients, slots, and package sessions
- **Sessions**: Therapy package sessions with usage tracking
- **Products & Packages**: Inventory items and therapy package offerings
- **Transactions**: Financial records with support for partial payments and debt tracking
- **Registration Links**: Time-limited registration codes for online patient signup
- **Medical History**: Patient health records and complaints
- **System Logs**: Audit trail for user actions

## API Architecture

The backend exposes RESTful endpoints organized by resource:
- `/api/auth/*` - Authentication and session management
- `/api/patients/*` - Patient CRUD operations
- `/api/appointments/*` - Appointment scheduling
- `/api/therapy-slots/*` - Slot management with optimized endpoints
- `/api/transactions/*` - Financial transactions and debt payments
- `/api/products/*` and `/api/packages/*` - Inventory management
- `/api/reports/*` - Analytics and reporting
- `/api/admin/*` - Administrative utilities (backups, data fixes)

Special endpoints for handling JSON parsing issues and raw data access are implemented via `/api/raw/*` and `/api/direct/*`.

# External Dependencies

## Third-Party Services
- **Neon Database**: Serverless PostgreSQL hosting with WebSocket support
- **Stripe** (configured but not actively used): Payment processing integration

## Key NPM Packages
- `@neondatabase/serverless`: Database client with WebSocket pooling
- `drizzle-orm` & `drizzle-kit`: ORM and schema migration tools
- `express-session` & `memorystore`: Session management
- `passport` & `passport-local`: Authentication strategy
- `date-fns`: Date manipulation and formatting
- `zod`: Schema validation
- `bcrypt/scrypt`: Password hashing (via Node.js crypto)

## Development Tools
- **TypeScript**: Type safety across frontend and backend
- **ESBuild**: Backend bundling for production
- **Vite**: Frontend dev server with HMR
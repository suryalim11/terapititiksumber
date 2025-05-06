# Architecture Documentation

## Overview

This application is a healthcare management system for "Terapi Titik Sumber", a therapy clinic. The system manages patients, appointments, therapy sessions, products, packages, and financial transactions. It follows a client-server architecture with a React frontend and Node.js/Express backend, using PostgreSQL via Drizzle ORM for data persistence.

The application provides features for:
- Patient registration and management
- Appointment scheduling and management
- Therapy session tracking
- Product inventory management
- Financial transaction processing
- Reporting and analytics
- User authentication and authorization
- Data backup and restoration

## System Architecture

The system follows a modern web application architecture with the following layers:

1. **Frontend**: React-based single-page application with responsive design
2. **Backend API**: Express.js server exposing RESTful endpoints
3. **Data Access Layer**: Drizzle ORM for database interactions
4. **Database**: PostgreSQL for persistent storage

### Architecture Diagram

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌─────────────┐
│   Frontend  │     │  Backend API │     │ Data Access   │     │  PostgreSQL │
│   (React)   │<--->│  (Express)   │<--->│ (Drizzle ORM) │<--->│  Database   │
└─────────────┘     └──────────────┘     └───────────────┘     └─────────────┘
```

## Key Components

### Frontend

- **React**: Core UI library
- **Wouter**: Lightweight router for navigation
- **TanStack Query**: Data fetching and state management
- **Radix UI**: Accessible UI component primitives
- **Shadcn/UI**: Component library built on top of Radix UI
- **React Hook Form**: Form handling and validation
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library

The frontend follows a component-based architecture with:
- Page components for different routes
- Reusable UI components
- Custom hooks for shared logic
- Context providers for global state (auth, theme)

### Backend

- **Express.js**: Web server framework
- **Drizzle ORM**: TypeScript-first ORM for database access
- **Passport.js**: Authentication middleware
- **Express Session**: Session management
- **Multer**: File upload handling

The backend is organized with:
- Route handlers for API endpoints
- Authentication middleware
- Storage abstraction layer
- Database schema definitions
- Utility functions

### Database Schema

The database schema includes the following main entities:

1. **Users**: System users with authentication details
2. **Patients**: Patient information and medical details
3. **Products**: Products available for sale
4. **Packages**: Therapy packages with multiple sessions
5. **Transactions**: Financial transactions
6. **Sessions**: Therapy sessions associated with packages
7. **Appointments**: Scheduled appointments
8. **TherapySlots**: Available time slots for therapy
9. **MedicalHistory**: Patient medical history records
10. **DebtPayments**: Records of debt payments for unpaid transactions
11. **SystemLogs**: System activity logs

## Data Flow

### Patient Registration Flow

1. Patient fills out registration form
2. Frontend validates form data
3. API endpoint receives patient data
4. Backend generates unique patient ID
5. Patient record is stored in database
6. Confirmation is returned to frontend

### Appointment Scheduling Flow

1. User selects a therapy slot and patient
2. Frontend sends appointment request
3. Backend validates availability
4. Appointment is created in database
5. Session usage is updated if applicable
6. Confirmation is returned to frontend

### Transaction Processing Flow

1. User creates a new transaction with items (products/packages)
2. Frontend sends transaction data
3. Backend processes transaction
4. For package purchases, a new session record is created
5. Transaction is stored in database
6. Receipt/confirmation is returned to frontend

## External Dependencies

### Frontend Dependencies

- React ecosystem libraries
- UI component libraries (Radix UI, Shadcn)
- Form handling libraries (React Hook Form, Zod)
- Date handling (date-fns)
- Utility libraries

### Backend Dependencies

- Express and middleware ecosystem
- Database drivers (PostgreSQL)
- ORM (Drizzle)
- Authentication libraries (Passport)
- Utility libraries

## Deployment Strategy

The application is configured for deployment on Replit with:

1. **Build Process**:
   - Frontend is built using Vite
   - Backend is bundled using esbuild
   - All assets are compiled into the dist directory

2. **Runtime Environment**:
   - Node.js 20
   - PostgreSQL 16
   - Web service

3. **Configuration**:
   - Environment variables for database connection
   - Production mode flag
   - Automatic scaling setup

4. **Database**:
   - PostgreSQL database
   - Migration scripts for schema updates
   - Backup and restore functionality

## Security Considerations

1. **Authentication**: Session-based authentication using Passport.js
2. **Authorization**: Role-based access control (admin vs regular users)
3. **Password Security**: Password hashing using scrypt
4. **Session Management**: Secure session management with express-session
5. **Input Validation**: Data validation using Zod schemas

## Known Issues and Challenges

1. **Timezone Handling**: Special handling required for WIB (Western Indonesian Time) timezone
2. **Patient Duplicates**: System includes utilities to detect and fix duplicate patient records
3. **Database Schema Evolution**: Several migration and fix scripts indicate iterative schema development
4. **Session Tracking**: Complex logic for tracking therapy session usage

## Future Enhancements

Based on the codebase examination, potential future enhancements might include:

1. Improved reporting and analytics
2. Mobile application development
3. Enhanced integration with payment processors
4. Expanded backup and recovery options
5. Multi-clinic support
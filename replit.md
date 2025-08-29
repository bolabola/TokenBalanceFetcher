# Sparkscan Batch Analyzer

## Overview

This is a full-stack web application for analyzing multiple cryptocurrency wallet addresses using the Sparkscan API. The application allows users to input multiple Stacks blockchain addresses (either manually or via file upload) and performs batch lookups to retrieve balance information, token holdings, and transaction data. Built with a React frontend and Express.js backend, it provides real-time progress tracking and comprehensive results visualization.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite as the build tool
- **UI Library**: Shadcn/ui components built on Radix UI primitives with Tailwind CSS styling
- **State Management**: TanStack React Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Styling**: Tailwind CSS with custom design system using CSS variables for theming

### Backend Architecture
- **Framework**: Express.js with TypeScript running on Node.js
- **API Design**: RESTful API with proper error handling and request/response logging
- **Development Setup**: Hot reloading with custom Vite integration for seamless development experience
- **Build Process**: ESBuild for production bundling with platform-specific optimizations

### Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Fallback Storage**: In-memory storage implementation for development/testing scenarios

### Database Schema Design
- **Batch Jobs Table**: Tracks processing jobs with status, progress counters, and metadata
- **Address Results Table**: Stores individual address lookup results with full API response data
- **Relationships**: Foreign key relationship between batch jobs and their associated address results

### External Service Integrations
- **Sparkscan API**: Primary service for Stacks blockchain address lookups and balance information
- **Rate Limiting**: Configurable rate limiting (default 5 requests/second) to respect API constraints
- **Error Handling**: Robust error handling for API failures with retry mechanisms

### Authentication and Security
- **Session Management**: Express sessions with PostgreSQL session store (connect-pg-simple)
- **CORS**: Properly configured for development and production environments
- **Input Validation**: Zod schemas for runtime type checking and validation

### File Processing Capabilities
- **CSV Upload**: Support for CSV file uploads with address extraction
- **Text Input**: Manual address input with validation
- **Address Validation**: Client-side validation for Stacks address format (sp prefix validation)

### Real-time Features
- **Progress Tracking**: Real-time updates on batch processing status using polling
- **Live Results**: Dynamic loading of results as they become available
- **Status Management**: Comprehensive status tracking (pending, processing, completed, failed)

### Development Tools and Quality
- **Type Safety**: Full TypeScript coverage across frontend, backend, and shared schemas
- **Development Experience**: Replit-optimized with runtime error overlays and cartographer integration
- **Code Quality**: ESLint configuration and consistent code formatting
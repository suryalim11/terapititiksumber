/**
 * BUG FIX #18: File ini telah dihapus karena berisi hardcoded patient data
 *
 * DEPRECATED - This file previously contained hardcoded patient data that would override
 * real database responses. This was a temporary debugging/workaround solution that caused
 * the API to return incorrect data to clients.
 *
 * The proper fix is to ensure that:
 * 1. All patient and appointment data comes directly from the database
 * 2. No hardcoded overrides or mocking of production data
 * 3. Data consistency is maintained between frontend and backend
 *
 * If you previously relied on this override functionality, please instead:
 * - Fix the underlying data issues in the database
 * - Use proper database migrations or data cleanup procedures
 * - Implement proper testing with accurate test data
 *
 * DO NOT use this file - it is no longer imported or used by the application.
 */

// This file is intentionally left empty except for documentation.
// The overrideSlotPatients middleware is no longer used.

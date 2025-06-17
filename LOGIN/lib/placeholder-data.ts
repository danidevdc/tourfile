
// This file is being phased out for medicine data management.
// Medicine data is now handled by src/lib/medicineService.ts and Firestore.

// If other non-medicine placeholder data or types are needed in the future,
// they can be added here. For now, it's mostly empty or contains
// type definitions that are primarily sourced from medicineService.ts if shared.

// Ensure type definitions are primarily managed in src/lib/medicineService.ts
// to avoid circular dependencies or outdated types.
// If you need to re-export types from medicineService.ts for legacy reasons, do it carefully.
// Example: export type { Medicine, DispensingRecord } from './medicineService'; (but prefer direct import)

// Original interfaces are commented out as they should be sourced from medicineService.ts

// export interface DispensingRecord {
//   id: string;
//   date: string;
//   rxNumber: string;
//   quantity: number;
//   type: 'dispensed' | 'stocked';
//   userName?: string;
//   expirationDate?: string;
// }

// export interface Medicine {
//   id: string;
//   name: string;
//   presentation: string;
//   description?: string;
//   currentStock: number;
//   lastUpdated: string;
//   dispensingHistory: DispensingRecord[];
// }

/**
 * MIGRATION SCRIPT: Add allResponsibles field to existing service orders
 * 
 * This script adds the allResponsibles array to all existing serviceOrders documents.
 * The allResponsibles field is needed for efficient "search by responsible person" queries.
 * 
 * Run this ONCE after deploying the new code that includes extractAllResponsibles().
 * 
 * HOW TO RUN LOCALLY:
 * 1. Make sure you're authenticated: `firebase login`
 * 2. Run: `npx tsx functions/migrateResponsibles.ts`
 * 
 * SAFETY FEATURES:
 * - Processes in batches of 500 (Firestore batch limit)
 * - Only updates documents missing the allResponsibles field
 * - Logs progress and errors
 * - Can be run multiple times safely (idempotent)
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  // Try to use Application Default Credentials first
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: 'tourfileprocessor'
    });
  } catch (error) {
    // Fallback: Initialize without explicit credentials (uses GOOGLE_APPLICATION_CREDENTIALS env var or Firebase CLI auth)
    console.log('⚠️  No se encontraron credenciales por defecto, usando configuración de Firebase CLI...');
    admin.initializeApp({
      projectId: 'tourfileprocessor'
    });
  }
}

const db = admin.firestore();

/**
 * Extract all unique responsible persons from an order
 * (This is the same logic as extractAllResponsibles in serviceOrderStorage.ts)
 */
function extractAllResponsibles(orderData: any): string[] {
  const responsibles = new Set<string>();

  // Add main guide if exists
  if (orderData.guia && orderData.guia.trim() !== '' && orderData.guia !== 'SIN GUIA PRINCIPAL') {
    orderData.guia.split(',').forEach((name: string) => {
      const trimmed = name.trim();
      if (trimmed) responsibles.add(trimmed);
    });
  }

  // Add all guides and drivers from services
  if (orderData.services && Array.isArray(orderData.services)) {
    orderData.services.forEach((service: any) => {
      // Add service guide
      if (service.guia && service.guia.trim() !== '') {
        service.guia.split(',').forEach((name: string) => {
          const trimmed = name.trim();
          if (trimmed) responsibles.add(trimmed);
        });
      }

      // Add service driver
      if (service.chofer && service.chofer.trim() !== '' && service.chofer !== 'NONE') {
        responsibles.add(service.chofer.trim());
      }
    });
  }

  return Array.from(responsibles).sort();
}

/**
 * Main migration function
 */
async function migrateAllResponsibles() {
  console.log('🚀 Starting migration: Adding allResponsibles field to service orders...\n');

  const ordersRef = db.collection('serviceOrders');
  
  try {
    // Query all orders that don't have the allResponsibles field yet
    const snapshot = await ordersRef
      .where('allResponsibles', '==', null)
      .get();

    if (snapshot.empty) {
      console.log('✅ All orders already have the allResponsibles field. Nothing to migrate.');
      return;
    }

    console.log(`📊 Found ${snapshot.size} orders to migrate.\n`);

    let processedCount = 0;
    let errorCount = 0;
    const batchSize = 500; // Firestore batch write limit
    let batch = db.batch();
    let batchCount = 0;

    for (const docSnap of snapshot.docs) {
      try {
        const data = docSnap.data();
        const orderData = data.data;

        // Extract responsibles from order data
        const allResponsibles = extractAllResponsibles(orderData);

        // Add to batch update
        batch.update(docSnap.ref, {
          allResponsibles,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        batchCount++;
        processedCount++;

        // Commit batch when it reaches the limit
        if (batchCount >= batchSize) {
          await batch.commit();
          console.log(`✅ Committed batch of ${batchCount} updates. Total processed: ${processedCount}/${snapshot.size}`);
          batch = db.batch();
          batchCount = 0;
        }

      } catch (error) {
        errorCount++;
        console.error(`❌ Error processing document ${docSnap.id}:`, error);
      }
    }

    // Commit any remaining updates in the last batch
    if (batchCount > 0) {
      await batch.commit();
      console.log(`✅ Committed final batch of ${batchCount} updates.`);
    }

    console.log('\n📊 MIGRATION SUMMARY:');
    console.log(`   ✅ Successfully migrated: ${processedCount - errorCount} orders`);
    if (errorCount > 0) {
      console.log(`   ❌ Errors: ${errorCount} orders`);
    }
    console.log(`   💰 Cost: ~${processedCount} reads + ${processedCount} writes = ~$${((processedCount * 2) / 1000000 * 0.18).toFixed(4)}`);
    console.log('\n✅ Migration completed!');

  } catch (error) {
    console.error('❌ Fatal error during migration:', error);
    throw error;
  }
}

/**
 * Optional: Verify migration by counting how many orders are missing allResponsibles
 */
async function verifyMigration() {
  console.log('\n🔍 Verifying migration...');

  const ordersRef = db.collection('serviceOrders');
  
  try {
    // Count all orders
    const allOrdersSnapshot = await ordersRef.count().get();
    const totalOrders = allOrdersSnapshot.data().count;

    // Count orders without allResponsibles
    const missingSnapshot = await ordersRef
      .where('allResponsibles', '==', null)
      .count()
      .get();
    const missingCount = missingSnapshot.data().count;

    console.log(`📊 Total orders: ${totalOrders}`);
    console.log(`📊 Orders with allResponsibles: ${totalOrders - missingCount}`);
    console.log(`📊 Orders missing allResponsibles: ${missingCount}`);

    if (missingCount === 0) {
      console.log('✅ All orders have been migrated successfully!');
    } else {
      console.log(`⚠️  ${missingCount} orders still need migration.`);
    }

  } catch (error) {
    console.error('❌ Error during verification:', error);
  }
}

// Run the migration
console.log('========================================');
console.log('  SERVICE ORDER MIGRATION SCRIPT');
console.log('  Adding allResponsibles field');
console.log('========================================\n');

migrateAllResponsibles()
  .then(() => verifyMigration())
  .then(() => {
    console.log('\n✅ All done! You can now use searchOrdersByResponsible() in serviceOrderSearch.ts');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });

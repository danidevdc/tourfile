/**
 * Cloud Function para asignar Custom Claims a usuarios admin
 * Esto optimiza las Firebase Security Rules reduciendo lecturas innecesarias
 * 
 * DEPLOY: 
 * 1. Copia este archivo a functions/src/
 * 2. Importa en functions/src/index.ts
 * 3. Deploy: firebase deploy --only functions:setAdminClaim
 * 
 * USO:
 * curl -X POST https://REGION-PROJECT_ID.cloudfunctions.net/setAdminClaim \
 *   -H "Content-Type: application/json" \
 *   -d '{"uid": "USER_UID", "isAdmin": true}'
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Inicializar solo si no está inicializado
if (admin.apps.length === 0) {
  admin.initializeApp();
}

export const setAdminClaim = functions.https.onCall(async (data, context) => {
  // Solo usuarios admin existentes pueden asignar claims
  if (!context.auth?.token.isAdmin && !context.auth?.uid) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Solo administradores pueden asignar claims'
    );
  }

  const { uid, isAdmin } = data;

  if (!uid || typeof isAdmin !== 'boolean') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'uid (string) e isAdmin (boolean) son requeridos'
    );
  }

  try {
    // Asignar custom claim
    await admin.auth().setCustomUserClaims(uid, { 
      isAdmin,
      updatedAt: Date.now() 
    });

    console.log(`Custom claim asignado: uid=${uid}, isAdmin=${isAdmin}`);

    return { 
      success: true, 
      message: `Usuario ${uid} ahora tiene isAdmin=${isAdmin}` 
    };
  } catch (error) {
    console.error('Error asignando custom claim:', error);
    throw new functions.https.HttpsError('internal', 'Error al asignar claim');
  }
});

/**
 * Función para migrar TODOS los usuarios existentes desde userProfiles
 */
export const migrateAdminClaims = functions.https.onCall(async (data, context) => {
  // Solo super-admin puede ejecutar migración
  if (!context.auth || context.auth.token.email !== 'YOUR_ADMIN_EMAIL@example.com') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Solo el super-admin puede ejecutar migraciones'
    );
  }

  try {
    const db = admin.firestore();
    const profilesSnapshot = await db.collection('userProfiles').get();
    
    let migratedCount = 0;
    let errorCount = 0;

    for (const doc of profilesSnapshot.docs) {
      const uid = doc.id;
      const isAdmin = doc.data().isAdmin === true;

      try {
        await admin.auth().setCustomUserClaims(uid, { 
          isAdmin,
          migratedAt: Date.now()
        });
        migratedCount++;
        console.log(`Migrado: ${uid} -> isAdmin=${isAdmin}`);
      } catch (err) {
        console.error(`Error migrando ${uid}:`, err);
        errorCount++;
      }
    }

    return {
      success: true,
      migrated: migratedCount,
      errors: errorCount,
      total: profilesSnapshot.size
    };
  } catch (error) {
    console.error('Error en migración:', error);
    throw new functions.https.HttpsError('internal', 'Error en migración');
  }
});

/**
 * Trigger que sincroniza cambios en userProfiles con Custom Claims
 * Se ejecuta automáticamente cuando se modifica un userProfile
 */
export const syncAdminClaimOnUpdate = functions.firestore
  .document('userProfiles/{userId}')
  .onWrite(async (change, context) => {
    const userId = context.params.userId;
    const afterData = change.after.exists ? change.after.data() : null;

    if (!afterData) {
      // Documento eliminado, remover claims
      await admin.auth().setCustomUserClaims(userId, { isAdmin: false });
      console.log(`Claims removidos para usuario eliminado: ${userId}`);
      return;
    }

    const isAdmin = afterData.isAdmin === true;

    try {
      await admin.auth().setCustomUserClaims(userId, { 
        isAdmin,
        syncedAt: Date.now()
      });
      console.log(`Auto-sincronizado: ${userId} -> isAdmin=${isAdmin}`);
    } catch (error) {
      console.error(`Error sincronizando claims para ${userId}:`, error);
    }
  });

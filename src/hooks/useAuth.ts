
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase'; // Import auth from firebase config
import {
  type User as FirebaseUser, // Firebase Auth User type
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail as fbSendPasswordResetEmail,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  Timestamp,
  updateDoc,
  arrayUnion,
  collection,
  query,
  where,
  getDocs,
  deleteDoc
} from 'firebase/firestore';

// TourFileGen specific user profile data stored in Firestore
export interface UserProfile {
  uid: string; // Firebase Auth UID
  email: string; // Normalized email
  firstName?: string;
  lastName?:string;
  username?: string; // No longer primary, but can be kept if other parts of system use it
  isAdmin?: boolean;
  createdAt?: Timestamp;
  activityLog?: ActivityLogEntry[];
}

export interface ActivityLogEntry {
  timestamp: Timestamp;
  action: string;
  details?: string;
}

// This will be the structure of our currentUser state, combining Auth info and Profile info
export interface CurrentUser extends FirebaseUser {
  profile?: UserProfile; // Optional profile, fetched from Firestore
}

const ADMIN_EMAIL = 'daniish77@gmail.com';

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const fetchUserProfile = useCallback(async (uid: string): Promise<UserProfile | null> => {
    if (!db) return null;
    try {
      const userProfileDocRef = doc(db, 'userProfiles', uid);
      const userProfileDoc = await getDoc(userProfileDocRef);
      if (userProfileDoc.exists()) {
        return userProfileDoc.data() as UserProfile;
      }
      return null;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      toast({ title: "Error", description: "No se pudo cargar el perfil del usuario.", variant: "destructive" });
      return null;
    }
  }, [toast]);

  useEffect(() => {
    if (!auth) {
        console.error("Firebase Auth is not initialized. App will not function correctly.");
        toast({ title: "Error Crítico", description: "La autenticación de Firebase no está disponible.", variant: "destructive", duration: 10000 });
        setIsLoading(false);
        return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);
      if (firebaseUser) {
        const profile = await fetchUserProfile(firebaseUser.uid);
        setCurrentUser({ ...firebaseUser, profile });
        setIsCurrentUserAdmin(!!profile?.isAdmin || firebaseUser.email === ADMIN_EMAIL);
      } else {
        setCurrentUser(null);
        setIsCurrentUserAdmin(false);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [fetchUserProfile, toast]);


  const login = useCallback(async (emailInput?: string, passwordInput?: string) => {
    setIsLoading(true);
    if (!auth || !db) {
      toast({ title: 'Error de Configuración', description: 'Firebase Auth o Firestore no está disponible.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }
    if (!emailInput || !passwordInput) {
      toast({ title: "Error", description: "Correo y contraseña son requeridos.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const emailToUseForLogin = emailInput.trim().toLowerCase();

    try {
      const userCredential = await signInWithEmailAndPassword(auth, emailToUseForLogin, passwordInput);
      const firebaseUser = userCredential.user;
      const profile = await fetchUserProfile(firebaseUser.uid);

      setCurrentUser({ ...firebaseUser, profile });
      setIsCurrentUserAdmin(!!profile?.isAdmin || firebaseUser.email === ADMIN_EMAIL);
      
      const displayName = profile?.email || "Usuario";
      toast({ title: "Inicio de Sesión Exitoso", description: `¡Bienvenido de nuevo, ${displayName}!` });
      router.push('/');
    } catch (error: any) {
      console.error('Login error:', error.code, error.message);
      let title = "Error de Inicio de Sesión";
      let message = "Ocurrió un problema al intentar iniciar sesión.";

      if (error.code) {
        switch (error.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            message = "Correo electrónico o contraseña incorrectos.";
            break;
          case 'auth/invalid-email':
            message = "El formato del correo electrónico es inválido.";
            break;
          case 'auth/user-disabled':
            message = "Esta cuenta de usuario ha sido deshabilitada.";
            title = "Cuenta Deshabilitada";
            break;
          default:
            message = "Credenciales inválidas o error desconocido.";
        }
      }
      toast({ title: title, description: message, variant: "destructive" });
      setCurrentUser(null);
      setIsCurrentUserAdmin(false);
    } finally {
      setIsLoading(false);
    }
  }, [router, toast, fetchUserProfile]);

  const register = useCallback(async (email?: string, password?: string) => {
    setIsLoading(true);
    if (!auth || !db) {
      toast({ title: 'Error de Configuración', description: 'Firebase Auth o Firestore no está disponible.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }
    if (!email || !password) {
      toast({ title: "Error de Registro", description: "Correo y contraseña son requeridos.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const targetEmail = email.trim().toLowerCase();
    let firebaseUserRegistered;

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, targetEmail, password);
      firebaseUserRegistered = userCredential.user;

      const userProfileData: UserProfile = {
        uid: firebaseUserRegistered.uid,
        email: targetEmail,
        // firstName and lastName are removed, username is optional
        isAdmin: targetEmail === ADMIN_EMAIL,
        createdAt: serverTimestamp() as Timestamp,
        activityLog: [],
      };

      await setDoc(doc(db, 'userProfiles', firebaseUserRegistered.uid), userProfileData);

      toast({ title: "Registro Exitoso", description: `Cuenta creada para ${targetEmail}. Por favor, inicia sesión.` });
      
      // Sign out the user immediately after successful profile creation
      if (auth.currentUser) { // Check if a user is indeed signed in by createUser
        await signOut(auth);
      }
      // Redirect to login page AFTER signing out
      router.push('/login'); 

    } catch (error: any) {
      console.error('Registration process error:', error.code, error.message);
      let message = "Ocurrió un problema al crear la cuenta.";

      if (error.code) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            message = "Este correo electrónico ya está registrado.";
            break;
          case 'auth/invalid-email':
            message = "El formato del correo electrónico es inválido.";
            break;
          case 'auth/weak-password':
            message = "La contraseña es demasiado débil. Debe tener al menos 6 caracteres.";
            break;
          case 'auth/requires-recent-login':
             message = "Esta operación es sensible y requiere autenticación reciente. Intenta iniciar sesión de nuevo.";
             break;
          case 'permission-denied': 
             message = "Permiso denegado por Firebase Authentication. Verifica la configuración de tu proyecto.";
             break;
          default:
            message = error.message || "Error desconocido durante el registro.";
        }
      } else if (firebaseUserRegistered && error.message && error.message.toLowerCase().includes('firestore')) {
        console.error(`Firestore Error after user ${firebaseUserRegistered.uid} created: ${error.message}`);
        message = "La cuenta de autenticación fue creada, pero hubo un problema al guardar el perfil. Contacta al soporte.";
      } else {
        console.error('Non-Firebase error or unknown error structure:', error);
      }

      toast({ title: "Error de Registro", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, router]);

  const logout = useCallback(async () => {
    if (!auth) return;
    setIsLoading(true);
    try {
      await signOut(auth);
      setCurrentUser(null);
      setIsCurrentUserAdmin(false);
      router.push('/login');
      toast({ title: "Sesión Cerrada", description: "Has cerrado sesión exitosamente." });
    } catch (error) {
      console.error("Logout error:", error);
      toast({ title: "Error", description: "No se pudo cerrar la sesión.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [router, toast]);

  const sendPasswordReset = useCallback(async (emailForReset: string) => {
    if (!auth) {
        toast({ title: 'Error de Configuración', description: 'Firebase Auth no está disponible.', variant: 'destructive' });
        return;
    }
    setIsLoading(true);
    try {
      await fbSendPasswordResetEmail(auth, emailForReset.trim());
      toast({
        title: "Correo de Recuperación Enviado",
        description: `Si una cuenta existe para ${emailForReset}, se ha enviado un correo con instrucciones.`,
        duration: 7000,
      });
    } catch (error: any) {
      console.error("Password reset error:", error);
      let message = "No se pudo enviar el correo de recuperación.";
      if (error.code === 'auth/user-not-found') {
        message = `Si una cuenta existe para ${emailForReset}, se ha enviado un correo. Si no lo ves, revisa tu carpeta de spam.`;
         toast({
            title: "Verifica tu Correo",
            description: message,
            duration: 7000,
        });
        setIsLoading(false);
        return;

      } else if (error.code === 'auth/invalid-email') {
        message = "El formato del correo electrónico es inválido.";
      }
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);


  const checkEmailExists = useCallback(async (email: string): Promise<boolean> => {
    if (!db || !email) return false;
    try {
      const profilesRef = collection(db, 'userProfiles');
      const q = query(profilesRef, where("email", "==", email.trim().toLowerCase()));
      const fbAuthUser = auth?.currentUser;
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
          if (fbAuthUser && querySnapshot.docs[0].id === fbAuthUser.uid) {
              return false;
          }
          return true;
      }
      return false;
    } catch (error) {
        console.error("Error checking email existence in Firestore (could be rules or network):", error);
        return false; 
    }
  }, []);


  const getCurrentUserUsername = useCallback((): string | null => {
    // Username is no longer a primary identifier, but if it exists in profile, return it.
    return currentUser?.profile?.username || currentUser?.profile?.email || null;
  }, [currentUser]);

  const getCurrentUserDetails = useCallback(async (): Promise<UserProfile | null> => {
    if (currentUser?.uid) {
        return fetchUserProfile(currentUser.uid);
    }
    return null;
  }, [currentUser, fetchUserProfile]);

  const getUsersFromFirestore = useCallback(async (): Promise<UserProfile[]> => {
    if (!db) throw new Error("Firestore not initialized");
    const profilesCollectionRef = collection(db, 'userProfiles');
    const profilesSnapshot = await getDocs(profilesCollectionRef);
    return profilesSnapshot.docs.map(docSnapshot => docSnapshot.data() as UserProfile);
  }, []);

  const deleteUserFromFirestore = async (uidToDelete: string): Promise<void> => {
    if (!db) throw new Error("Firestore not initialized");
    if (!uidToDelete) throw new Error("User UID not provided for deletion.");

    if (currentUser?.uid === uidToDelete) {
        toast({title: "Acción no permitida", description: "No puedes eliminar tu propia cuenta desde aquí.", variant: "destructive"});
        throw new Error("Cannot delete own user profile through this admin function.");
    }

    try {
      const userProfileDocRef = doc(db, 'userProfiles', uidToDelete);
      await deleteDoc(userProfileDocRef);
      toast({ title: 'Perfil Eliminado', description: 'El perfil de usuario ha sido eliminado de Firestore.' });
    } catch (error) {
      console.error('Error deleting user profile from Firestore:', error);
      toast({ title: 'Error al Eliminar', description: 'No se pudo eliminar el perfil de Firestore.', variant: 'destructive' });
      throw error;
    }
  };


  return {
    isAuthenticated: !!currentUser,
    isLoading,
    currentUser,
    isCurrentUserAdmin,
    login,
    register,
    logout,
    sendPasswordReset: sendPasswordReset,
    checkEmailExists, // Kept for now, but not used by registration form
    getCurrentUserUsername, 
    getCurrentUserDetails,
    getUsersFromFirestore,
    deleteUserFromFirestore,
  };
}

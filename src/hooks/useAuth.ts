
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
  collection, // For admin check and other Firestore operations if needed
  query,
  where,
  getDocs,
  deleteDoc
} from 'firebase/firestore';

// TourFileGen specific user profile data stored in Firestore
export interface UserProfile {
  uid: string; // Firebase Auth UID
  email: string; // Normalized email
  username: string; // Generated username, should be unique in Firestore profiles
  firstName: string;
  lastName:string;
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

const ADMIN_EMAIL = 'daniish77@gmail.com'; // Define the admin email address

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
        setIsCurrentUserAdmin(!!profile?.isAdmin);
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
      toast({ title: "Error", description: "Email y contraseña son requeridos.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, emailInput.trim(), passwordInput);
      const firebaseUser = userCredential.user;
      const profile = await fetchUserProfile(firebaseUser.uid);
      
      setCurrentUser({ ...firebaseUser, profile });
      setIsCurrentUserAdmin(!!profile?.isAdmin);
      
      const capitalizedFirstName = profile?.firstName.charAt(0).toUpperCase() + profile?.firstName.slice(1).toLowerCase() || 'Usuario';
      toast({ title: "Inicio de Sesión Exitoso", description: `¡Bienvenido de nuevo, ${capitalizedFirstName}!` });
      router.push('/');
    } catch (error: any) {
      console.error('Login error:', error);
      let message = "Credenciales incorrectas o error al iniciar sesión.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = "Correo electrónico o contraseña incorrectos.";
      } else if (error.code === 'auth/invalid-email') {
        message = "El formato del correo electrónico es inválido.";
      }
      toast({ title: "Error de Inicio de Sesión", description: message, variant: "destructive" });
      setCurrentUser(null);
      setIsCurrentUserAdmin(false);
    } finally {
      setIsLoading(false);
    }
  }, [router, toast, fetchUserProfile]);

  const register = useCallback(async (firstName?: string, lastName?: string, email?: string, username?: string, password?: string) => {
    setIsLoading(true);
    if (!auth || !db) {
      toast({ title: 'Error de Configuración', description: 'Firebase Auth o Firestore no está disponible.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }
    if (!firstName || !lastName || !email || !username || !password) {
      toast({ title: "Error de Registro", description: "Todos los campos son requeridos.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const targetEmail = email.trim().toLowerCase();
    const targetUsername = username.trim().toLowerCase();

    try {
      // Check if username already exists in userProfiles collection
      const usernameQuery = query(collection(db, "userProfiles"), where("username", "==", targetUsername));
      const usernameSnapshot = await getDocs(usernameQuery);
      if (!usernameSnapshot.empty) {
          toast({ title: "Error de Registro", description: "Este nombre de usuario ya está en uso.", variant: "destructive" });
          setIsLoading(false);
          return;
      }
      
      const userCredential = await createUserWithEmailAndPassword(auth, targetEmail, password);
      const firebaseUser = userCredential.user;

      const userProfileData: UserProfile = {
        uid: firebaseUser.uid,
        email: targetEmail,
        username: targetUsername,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        isAdmin: targetEmail === ADMIN_EMAIL, // Set admin if email matches
        createdAt: serverTimestamp() as Timestamp,
        activityLog: [],
      };

      await setDoc(doc(db, 'userProfiles', firebaseUser.uid), userProfileData);
      
      // Update currentUser state immediately
      setCurrentUser({ ...firebaseUser, profile: userProfileData });
      setIsCurrentUserAdmin(userProfileData.isAdmin || false);

      const capitalizedFirstName = userProfileData.firstName.charAt(0).toUpperCase() + userProfileData.firstName.slice(1).toLowerCase();
      toast({ title: "Registro Exitoso", description: `Cuenta creada para ${capitalizedFirstName}. Usuario: ${userProfileData.username}` });
      router.push('/login');

    } catch (error: any) {
      console.error('Registration error:', error);
      let message = "Ocurrió un problema al crear la cuenta.";
      if (error.code === 'auth/email-already-in-use') {
        message = "Este correo electrónico ya está registrado.";
      } else if (error.code === 'auth/invalid-email') {
        message = "El formato del correo electrónico es inválido.";
      } else if (error.code === 'auth/weak-password') {
        message = "La contraseña es demasiado débil. Debe tener al menos 6 caracteres.";
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
      // Optionally log this attempt to a generic activity log or user's log if UID is known
    } catch (error: any) {
      console.error("Password reset error:", error);
      let message = "No se pudo enviar el correo de recuperación.";
      if (error.code === 'auth/user-not-found') {
        message = "No se encontró ninguna cuenta con este correo electrónico.";
      } else if (error.code === 'auth/invalid-email') {
        message = "El formato del correo electrónico es inválido.";
      }
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);


  // Check if username exists in Firestore (for registration form validation)
  const checkUsernameExists = useCallback(async (username: string): Promise<boolean> => {
    if (!db || !username) return false;
    const profilesRef = collection(db, 'userProfiles');
    const q = query(profilesRef, where("username", "==", username.trim().toLowerCase()));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  }, []);
  
  // Email existence is implicitly checked by Firebase Auth during registration.
  // This function might be useful if you want to check before attempting registration.
  const checkEmailExists = useCallback(async (email: string): Promise<boolean> => {
    // Firebase Auth's createUserWithEmailAndPassword will fail if email is in use.
    // For a pre-check, you could use signInMethodsForEmail, but that's more complex.
    // For now, let Firebase Auth handle this during registration attempt.
    // If you *really* need a pre-check, this would be a Firestore query if emails are also in profiles.
    if (!db || !email) return false;
    const profilesRef = collection(db, 'userProfiles');
    const q = query(profilesRef, where("email", "==", email.trim().toLowerCase()));
    const fbAuthUser = auth?.currentUser; // Check if current user is trying to use their own email
    const querySnapshot = await getDocs(q);
     if (!querySnapshot.empty) {
        // If a document is found, check if it's the current user's profile (if logged in)
        if (fbAuthUser && querySnapshot.docs[0].id === fbAuthUser.uid) {
            return false; // It's the current user's email, so it's "available" for them to "keep"
        }
        return true; // Email exists for another user
    }
    return false; // Email does not exist
  }, []);


  // The following functions might need adaptation if they were fetching 'users' collection directly
  // For now, they are commented out or would need to fetch from 'userProfiles'
  const getCurrentUserUsername = useCallback((): string | null => {
    return currentUser?.profile?.username || null;
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
    
    // IMPORTANT: This only deletes the Firestore profile.
    // Deleting a Firebase Auth user requires Admin SDK privileges (backend function).
    // For a client-side app, you can't directly delete other Auth users.
    // The current logged-in user can delete their OWN account: currentUser?.delete()
    
    if (currentUser?.uid === uidToDelete) {
        toast({title: "Acción no permitida", description: "No puedes eliminar tu propia cuenta desde aquí.", variant: "destructive"});
        throw new Error("Cannot delete own user profile through this admin function.");
    }

    try {
      const userProfileDocRef = doc(db, 'userProfiles', uidToDelete);
      await deleteDoc(userProfileDocRef);
      toast({ title: 'Perfil Eliminado', description: 'El perfil de usuario ha sido eliminado de Firestore.' });
      // Refresh user list or UI as needed
    } catch (error) {
      console.error('Error deleting user profile from Firestore:', error);
      toast({ title: 'Error al Eliminar', description: 'No se pudo eliminar el perfil de Firestore.', variant: 'destructive' });
      throw error;
    }
  };


  return {
    isAuthenticated: !!currentUser,
    isLoading,
    currentUser, // This is FirebaseUser | null, or your CurrentUser type
    isCurrentUserAdmin,
    login,
    register,
    logout,
    sendPasswordReset: sendPasswordReset, // Renamed for clarity
    checkUsernameExists, // To check username in userProfiles
    checkEmailExists, // To check email in userProfiles (optional pre-check)
    
    // Keeping these for potential admin panel usage, though they operate on profiles now
    getCurrentUserUsername, // Gets username from current user's profile
    getCurrentUserDetails,  // Gets profile of current user
    getUsersFromFirestore, // Gets all user profiles
    deleteUserFromFirestore, // Deletes a user's Firestore profile (not Auth record)
  };
}

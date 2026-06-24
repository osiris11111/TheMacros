import { auth } from '../firebase';
import { OperationType, FirestoreErrorInfo } from '../types';

export const showToast = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
  const event = new CustomEvent('show-toast', { detail: { message, type } });
  window.dispatchEvent(event);
};

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email || undefined,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId || undefined,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  let userMessage = "An unexpected error occurred.";
  if (errInfo.error.includes("permission-denied")) {
    userMessage = "You don't have permission to perform this action.";
  } else if (errInfo.error.includes("offline")) {
    userMessage = "You are currently offline. Please check your connection.";
  }
  showToast(userMessage, 'error');
}

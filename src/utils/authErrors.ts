/**
 * Formats Firebase Auth error codes into friendly user messages.
 * Returns an empty string for intentional cancellations (like closing the popup).
 */
export function formatAuthError(err: any): string {
  if (!err) return '';
  const code = err.code || '';
  const msg = err.message || '';

  switch (code) {
    // Intentional cancellations: do not show any error message
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return '';

    case 'auth/popup-blocked':
      return 'The sign-in popup was blocked by your browser. Please allow popups for this site and try again.';
    case 'auth/user-not-found':
      return 'No account was found with this email address. Please check your spelling or register.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again or use "Forgot Password" to reset it.';
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please verify your credentials or reset your password.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email address. Please sign in instead.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is currently disabled in your Firebase Authentication console.';
    case 'auth/too-many-requests':
      return 'Access temporarily disabled due to many failed attempts. Try again later or reset your password.';
    case 'auth/network-request-failed':
      return 'Network connection issue. Please check your internet connection and try again.';
    case 'auth/missing-email':
      return 'Please enter an email address.';
    default:
      if (msg.includes('operation-not-allowed')) {
        return 'Email/Password sign-in is disabled in your Firebase console. Please use Google Account sign-in below, or enable Email/Password in Firebase Authentication settings.';
      }
      return msg || 'Authentication operation failed.';
  }
}

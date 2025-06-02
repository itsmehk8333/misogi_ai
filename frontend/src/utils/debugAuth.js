// Debug utility to help identify localStorage auth issues
export const debugAuthState = () => {
  console.group('🔍 Auth State Debug');
  
  // Check localStorage
  const authStorage = localStorage.getItem('auth-storage');
  console.log('localStorage auth-storage:', authStorage);
  
  if (authStorage) {
    try {
      const parsed = JSON.parse(authStorage);
      console.log('Parsed auth data:', parsed);
    } catch (e) {
      console.error('Failed to parse auth storage:', e);
    }
  }
  
  // Check all localStorage keys
  console.log('All localStorage keys:', Object.keys(localStorage));
  
  console.groupEnd();
};

export const clearAuthLocalStorage = () => {
  console.log('🧹 Clearing auth localStorage...');
  localStorage.removeItem('auth-storage');
  console.log('Auth localStorage cleared');
};

// Call this before registration to ensure clean state
export const prepareForRegistration = () => {
  console.log('🚀 Preparing for registration...');
  debugAuthState();
  clearAuthLocalStorage();
  console.log('Ready for registration');
};

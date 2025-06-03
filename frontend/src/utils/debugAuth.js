// Debug utility to help identify localStorage auth issues
export const debugAuthState = () => {
  // Debug logging removed - use only for development debugging when needed
};

export const clearAuthLocalStorage = () => {
  localStorage.removeItem('auth-storage');
};

// Call this before registration to ensure clean state
export const prepareForRegistration = () => {
  clearAuthLocalStorage();
};

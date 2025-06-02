import React from 'react';

const LoadingSpinner = React.memo(({ size = 'md', className = '' }) => {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8', 
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };
  
  return (
    <div className={`inline-block ${className}`}>
      <svg 
        className={`animate-spin ${sizes[size]} text-medical-600 dark:text-medical-400`}
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 24 24"
      >
        <circle 
          className="opacity-25" 
          cx="12" 
          cy="12" 
          r="10" 
          stroke="currentColor" 
          strokeWidth="4"
        />
        <path 
          className="opacity-75" 
          fill="currentColor" 
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
});

const LoadingPage = React.memo(({ message = 'Loading...' }) => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="xl" />
        <p className="mt-4 text-lg text-gray-600">{message}</p>
      </div>
    </div>
  );
});

const LoadingOverlay = React.memo(({ show, message = 'Loading...' }) => {
  if (!show) return null;
  
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 flex items-center space-x-4">
        <LoadingSpinner size="lg" />
        <span className="text-lg text-gray-700">{message}</span>
      </div>
    </div>
  );
});

export { LoadingSpinner, LoadingPage, LoadingOverlay };
export default LoadingSpinner;

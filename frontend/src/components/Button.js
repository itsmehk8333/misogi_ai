import React from 'react';

const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  disabled = false, 
  loading = false, 
  onClick, 
  type = 'button',
  className = '',
  ...props 
}) => {
  const baseClasses = `
    inline-flex items-center justify-center
    rounded-lg font-medium
    transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800
    disabled:opacity-50 disabled:cursor-not-allowed
    transform hover:scale-[1.02] active:scale-[0.98]
  `;
  
  const variants = {
    primary: 'bg-medical-600 text-white hover:bg-medical-700 shadow-sm hover:shadow focus:ring-medical-500 dark:bg-medical-700 dark:hover:bg-medical-800',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 shadow-sm hover:shadow focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600',
    success: 'bg-green-600 text-white hover:bg-green-700 shadow-sm hover:shadow focus:ring-green-500 dark:bg-green-700 dark:hover:bg-green-800',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm hover:shadow focus:ring-red-500 dark:bg-red-700 dark:hover:bg-red-800',
    warning: 'bg-yellow-600 text-white hover:bg-yellow-700 shadow-sm hover:shadow focus:ring-yellow-500 dark:bg-yellow-700 dark:hover:bg-yellow-800',
    outline: `
      border-2 border-medical-600 text-medical-600
      hover:bg-medical-50 hover:border-medical-700 hover:text-medical-700
      focus:ring-medical-500 shadow-sm hover:shadow
      dark:border-medical-400 dark:text-medical-400
      dark:hover:bg-gray-800 dark:hover:border-medical-300 dark:hover:text-medical-300
    `,
    ghost: `
      text-medical-600 hover:bg-medical-50
      focus:ring-medical-500
      dark:text-medical-400 dark:hover:bg-gray-800/50 dark:hover:text-medical-300
    `
  };
  
  const sizes = {
    xs: 'px-2.5 py-1.5 text-xs',
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    xl: 'px-8 py-4 text-lg'
  };
  
  const classes = `${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`;
  
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && (
        <svg 
          className="animate-spin -ml-1 mr-2 h-4 w-4" 
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
      )}
      {children}
    </button>
  );
};

export default React.memo(Button);

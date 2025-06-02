import React, { forwardRef } from 'react';

const Input = forwardRef(({
  label,
  type = 'text',
  error,
  helper,
  required = false,
  disabled = false,
  className = '',
  containerClassName = '',
  leftIcon,
  rightIcon,
  ...props
}, ref) => {
  const baseClasses = 'block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm placeholder-gray-400 dark:placeholder-gray-400 shadow-sm transition-colors focus:border-medical-500 focus:outline-none focus:ring-1 focus:ring-medical-500 disabled:bg-gray-50 disabled:text-gray-500 dark:bg-gray-700 dark:text-white dark:focus:ring-medical-400 dark:focus:border-medical-400';
  
  const errorClasses = error 
    ? 'border-red-300 focus:border-red-500 focus:ring-red-500 dark:border-red-500' 
    : '';
  
  const iconClasses = leftIcon || rightIcon ? 'pr-10' : '';
  
  const inputClasses = `${baseClasses} ${errorClasses} ${iconClasses} ${className}`;
  
  return (
    <div className={`space-y-1 ${containerClassName}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            {leftIcon}
          </div>
        )}
        
        <input
          ref={ref}
          type={type}
          className={inputClasses}
          disabled={disabled}
          {...props}
        />
        
        {rightIcon && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            {rightIcon}
          </div>
        )}
      </div>
      
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      
      {helper && !error && (
        <p className="text-sm text-gray-500">{helper}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;

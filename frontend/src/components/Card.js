import React from 'react';

const Card = ({ 
  children, 
  title, 
  subtitle,
  className = '',
  headerClassName = '',
  bodyClassName = '',
  actions,
  padding = true,
  shadow = true,
  interactive = false,
  ...props 
}) => {
  const baseClasses = 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl';
  const shadowClasses = shadow ? 'shadow-sm hover:shadow-md transition-shadow dark:shadow-gray-900/30' : '';
  const cardClasses = `${baseClasses} ${shadowClasses} ${className}`;
  
  return (
    <div 
      className={`
        ${cardClasses}
        ${interactive ? 'hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600' : ''}
      `} 
      {...props}
    >
      {(title || subtitle || actions) && (
        <div className={`px-6 py-4 border-b border-gray-200 dark:border-gray-700 ${headerClassName}`}>
          <div className="flex items-center justify-between">
            <div>
              {title && (
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">{title}</h3>
              )}
              {subtitle && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
              )}
            </div>
            {actions && (
              <div className="flex items-center space-x-2">
                {actions}
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className={`${padding ? 'px-6 py-4' : ''} dark:text-gray-300 ${bodyClassName}`}>
        {children}
      </div>
    </div>
  );
};

export default React.memo(Card);

// Input validation utilities
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password) => {
  const errors = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateRequired = (value, fieldName = 'Field') => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return {
      isValid: false,
      error: `${fieldName} is required`
    };
  }
  return { isValid: true };
};

export const validateMinLength = (value, minLength, fieldName = 'Field') => {
  if (value && value.length < minLength) {
    return {
      isValid: false,
      error: `${fieldName} must be at least ${minLength} characters long`
    };
  }
  return { isValid: true };
};

export const validateMaxLength = (value, maxLength, fieldName = 'Field') => {
  if (value && value.length > maxLength) {
    return {
      isValid: false,
      error: `${fieldName} must be no more than ${maxLength} characters long`
    };
  }
  return { isValid: true };
};

export const validateNumeric = (value, fieldName = 'Field') => {
  if (value && isNaN(Number(value))) {
    return {
      isValid: false,
      error: `${fieldName} must be a valid number`
    };
  }
  return { isValid: true };
};

export const validatePositiveNumber = (value, fieldName = 'Field') => {
  const numValue = Number(value);
  if (value && (isNaN(numValue) || numValue <= 0)) {
    return {
      isValid: false,
      error: `${fieldName} must be a positive number`
    };
  }
  return { isValid: true };
};

export const validateDate = (value, fieldName = 'Date') => {
  if (value && isNaN(Date.parse(value))) {
    return {
      isValid: false,
      error: `${fieldName} must be a valid date`
    };
  }
  return { isValid: true };
};

export const validateTime = (value, fieldName = 'Time') => {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (value && !timeRegex.test(value)) {
    return {
      isValid: false,
      error: `${fieldName} must be in HH:MM format`
    };
  }
  return { isValid: true };
};

export const validatePhone = (phone) => {
  const phoneRegex = /^\+?[\d\s\-()]{10,}$/;
  return phoneRegex.test(phone);
};

export const validateUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Form validation utility
export const validateForm = (formData, rules) => {
  const errors = {};
  let isValid = true;
  
  Object.keys(rules).forEach(field => {
    const value = formData[field];
    const fieldRules = rules[field];
    const fieldErrors = [];
    
    // Required validation
    if (fieldRules.required) {
      const result = validateRequired(value, fieldRules.label || field);
      if (!result.isValid) {
        fieldErrors.push(result.error);
        isValid = false;
      }
    }
    
    // Skip other validations if field is empty and not required
    if (!value && !fieldRules.required) {
      return;
    }
    
    // Email validation
    if (fieldRules.email && value) {
      if (!validateEmail(value)) {
        fieldErrors.push(`${fieldRules.label || field} must be a valid email address`);
        isValid = false;
      }
    }
    
    // Password validation
    if (fieldRules.password && value) {
      const result = validatePassword(value);
      if (!result.isValid) {
        fieldErrors.push(...result.errors);
        isValid = false;
      }
    }
    
    // Min length validation
    if (fieldRules.minLength && value) {
      const result = validateMinLength(value, fieldRules.minLength, fieldRules.label || field);
      if (!result.isValid) {
        fieldErrors.push(result.error);
        isValid = false;
      }
    }
    
    // Max length validation
    if (fieldRules.maxLength && value) {
      const result = validateMaxLength(value, fieldRules.maxLength, fieldRules.label || field);
      if (!result.isValid) {
        fieldErrors.push(result.error);
        isValid = false;
      }
    }
    
    // Numeric validation
    if (fieldRules.numeric && value) {
      const result = validateNumeric(value, fieldRules.label || field);
      if (!result.isValid) {
        fieldErrors.push(result.error);
        isValid = false;
      }
    }
    
    // Positive number validation
    if (fieldRules.positive && value) {
      const result = validatePositiveNumber(value, fieldRules.label || field);
      if (!result.isValid) {
        fieldErrors.push(result.error);
        isValid = false;
      }
    }
    
    // Date validation
    if (fieldRules.date && value) {
      const result = validateDate(value, fieldRules.label || field);
      if (!result.isValid) {
        fieldErrors.push(result.error);
        isValid = false;
      }
    }
    
    // Time validation
    if (fieldRules.time && value) {
      const result = validateTime(value, fieldRules.label || field);
      if (!result.isValid) {
        fieldErrors.push(result.error);
        isValid = false;
      }
    }
    
    // Custom validation
    if (fieldRules.custom && value) {
      const result = fieldRules.custom(value, formData);
      if (!result.isValid) {
        fieldErrors.push(result.error);
        isValid = false;
      }
    }
    
    if (fieldErrors.length > 0) {
      errors[field] = fieldErrors;
    }
  });
  
  return {
    isValid,
    errors
  };
};

// Medication-specific validations
export const validateMedication = (medicationData) => {
  const rules = {
    name: {
      required: true,
      minLength: 2,
      maxLength: 100,
      label: 'Medication name'
    },
    dosage: {
      required: true,
      label: 'Dosage'
    },
    unit: {
      required: true,
      label: 'Unit'
    },
    category: {
      required: true,
      label: 'Category'
    }
  };
  
  return validateForm(medicationData, rules);
};

// Regimen-specific validations
export const validateRegimen = (regimenData) => {
  const rules = {
    medication: {
      required: true,
      label: 'Medication'
    },
    dosage: {
      required: true,
      positive: true,
      label: 'Dosage'
    },
    'schedule.frequency': {
      required: true,
      positive: true,
      label: 'Frequency'
    },
    'schedule.times': {
      required: true,
      custom: (value) => {
        if (!Array.isArray(value) || value.length === 0) {
          return { isValid: false, error: 'At least one time must be specified' };
        }
        
        for (const time of value) {
          const timeResult = validateTime(time, 'Schedule time');
          if (!timeResult.isValid) {
            return timeResult;
          }
        }
        
        return { isValid: true };
      },
      label: 'Schedule times'
    },
    startDate: {
      required: true,
      date: true,
      label: 'Start date'
    }
  };
  
  return validateForm(regimenData, rules);
};

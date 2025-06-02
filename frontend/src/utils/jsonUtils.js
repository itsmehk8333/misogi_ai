// JSON sanitization utility
export const sanitizeForJSON = (obj) => {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    // Remove or escape problematic characters
    return obj
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
      .replace(/\\(?!["\\\/bfnrt])/g, '\\\\') // Escape backslashes not followed by valid escape chars
      .trim();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForJSON(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeForJSON(obj[key]);
      }
    }
    return sanitized;
  }
  
  return obj;
};

// Validate JSON before sending
export const validateJSON = (data) => {
  try {
    const jsonString = JSON.stringify(data);
    JSON.parse(jsonString); // This will throw if invalid
    return true;
  } catch (error) {
    console.error('JSON validation failed:', error.message);
    console.error('Problematic data:', data);
    return false;
  }
};

export default {
  sanitizeForJSON,
  validateJSON
};

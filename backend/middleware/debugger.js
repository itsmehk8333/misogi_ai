const debugRequest = (req, res, next) => {
  // Debug middleware disabled for production - only enable when needed
  next();
};

module.exports = debugRequest;

const debugRequest = (req, res, next) => {
  // Only debug POST requests to doses
  if (req.method === 'POST' && req.url.includes('/doses')) {
    console.log('=== DEBUG REQUEST ===');
    console.log('URL:', req.url);
    console.log('Method:', req.method);
    console.log('Headers:', req.headers);
    
    // Capture raw body
    let rawBody = '';
    req.on('data', chunk => {
      rawBody += chunk.toString();
    });
    
    req.on('end', () => {
      console.log('Raw Body:', rawBody);
      console.log('Raw Body Length:', rawBody.length);
      console.log('Raw Body Bytes:', Buffer.from(rawBody).length);
      
      // Try to parse and see where it fails
      try {
        const parsed = JSON.parse(rawBody);
        console.log('Parsed successfully:', parsed);
      } catch (error) {
        console.log('Parse error:', error.message);
        console.log('Character at error position:', rawBody.charAt(error.message.match(/position (\d+)/)?.[1] || 0));
      }
      console.log('=== END DEBUG ===');
    });
  }
  
  next();
};

module.exports = debugRequest;

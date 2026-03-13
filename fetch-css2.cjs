const https = require('https');

https.get('https://www.sempervirensvc.com/', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const cssLinks = data.match(/href="([^"]+\.css[^"]*)"/g) || [];
    console.log("CSS Links:", cssLinks);
    
    // Also let's just print all hex colors properly
    const colors = data.match(/#[0-9a-fA-F]{6}\b/g) || [];
    console.log("Hex Colors in HTML:", [...new Set(colors)]);
  });
});

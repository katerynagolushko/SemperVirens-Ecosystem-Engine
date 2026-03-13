const https = require('https');

https.get('https://www.sempervirensvc.com/', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const colors = data.match(/#[0-9a-fA-F]{3,6}/g) || [];
    const fonts = data.match(/font-family[^;"]+/g) || [];
    console.log("Colors:", [...new Set(colors)]);
    console.log("Fonts:", [...new Set(fonts)]);
  });
});

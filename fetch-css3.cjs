const https = require('https');

https.get('https://cdn.prod.website-files.com/68eddcc606a8edb1c129bc07/css/sempervirens-stage.shared.a5d6f813b.min.css', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const colors = data.match(/#[0-9a-fA-F]{6}\b/g) || [];
    const fonts = data.match(/font-family:[^;\}]+/g) || [];
    console.log("Colors:", [...new Set(colors)]);
    console.log("Fonts:", [...new Set(fonts)]);
  });
});

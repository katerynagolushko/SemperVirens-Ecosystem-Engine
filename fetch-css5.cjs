const https = require('https');

https.get('https://cdn.prod.website-files.com/68eddcc606a8edb1c129bc07/css/sempervirens-stage.shared.a5d6f813b.min.css', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const gradients = data.match(/linear-gradient\([^)]+\)/g) || [];
    console.log("Gradients:", [...new Set(gradients)].slice(0, 10));
  });
});

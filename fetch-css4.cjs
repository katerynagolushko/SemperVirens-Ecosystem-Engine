const https = require('https');

https.get('https://www.sempervirensvc.com/', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const vars = data.match(/--[^:]+:[^;]+/g) || [];
    console.log("CSS Vars:", vars.filter(v => v.includes('color') || v.includes('font')).slice(0, 50));
  });
});

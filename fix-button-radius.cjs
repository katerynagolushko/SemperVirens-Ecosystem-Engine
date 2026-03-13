const fs = require('fs');

let content = fs.readFileSync('/app/applet/src/App.tsx', 'utf8');

// Fix buttons that got rounded-2xl instead of rounded-full
content = content.replace(/rounded-2xl text-sm font-medium transition-all shadow-sm/g, 'rounded-full text-sm font-medium transition-all shadow-sm');
content = content.replace(/rounded-2xl transition-all shadow-sm disabled:opacity-70/g, 'rounded-full transition-all shadow-sm disabled:opacity-70');

fs.writeFileSync('/app/applet/src/App.tsx', content);
console.log('Fixed button radii in App.tsx');

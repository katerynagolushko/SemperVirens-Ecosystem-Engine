const fs = require('fs');

let content = fs.readFileSync('/app/applet/src/App.tsx', 'utf8');

// Replace rounded-lg with rounded-full for buttons
content = content.replace(/rounded-lg/g, 'rounded-full');

// Replace rounded-xl with rounded-2xl for cards and inputs
content = content.replace(/rounded-xl/g, 'rounded-2xl');

fs.writeFileSync('/app/applet/src/App.tsx', content);
console.log('Updated border radii in App.tsx');

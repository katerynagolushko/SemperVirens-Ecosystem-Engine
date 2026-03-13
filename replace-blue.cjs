const fs = require('fs');

let content = fs.readFileSync('/app/applet/src/App.tsx', 'utf8');

const replacements = {
  'bg-blue-50': 'bg-sv-light-blue-lightest',
  'border-blue-100': 'border-sv-light-blue-lighter',
  'text-blue-600': 'text-sv-light-blue',
  'text-blue-900': 'text-sv-dark-blue',
  'text-blue-800': 'text-sv-dark-blue-light'
};

for (const [key, value] of Object.entries(replacements)) {
  content = content.split(key).join(value);
}

fs.writeFileSync('/app/applet/src/App.tsx', content);
console.log('Replaced blue colors in App.tsx');

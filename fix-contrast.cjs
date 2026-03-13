const fs = require('fs');

let content = fs.readFileSync('/app/applet/src/App.tsx', 'utf8');

const replacements = {
  'text-sv-neutral-lighter': 'text-sv-neutral-light',
  'text-sv-neutral-light': 'text-sv-neutral',
  'text-sv-neutral': 'text-sv-neutral-dark',
  'text-sv-neutral-dark': 'text-sv-neutral-darker',
  'text-sv-neutral-darker': 'text-sv-neutral-darkest',
};

// We have to be careful about order of replacement so we don't double-replace.
// Let's use regex with word boundaries.

content = content.replace(/\btext-sv-neutral-lighter\b/g, 'TEMP_LIGHTER');
content = content.replace(/\btext-sv-neutral-light\b/g, 'TEMP_LIGHT');
content = content.replace(/\btext-sv-neutral\b/g, 'TEMP_NEUTRAL');
content = content.replace(/\btext-sv-neutral-dark\b/g, 'TEMP_DARK');
content = content.replace(/\btext-sv-neutral-darker\b/g, 'TEMP_DARKER');

content = content.replace(/\bTEMP_LIGHTER\b/g, 'text-sv-neutral-light');
content = content.replace(/\bTEMP_LIGHT\b/g, 'text-sv-neutral');
content = content.replace(/\bTEMP_NEUTRAL\b/g, 'text-sv-neutral-dark');
content = content.replace(/\bTEMP_DARK\b/g, 'text-sv-neutral-darker');
content = content.replace(/\bTEMP_DARKER\b/g, 'text-sv-neutral-darkest');

fs.writeFileSync('/app/applet/src/App.tsx', content);
console.log('Fixed text contrast in App.tsx');

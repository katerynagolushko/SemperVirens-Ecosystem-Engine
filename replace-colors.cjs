const fs = require('fs');

let content = fs.readFileSync('/app/applet/src/App.tsx', 'utf8');

const replacements = {
  'bg-stone-50': 'bg-sv-neutral-lightest',
  'text-stone-900': 'text-sv-neutral-darkest',
  'text-stone-800': 'text-sv-neutral-darker',
  'text-stone-700': 'text-sv-neutral-dark',
  'text-stone-600': 'text-sv-neutral',
  'text-stone-500': 'text-sv-neutral-light',
  'text-stone-400': 'text-sv-neutral-lighter',
  'bg-stone-100': 'bg-sv-neutral-lighter',
  'bg-stone-200': 'bg-sv-neutral-light',
  'border-stone-100': 'border-sv-neutral-lighter',
  'border-stone-200': 'border-sv-neutral-light',

  'bg-emerald-800': 'bg-sv-dark-blue',
  'bg-emerald-900': 'bg-sv-dark-blue-dark',
  'text-emerald-800': 'text-sv-dark-blue',
  'text-emerald-700': 'text-sv-light-blue-dark',
  'bg-emerald-100': 'bg-sv-light-blue-lightest',
  'bg-emerald-50': 'bg-sv-light-blue-lightest',
  'border-emerald-300': 'border-sv-light-blue',
  'border-emerald-200': 'border-sv-light-blue-lighter',
  'border-emerald-500': 'border-sv-light-blue',
  'ring-emerald-500/20': 'ring-sv-light-blue/20',
  'selection:bg-emerald-200': 'selection:bg-sv-light-blue-lighter',
  'text-emerald-500': 'text-sv-light-blue',
  'hover:text-emerald-800': 'hover:text-sv-dark-blue',
  'hover:border-emerald-300': 'hover:border-sv-light-blue',
  'hover:border-emerald-200': 'hover:border-sv-light-blue-lighter',
  'hover:bg-emerald-900': 'hover:bg-sv-dark-blue-dark',
  'group-hover:text-emerald-800': 'group-hover:text-sv-dark-blue',
  'group-hover:text-emerald-700': 'group-hover:text-sv-light-blue-dark',
  'group-hover:bg-emerald-50': 'group-hover:bg-sv-light-blue-lightest'
};

for (const [key, value] of Object.entries(replacements)) {
  content = content.split(key).join(value);
}

fs.writeFileSync('/app/applet/src/App.tsx', content);
console.log('Replaced colors in App.tsx');

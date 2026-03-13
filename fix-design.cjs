const fs = require('fs');

let content = fs.readFileSync('/app/applet/src/App.tsx', 'utf8');

// Replace font-serif with font-sans
content = content.replace(/\bfont-serif\b/g, 'font-sans');

// Add gradient to the headline
content = content.replace(
  'Who would you like to meet?',
  'Who would you like to <span className="bg-gradient-to-r from-sv-lavender via-sv-salmon to-sv-orange bg-clip-text text-transparent">meet?</span>'
);

// Add gradient to the "Ecosystem Matchmaker" badge
content = content.replace(
  'bg-sv-light-blue-lightest text-sv-dark-blue',
  'bg-sv-light-blue-lightest text-sv-dark-blue border border-sv-light-blue-lighter'
);

fs.writeFileSync('/app/applet/src/App.tsx', content);
console.log('Added gradient and fixed fonts in App.tsx');

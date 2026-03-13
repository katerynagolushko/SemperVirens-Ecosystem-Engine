import fs from 'fs';

const lines = fs.readFileSync('advisors.csv', 'utf8').split('\n');

function parseCsvLine(text) {
    let ret = [], p = '', inQuote = false;
    for (let i = 0; i < text.length; i++) {
        let c = text[i];
        if (inQuote) {
            if (c === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') { p += '"'; i++; }
                else inQuote = false;
            } else { p += c; }
        } else {
            if (c === '"') inQuote = true;
            else if (c === ',') { ret.push(p.trim()); p = ''; }
            else p += c;
        }
    }
    ret.push(p.trim());
    return ret;
}

const profiles = [];
// Skip first two header lines
for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === '') continue;
    const cols = parseCsvLine(line);
    if (!cols || !cols[0]) continue;

    const expertiseRaw = cols[13] || '';
    const expertise = expertiseRaw ? expertiseRaw.split(',').map(s => s.trim()) : [];

    const bioParts = [];
    if (cols[12]) bioParts.push('Past Roles: ' + cols[12]);
    if (cols[15]) bioParts.push('Achievements: ' + cols[15]);
    if (cols[16]) bioParts.push('How they help: ' + cols[16]);

    const fullNameParts = cols[0].split(' ');
    const firstName = fullNameParts[0] || 'Unknown';
    const lastName = fullNameParts.slice(1).join('') || 'Unknown';

    profiles.push({
        id: 'profile-' + (i - 1),
        name: cols[0],
        role: cols[1],
        company: cols[2],
        expertise: expertise,
        bio: bioParts.join('. '),
        imageUrl: `https://api.dicebear.com/7.x/notionists/svg?seed=${firstName}${lastName}${i}&backgroundColor=e5e7eb`
    });
}

const content = `import { Profile } from './types';

export const ADVISOR_DATA: Profile[] = ${JSON.stringify(profiles, null, 2)};
`;

fs.writeFileSync('src/data.ts', content);
console.log('Successfully wrote src/data.ts with ' + profiles.length + ' profiles.');

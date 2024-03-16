import fs from 'fs'

console.log(JSON.parse(fs.readFileSync('dist/system.json', 'utf8')).version);
const fs = require('fs');

let taoContent = fs.readFileSync('src/pages/Accounty/Tao/ClientTaoMainPage.tsx', 'utf8');
taoContent = taoContent.replace(/\/accounty\/client\/\${id}\/tao/g, '/accounty/${companyId}/${dateRange}/tao');
fs.writeFileSync('src/pages/Accounty/Tao/ClientTaoMainPage.tsx', taoContent, 'utf8');
console.log('Successfully updated TAO links in ClientTaoMainPage.tsx');

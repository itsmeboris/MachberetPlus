import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
await mkdir('tests/fixtures',{recursive:true});
const browser=await chromium.launch();
try{const page=await browser.newPage({viewport:{width:1000,height:1200}});await page.setContent('<html lang="he" dir="rtl"><style>body{margin:60px;font:38px Arial;color:#111;background:white}h1{font-size:44px;margin:40px 0 90px}p{margin:70px 0}.math{direction:ltr;text-align:center;font-size:50px}</style><h1>דף עבודה בחשבון</h1><p>פתרו את התרגילים</p><p class="math">1. 12 + 3 =</p><p class="math">2. 8 - 2 =</p><p>כתבו את השם שלכם</p></html>');await page.screenshot({path:'tests/fixtures/hebrew-worksheet.png'});}finally{await browser.close();}

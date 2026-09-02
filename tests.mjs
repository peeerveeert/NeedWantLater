import { createRequire } from 'module';
const require=createRequire(import.meta.url);
const C=require('./classifier.js');
const tests=[
  ['Надо удалить зубы мудрости примерно 20-40к','need','Здоровье',20000,40000],
  ['Хочу новые мониторы в студию за 30к','want','Студия',30000,30000],
  ['Когда-нибудь проектор для дома примерно 60к','later','Дом',60000,60000],
  ['Мне нужны очки','need','Личное',null,null],
  ['Хочу новую куртку примерно 10-20к','want','Одежда',10000,20000]
];
let failed=0;
for(const [text,type,cat,min,max] of tests){
  const r=C.classify(text);
  const ok=r.type===type&&r.category===cat&&r.priceMin===min&&r.priceMax===max;
  console.log(ok?'PASS':'FAIL', text, '=>', r.type,r.category,r.priceMin,r.priceMax);
  if(!ok) failed++;
}
if(failed) process.exit(1);
console.log(`PASS ${tests.length} classifier checks`);

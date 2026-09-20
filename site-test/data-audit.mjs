/* 배포되는 실제 딜 데이터를 훑습니다 — check.mjs 는 픽스처만 보므로
   진짜 데이터의 이상값(등급표 밖의 grade, 중복 링크, 미래 날짜 …)은 여기서 잡습니다. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run=(f)=>{const w={};new Function("window",fs.readFileSync(R+f,"utf8"))(w);return w;};
const SITE=run("/data/site.js").SITE, DEALS=run("/data/deals.js").DEALS;
const catOf=c=>typeof c==="string"?{name:c}:c;
const fires=SITE.grades.map(g=>g.fire);
const cats=SITE.categories.map(c=>catOf(c).name);
const bad=[];
const seen=new Map();
DEALS.forEach((d,i)=>{
  const at=`[${i}] ${String(d.title).slice(0,28)}`;
  if(!d.title) bad.push(`${at} 상품명 없음`);
  if(!d.url) bad.push(`${at} 링크 없음`);
  if(!(Number(d.price)>0)) bad.push(`${at} 가격이 없거나 0`);
  if(d.grade!==undefined && !fires.includes(d.grade)) bad.push(`${at} grade=${d.grade} 가 등급표(${fires})에 없음 → 배지가 안 보임`);
  if(d.category && !cats.includes(d.category)) bad.push(`${at} category="${d.category}" 가 설정에 없음 → 칩이 하나 더 생김`);
  if(d.listPrice!==undefined && !(d.listPrice>d.price)) bad.push(`${at} 평소가(${d.listPrice}) 가 지금가(${d.price}) 보다 크지 않음`);
  if(d.postedAt && Number.isNaN(new Date(d.postedAt).getTime())) bad.push(`${at} postedAt 을 날짜로 못 읽음: ${d.postedAt}`);
  if(d.postedAt && new Date(d.postedAt).getTime() > Date.now()+3600e3) bad.push(`${at} postedAt 이 미래`);
  if(d.ended && !d.endedAt) bad.push(`${at} 마감인데 endedAt 없음 → 마감 표시 없이 그냥 사라짐`);
  if(d.url){ if(seen.has(d.url)) bad.push(`${at} 링크 중복 — [${seen.get(d.url)}] 과 같음`); else seen.set(d.url,i); }
  if(d.note && d.note.length>90) bad.push(`${at} 메모 ${d.note.length}자 — 카드에서 두 줄로 잘림`);
});
// 분포
const live=DEALS.filter(d=>!d.ended), g={};
live.forEach(d=>g[d.grade]=(g[d.grade]||0)+1);
const pct=f=>Math.round((g[f]||0)/live.length*100);
console.log(`딜 ${live.length}개 · 분포 ${fires.map(f=>pct(f)+"%").join(" / ")} (목표 20 / 60 / 20)`);
const isRemote=u=>/^https?:\/\//i.test(u||"");
const host=u=>{try{return new URL(u).host}catch{return "?"}};
const imgs={};
live.forEach(d=>{ if(!d.image) return;
  const k = isRemote(d.image) ? host(d.image) : "저장소";
  imgs[k]=(imgs[k]||0)+1; });
console.log("사진 출처:",JSON.stringify(imgs));
console.log("사진 없는 딜:",live.filter(d=>!d.image).length);
// 저장소 안을 가리키는데 파일이 없으면 카드가 조용히 아이콘으로 바뀝니다
live.forEach((d,i)=>{ if(!d.image||isRemote(d.image)) return;
  if(!fs.existsSync(path.join(R,d.image)))
    bad.push(`[${i}] ${String(d.title).slice(0,28)} 사진 파일이 없음: ${d.image}`); });
const remote=live.filter(d=>isRemote(d.image)).length;
if(remote) console.log(`⚠ 사진 ${remote}장이 아직 바깥 주소 — 「딜 사진 내려받기」 워크플로를 돌리면 저장소로 옮겨집니다`);
console.log(bad.length?"\n문제 "+bad.length+"건:\n"+bad.join("\n"):"\n데이터 정합성 오류 0");
process.exit(bad.length?1:0);

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.167.1/build/three.module.js";

const cfgs={
  read:{windowMs:1350,cueLead:650},
  match:{windowMs:950,cueLead:520},
  elite:{windowMs:700,cueLead:420}
};
const deceptionChance={low:.2,medium:.48,high:.72};
const labels={left:"4 號位",middle:"Quick",right:"2 號位"};
const el=id=>document.getElementById(id);
const startBtn=el("startBtn"),difficulty=el("difficulty"),deception=el("deception"),roundCount=el("roundCount");
const buttons=[...document.querySelectorAll(".decision-btn")];

let state={active:false,round:0,total:10,correct:0,score:0,rt:[],target:null,answered:false,startTs:0,timers:[],scenario:null};

const canvas=el("scene");
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x07101a);
scene.fog=new THREE.Fog(0x07101a,16,34);

const camera=new THREE.PerspectiveCamera(48,16/9,.1,100);
camera.position.set(0,2.25,8.7);
camera.lookAt(0,1.7,-3.2);

scene.add(new THREE.HemisphereLight(0xe7f2ff,0x1e2530,2.2));
const keyLight=new THREE.DirectionalLight(0xffffff,2.2);
keyLight.position.set(-5,9,5);keyLight.castShadow=true;scene.add(keyLight);

const floor=new THREE.Mesh(
  new THREE.PlaneGeometry(18,28),
  new THREE.MeshStandardMaterial({color:0xb86f3f,roughness:.86,metalness:0})
);
floor.rotation.x=-Math.PI/2;floor.position.z=-4;floor.receiveShadow=true;scene.add(floor);

function line(x1,z1,x2,z2,color=0xffffff,opacity=.75){
  const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1,.012,z1),new THREE.Vector3(x2,.012,z2)]);
  const m=new THREE.LineBasicMaterial({color,transparent:true,opacity});
  scene.add(new THREE.Line(g,m));
}
for(const x of [-4.5,4.5]) line(x,-13,x,5.5);
line(-4.5,5.5,4.5,5.5);line(-4.5,-13,4.5,-13);line(-4.5,-3.5,4.5,-3.5,0xffffff,.5);

const netMat=new THREE.MeshStandardMaterial({color:0xe7edf6,transparent:true,opacity:.4,wireframe:true});
const net=new THREE.Mesh(new THREE.PlaneGeometry(9,2.35,18,5),netMat);
net.position.set(0,1.55,0);scene.add(net);
const tape=new THREE.Mesh(new THREE.BoxGeometry(9,.07,.07),new THREE.MeshStandardMaterial({color:0xf7fbff}));
tape.position.set(0,2.72,0);scene.add(tape);

function makePlayer(label,color){
  const root=new THREE.Group();
  const mat=new THREE.MeshStandardMaterial({color,roughness:.7});
  const dark=new THREE.MeshStandardMaterial({color:0x202a3c,roughness:.8});
  const skin=new THREE.MeshStandardMaterial({color:0xe1b497,roughness:.9});
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.34,.78,5,10),mat);body.position.y=1.15;body.castShadow=true;root.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.24,18,12),skin);head.position.y=2.02;head.castShadow=true;root.add(head);
  const lLeg=new THREE.Mesh(new THREE.CylinderGeometry(.1,.12,.75,10),dark);lLeg.position.set(-.16,.43,0);root.add(lLeg);
  const rLeg=lLeg.clone();rLeg.position.x=.16;root.add(rLeg);
  const leftArm=new THREE.Mesh(new THREE.CylinderGeometry(.075,.095,.72,10),skin);leftArm.position.set(-.42,1.35,0);leftArm.rotation.z=-.25;root.add(leftArm);
  const rightArm=leftArm.clone();rightArm.position.x=.42;rightArm.rotation.z=.25;root.add(rightArm);
  const leftHand=new THREE.Mesh(new THREE.BoxGeometry(.16,.18,.12),skin);leftHand.position.set(-.42,.96,0);root.add(leftHand);
  const rightHand=leftHand.clone();rightHand.position.x=.42;root.add(rightHand);
  root.userData={body,head,leftArm,rightArm,leftHand,rightHand,label,baseX:0,baseZ:0,phase:0};
  return root;
}
const oh=makePlayer("OH",0x6c7fd0),mb=makePlayer("MB",0x6c7fd0),opp=makePlayer("OPP",0x6c7fd0),setter=makePlayer("S",0xf2cf63),you=makePlayer("YOU",0x58d2a4);
oh.position.set(-3.0,0,-7.2);mb.position.set(0,0,-6.3);opp.position.set(3.0,0,-7.2);setter.position.set(.35,0,-3.7);you.position.set(0,0,3.2);
[oh,mb,opp,setter,you].forEach(p=>{p.userData.baseX=p.position.x;p.userData.baseZ=p.position.z;scene.add(p)});

const ball=new THREE.Mesh(new THREE.SphereGeometry(.18,20,14),new THREE.MeshStandardMaterial({color:0xf8f6df,roughness:.55}));
ball.position.set(.2,2.4,-4.1);ball.castShadow=true;scene.add(ball);

let anim={t:0,phase:"idle",target:"middle",fake:"none",decoy:"none",pass:"A",releaseT:0,commitX:0};

function resize(){
  const rect=canvas.getBoundingClientRect();
  const w=Math.max(1,Math.floor(rect.width)),h=Math.max(1,Math.floor(rect.height));
  if(canvas.width!==w*renderer.getPixelRatio()||canvas.height!==h*renderer.getPixelRatio()){
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  }
}
function lerp(a,b,t){return a+(b-a)*t}
function smooth(t){return t*t*(3-2*t)}
function resetPlayers(){
  for(const p of [oh,mb,opp,setter]){
    p.position.x=p.userData.baseX;p.position.z=p.userData.baseZ;p.position.y=0;p.rotation.set(0,0,0);
    p.userData.head.rotation.set(0,0,0);p.userData.leftArm.rotation.set(0,0,-.25);p.userData.rightArm.rotation.set(0,0,.25);p.userData.leftHand.rotation.set(0,0,0);p.userData.rightHand.rotation.set(0,0,0);
  }
  ball.position.set(.2,2.4,-4.1);
}
function approach(p,dx,dz,k,jump=0){
  const s=smooth(Math.min(1,k));
  p.position.x=p.userData.baseX+dx*s;p.position.z=p.userData.baseZ+dz*s;
  p.position.y=Math.sin(Math.PI*Math.min(1,Math.max(0,(k-.65)/.35)))*jump;
}
function animateScene(dt){
  anim.t+=dt;
  const t=anim.t;
  if(anim.phase==="reading"){
    const cue=Math.min(1,t/1.0);
    const sc=state.scenario||{};
    const jumpP=Math.max(0,Math.min(1,(t-.28)/.62));
    setter.position.y=(sc.jumpSet?0.62:0.12)*Math.sin(Math.PI*jumpP);
    // all attackers show credible movement
    approach(oh,.35,1.45,cue,0);
    approach(mb,anim.target==="middle"?.2:.08,1.8,cue,0);
    approach(opp,-.35,1.45,cue,0);
    // decoy gets stronger and slightly earlier
    if(anim.decoy==="left") approach(oh,.7,2.0,Math.min(1,cue*1.18),.15);
    if(anim.decoy==="middle") approach(mb,.12,2.2,Math.min(1,cue*1.2),.15);
    if(anim.decoy==="right") approach(opp,-.7,2.0,Math.min(1,cue*1.18),.15);

    // setter fake cue: head and shoulder point one way, then neutralize
    const fakeDir=anim.fake==="left"?-.55:anim.fake==="right"?.55:0;
    setter.rotation.y=lerp(fakeDir,0,Math.max(0,(t-.45)/.45));
    setter.userData.head.rotation.y=fakeDir*1.25*(1-Math.min(1,t/.9));
    setter.userData.leftArm.rotation.z=-.25-.55*Math.min(1,t/.75);
    setter.userData.rightArm.rotation.z=.25+.55*Math.min(1,t/.75);
    ball.position.y=2.4+Math.sin(Math.min(1,t/.75)*Math.PI)*.65;
  }
  if(anim.phase==="release"){
    const p=Math.min(1,(t-anim.releaseT)/.46);
    const s=smooth(p);
    let tx=0,tz=-6.0,ty=3.3;
    if(anim.target==="left"){tx=-3.0;tz=-7.0;ty=3.25}
    if(anim.target==="middle"){tx=0;tz=-5.4;ty=3.35}
    if(anim.target==="right"){tx=3.0;tz=-7.0;ty=3.25}
    ball.position.x=lerp(.2,tx,s);ball.position.z=lerp(-4.1,tz,s);ball.position.y=2.45+2.0*Math.sin(Math.PI*p);
    const hitter=anim.target==="left"?oh:anim.target==="middle"?mb:opp;
    approach(hitter,anim.target==="left"?.8:anim.target==="right"?-.8:.15,2.5,1,.7*Math.sin(Math.PI*p));
  }
}
let last=performance.now();
function render(now){
  const dt=Math.min(.033,(now-last)/1000);last=now;resize();animateScene(dt);renderer.render(scene,camera);requestAnimationFrame(render);
}
requestAnimationFrame(render);

function clearTimers(){state.timers.forEach(clearTimeout);state.timers=[]}
function addTimer(fn,ms){const id=setTimeout(fn,ms);state.timers.push(id);return id}
function weightedTarget(pass){
  const r=Math.random();
  if(pass==="A") return r<.35?"middle":r<.675?"left":"right";
  if(pass==="B") return r<.16?"middle":r<.58?"left":"right";
  return r<.5?"left":"right";
}
function createScenario(){
  const pass=Math.random()<.46?"A":Math.random()<.75?"B":"C";
  const target=weightedTarget(pass);
  const fakeEnabled=Math.random()<deceptionChance[deception.value];
  const wrongs=["left","middle","right"].filter(x=>x!==target && !(pass==="C"&&x==="middle"));
  const fake=fakeEnabled?wrongs[Math.floor(Math.random()*wrongs.length)]:"none";
  let decoy="none";
  if(Math.random()<deceptionChance[deception.value]){
    const d=["left","middle","right"].filter(x=>x!==target && !(pass==="C"&&x==="middle"));
    decoy=d[Math.floor(Math.random()*d.length)]||"none";
  }
  const quickRoute=["A","B","C"][Math.floor(Math.random()*3)];
  const sx=pass==="A"?(Math.random()-.5)*.5:(Math.random()-.5)*(pass==="B"?1.0:1.6);
  const ohShift=(Math.random()-.5)*1.0, oppShift=(Math.random()-.5)*1.0, mbShift=(Math.random()-.5)*.8;
  return {pass,target,fake,decoy,quickRoute,sx,ohShift,oppShift,mbShift,jumpSet:pass!=="C"||Math.random()<.45};
}
function updateStats(){
  el("roundStat").textContent=`${state.round} / ${state.total}`;
  el("accuracyStat").textContent=state.round?`${Math.round(state.correct/state.round*100)}%`:"—";
  el("rtStat").textContent=state.rt.length?`${Math.round(state.rt.reduce((a,b)=>a+b,0)/state.rt.length)} ms`:"—";
  el("scoreStat").textContent=state.score;
}
function infoForScenario(sc){
  el("passThreat").textContent=sc.pass==="A"?"3 點威脅":sc.pass==="B"?"快攻降低":"主要兩側";
  el("setterFake").textContent=sc.fake==="none"?"低":"有";
  el("decoyInfo").textContent=sc.decoy==="none"?"無":labels[sc.decoy];
}
function nextRound(){
  clearTimers();
  if(state.round>=state.total){finish();return}
  resetPlayers();anim.t=0;anim.phase="reading";
  state.round++;state.answered=false;state.startTs=0;buttons.forEach(b=>b.disabled=false);
  const sc=createScenario();state.scenario=sc;state.target=sc.target;
  anim.target=sc.target;anim.fake=sc.fake;anim.decoy=sc.decoy;anim.pass=sc.pass;
  el("passLabel").textContent=sc.pass==="A"?"A｜到位":sc.pass==="B"?"B｜稍離網":"C｜離網";
  el("phaseLabel").textContent="Read cues";el("windowLabel").textContent=`${cfgs[difficulty.value].windowMs} ms`;
  el("centerCue").textContent="看相對位置 → 跳舉 → 手腕";
  el("feedback").className="feedback";el("feedback").textContent="相機就是你的眼睛；看 setter 是否跳舉、最後手腕平面，以及 OH / MB / OPP 的相對位置變化。";
  infoForScenario(sc);
  const c=cfgs[difficulty.value];
  addTimer(()=>{
    state.startTs=performance.now();
    el("phaseLabel").textContent="Decision";
    el("centerCue").textContent="現在做第一步判斷";
  },c.cueLead);
  addTimer(()=>{if(!state.answered)submit(null)},c.cueLead+c.windowMs);
}
function submit(choice){
  if(!state.active||state.answered)return;
  state.answered=true;clearTimers();buttons.forEach(b=>b.disabled=true);
  const rt=state.startTs?Math.max(0,Math.round(performance.now()-state.startTs)):0;
  if(rt)state.rt.push(rt);
  const ok=choice===state.target;
  const early=rt>0&&rt<220;
  let gain=0;
  if(ok){
    state.correct++;
    if(early) gain=25;
    else if(rt<=520) gain=100;
    else if(rt<=850) gain=80;
    else gain=60;
    state.score+=gain;
  }
  el("feedback").className=`feedback ${ok?(early?"early":"good"):"bad"}`;
  el("feedback").textContent=ok
    ?(early?`猜對但太早 commit：${labels[state.target]} · ${rt} ms · +${gain}`:`讀對：${labels[state.target]} · ${rt} ms · +${gain}`)
    :`${choice===null?"時間到":"被假線索帶走"}：正解 ${labels[state.target]} ${rt?`· ${rt} ms`:""}`;
  el("phaseLabel").textContent="Release";
  el("centerCue").textContent=state.scenario.fake!=="none"?`Setter 假線索：${labels[state.scenario.fake]}`:"沒有明顯假肩";
  anim.commitX=choice==="left"?-1.0:choice==="right"?1.0:0;
  anim.phase="release";anim.releaseT=anim.t;
  updateStats();
  addTimer(nextRound,1100);
}
function finish(){
  state.active=false;startBtn.textContent="重新開始";buttons.forEach(b=>b.disabled=true);
  const acc=Math.round(state.correct/state.total*100);
  const avg=state.rt.length?Math.round(state.rt.reduce((a,b)=>a+b,0)/state.rt.length):0;
  el("phaseLabel").textContent="Done";el("windowLabel").textContent="—";
  el("feedback").className="feedback good";el("feedback").textContent=`完成：正確率 ${acc}% · 平均反應 ${avg||"—"} ms · Read score ${state.score}`;
  const box=el("sessionResult");box.classList.remove("hidden");
  box.innerHTML=`<strong>Session result</strong><p>Accuracy: ${acc}%<br>Average RT: ${avg||"—"} ms<br>Read score: ${state.score}</p><p>${acc>=80?"下一步可把欺騙強度調高。":"先把 Pass → Setter → Hitter 的讀取順序做穩。"}</p>`;
}
function start(){
  clearTimers();state={active:true,round:0,total:Number(roundCount.value),correct:0,score:0,rt:[],target:null,answered:false,startTs:0,timers:[],scenario:null};
  startBtn.textContent="重置訓練";el("sessionResult").classList.add("hidden");updateStats();nextRound();
}
startBtn.addEventListener("click",start);
buttons.forEach(b=>b.addEventListener("click",()=>submit(b.dataset.choice)));
document.addEventListener("keydown",e=>{
  if(["INPUT","SELECT","TEXTAREA"].includes(document.activeElement?.tagName))return;
  const map={ArrowLeft:"left",ArrowDown:"middle",ArrowRight:"right"};
  if(map[e.key]){e.preventDefault();submit(map[e.key])}
});
buttons.forEach(b=>b.disabled=true);
updateStats();

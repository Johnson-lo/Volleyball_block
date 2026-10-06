import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.167.1/build/three.module.js";

const SETTINGS = {
  read:  { windowMs: 900 },
  match: { windowMs: 650 },
  elite: { windowMs: 450 }
};
const DECEPTION = { low: .20, medium: .48, high: .72 };
const LABELS = { left: "4 號位", middle: "Quick", right: "2 號位" };
const el = id => document.getElementById(id);
const startBtn = el("startBtn");
const difficulty = el("difficulty");
const deception = el("deception");
const roundCount = el("roundCount");
const buttons = [...document.querySelectorAll(".decision-btn")];

let state = {
  active:false, round:0, total:10, correct:0, score:0, rt:[],
  target:null, answered:false, decisionOpen:false, releaseAt:0,
  scenario:null, timers:[]
};

const canvas = el("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07111d);
scene.fog = new THREE.Fog(0x07111d, 17, 38);

const camera = new THREE.PerspectiveCamera(54, 16/9, .1, 100);
const cameraHome = new THREE.Vector3(0, 2.12, 2.30);
camera.position.copy(cameraHome);
camera.lookAt(0, 2.0, -5.3);

scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x16202c, 2.35));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.15);
keyLight.position.set(-4.5, 9, 4);
keyLight.castShadow = true;
scene.add(keyLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(18, 30),
  new THREE.MeshStandardMaterial({ color:0xbb7547, roughness:.9 })
);
floor.rotation.x = -Math.PI/2;
floor.position.z = -4;
floor.receiveShadow = true;
scene.add(floor);

function addLine(x1,z1,x2,z2,opacity=.72){
  const g = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(x1,.012,z1), new THREE.Vector3(x2,.012,z2)
  ]);
  const m = new THREE.LineBasicMaterial({ color:0xffffff, transparent:true, opacity });
  scene.add(new THREE.Line(g,m));
}
[-4.5,4.5].forEach(x => addLine(x,-13,x,5.5));
addLine(-4.5,-13,4.5,-13);
addLine(-4.5,5.5,4.5,5.5);
addLine(-4.5,-3.5,4.5,-3.5,.48);

const net = new THREE.Mesh(
  new THREE.PlaneGeometry(9,2.35,20,5),
  new THREE.MeshStandardMaterial({ color:0xeaf0f7, transparent:true, opacity:.34, wireframe:true })
);
net.position.set(0,1.55,0);
scene.add(net);

const tape = new THREE.Mesh(
  new THREE.BoxGeometry(9,.065,.065),
  new THREE.MeshStandardMaterial({ color:0xffffff })
);
tape.position.set(0,2.72,0);
scene.add(tape);

function limb(radius,length,material){
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius*.88,radius,length,10),
    material
  );
  mesh.castShadow = true;
  return mesh;
}

function makeHuman(color, setterRole=false){
  const root = new THREE.Group();
  const jersey = new THREE.MeshStandardMaterial({ color, roughness:.72 });
  const shorts = new THREE.MeshStandardMaterial({ color:0x202a3b, roughness:.82 });
  const skin = new THREE.MeshStandardMaterial({ color:0xdfb08f, roughness:.9 });
  const shoe = new THREE.MeshStandardMaterial({ color:0x10151f, roughness:.82 });

  const hips = new THREE.Mesh(new THREE.BoxGeometry(.52,.28,.30), shorts);
  hips.position.y = .92;
  root.add(hips);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(.68,.84,.34), jersey);
  torso.position.y = 1.46;
  torso.castShadow = true;
  root.add(torso);

  const neck = limb(.09,.16,skin);
  neck.position.y = 1.97;
  root.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(.235,20,14), skin);
  head.scale.set(.92,1.08,.95);
  head.position.y = 2.17;
  head.castShadow = true;
  root.add(head);

  function makeLeg(side){
    const hip = new THREE.Group();
    hip.position.set(side*.18,.82,0);
    const thigh = limb(.115,.62,skin);
    thigh.position.y = -.31;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -.62;
    hip.add(knee);

    const shin = limb(.095,.58,skin);
    shin.position.y = -.29;
    knee.add(shin);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(.20,.12,.36),shoe);
    foot.position.set(0,-.62,.08);
    foot.castShadow = true;
    knee.add(foot);
    root.add(hip);
    return { hip,knee,thigh,shin,foot };
  }

  function makeArm(side){
    const shoulder = new THREE.Group();
    shoulder.position.set(side*.43,1.76,0);

    const upper = limb(.085,.49,skin);
    upper.position.y = -.245;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -.49;
    shoulder.add(elbow);

    const fore = limb(.072,.46,skin);
    fore.position.y = -.23;
    elbow.add(fore);

    const wrist = new THREE.Group();
    wrist.position.y = -.46;
    elbow.add(wrist);

    const hand = new THREE.Mesh(new THREE.BoxGeometry(.15,.20,.10),skin);
    hand.position.y = -.10;
    hand.castShadow = true;
    wrist.add(hand);

    root.add(shoulder);
    return { shoulder, elbow, wrist, hand };
  }

  const leftLeg = makeLeg(-1), rightLeg = makeLeg(1);
  const leftArm = makeArm(-1), rightArm = makeArm(1);

  root.userData = {
    torso,head,hips,leftLeg,rightLeg,leftArm,rightArm,setterRole,
    base:new THREE.Vector3(), start:new THREE.Vector3(), attack:new THREE.Vector3()
  };
  return root;
}

const oh = makeHuman(0x5e76cf);
const mb = makeHuman(0x5e76cf);
const opp = makeHuman(0x5e76cf);
const setter = makeHuman(0xe0bb4f,true);
scene.add(oh,mb,opp,setter);

const ball = new THREE.Mesh(
  new THREE.SphereGeometry(.18,24,18),
  new THREE.MeshStandardMaterial({ color:0xf7f2dc, roughness:.5 })
);
ball.castShadow = true;
scene.add(ball);

const anim = {
  t:0, phase:"idle", scenario:null, releaseT:0, releaseStarted:false,
  releaseFrom:new THREE.Vector3(), commitX:0
};

function resize(){
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1,Math.floor(rect.width));
  const h = Math.max(1,Math.floor(rect.height));
  const pr = renderer.getPixelRatio();
  if(canvas.width !== Math.floor(w*pr) || canvas.height !== Math.floor(h*pr)){
    renderer.setSize(w,h,false);
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
  }
}

function clamp01(v){ return Math.max(0,Math.min(1,v)); }
function smooth(v){ v=clamp01(v); return v*v*(3-2*v); }
function lerp(a,b,t){ return a+(b-a)*t; }
function rand(a,b){ return a+Math.random()*(b-a); }

function resetPose(p){
  p.position.copy(p.userData.start);
  p.rotation.set(0,0,0);
  p.userData.head.rotation.set(0,0,0);
  [p.userData.leftArm,p.userData.rightArm].forEach((a,i)=>{
    a.shoulder.rotation.set(0,0,i===0?-.16:.16);
    a.elbow.rotation.set(0,0,0);
    a.wrist.rotation.set(0,0,0);
  });
  [p.userData.leftLeg,p.userData.rightLeg].forEach(l=>{
    l.hip.rotation.set(0,0,0);
    l.knee.rotation.set(0,0,0);
  });
}

function setSetterArms(raise,wristDir){
  const L=setter.userData.leftArm, R=setter.userData.rightArm;
  const r=smooth(raise);
  L.shoulder.rotation.z=lerp(-.16,Math.PI-.26,r);
  R.shoulder.rotation.z=lerp(.16,-Math.PI+.26,r);
  L.shoulder.rotation.x=lerp(0,.08,r);
  R.shoulder.rotation.x=lerp(0,.08,r);
  L.elbow.rotation.x=lerp(0,-.18,r);
  R.elbow.rotation.x=lerp(0,-.18,r);
  L.wrist.rotation.y=wristDir*.46*r;
  R.wrist.rotation.y=wristDir*.46*r;
  L.wrist.rotation.z=wristDir*.18*r;
  R.wrist.rotation.z=wristDir*.18*r;
}

function placeFormation(sc){
  oh.userData.start.set(rand(-4.2,-3.2),0,rand(-8.7,-7.0));
  opp.userData.start.set(rand(3.1,4.2),0,rand(-8.7,-7.0));
  mb.userData.start.set(rand(-.65,.65),0,rand(-7.5,-6.1));
  setter.userData.start.set(sc.setterStartX,0,sc.setterStartZ);

  oh.userData.attack.set(rand(-3.65,-2.75),0,rand(-4.85,-4.05));
  opp.userData.attack.set(rand(2.75,3.65),0,rand(-4.85,-4.05));

  const quickOffset = sc.quickRoute==="A" ? rand(-.20,.18)
                    : sc.quickRoute==="B" ? rand(-1.15,-.62)
                    : rand(.55,1.05);
  mb.userData.attack.set(sc.setterX+quickOffset,0,sc.setterZ-.92);

  setter.userData.attack.set(sc.setterX,0,sc.setterZ);

  [oh,mb,opp,setter].forEach(resetPose);

  ball.position.set(sc.passStartX,1.45,-10.5);
  camera.position.copy(cameraHome);
  camera.lookAt(0,2.0,-5.3);
  anim.commitX=0;
}

function runCycle(player,progress){
  const p=clamp01(progress);
  const stride=Math.sin(p*Math.PI*4)*.16*(1-p*.25);
  player.userData.leftArm.shoulder.rotation.x=stride;
  player.userData.rightArm.shoulder.rotation.x=-stride;
  player.userData.leftLeg.hip.rotation.x=-stride*.9;
  player.userData.rightLeg.hip.rotation.x=stride*.9;
}

function approach(player,progress,jumpHeight=.55){
  const p=smooth(progress);
  player.position.x=lerp(player.userData.start.x,player.userData.attack.x,p);
  player.position.z=lerp(player.userData.start.z,player.userData.attack.z,p);
  runCycle(player,p);
  const jp=clamp01((progress-.72)/.28);
  player.position.y=Math.sin(Math.PI*jp)*jumpHeight;
}

function quadraticBezier(a,b,c,t,out){
  const u=1-t;
  out.set(
    u*u*a.x+2*u*t*b.x+t*t*c.x,
    u*u*a.y+2*u*t*b.y+t*t*c.y,
    u*u*a.z+2*u*t*b.z+t*t*c.z
  );
  return out;
}

const tempVec=new THREE.Vector3();

function openDecision(){
  if(!state.active || state.answered || state.decisionOpen) return;
  state.decisionOpen=true;
  state.releaseAt=performance.now();
  buttons.forEach(b=>b.disabled=false);
  el("phaseLabel").textContent="Ball released";
  el("centerCue").textContent="球已離手：現在判斷";
  el("feedback").className="feedback";
  el("feedback").textContent="現在才開始計時。讀球離手後的方向、速度，以及三個攻擊手的相對位置。";

  const sc=state.scenario;
  const base=SETTINGS[difficulty.value].windowMs;
  const limit=sc.target==="middle" ? Math.min(base,520) : base;
  state.timers.push(setTimeout(()=>{ if(!state.answered) submit(null); },limit));
}

function animatePreRelease(sc,t){
  const passP=clamp01(t/.55);
  const setterMove=smooth(clamp01((t-.15)/.42));

  setter.position.x=lerp(sc.setterStartX,sc.setterX,setterMove);
  setter.position.z=lerp(sc.setterStartZ,sc.setterZ,setterMove);

  if(t<.60){
    ball.position.x=lerp(sc.passStartX,setter.position.x,passP);
    ball.position.z=lerp(-10.5,setter.position.z,passP);
    ball.position.y=1.45+Math.sin(Math.PI*passP)*2.25;
  }

  const ohP=clamp01((t-sc.ohOn)/.86);
  const mbP=clamp01((t-sc.mbOn)/.78);
  const opP=clamp01((t-sc.oppOn)/.86);
  approach(oh,ohP,.28);
  approach(mb,mbP,.34);
  approach(opp,opP,.28);

  const fakeDir=sc.fake==="left"?-.55:sc.fake==="right"?.55:0;
  const fakeFade=1-smooth(clamp01((t-.46)/.33));
  setter.rotation.y=fakeDir*fakeFade;
  setter.userData.head.rotation.y=fakeDir*1.1*fakeFade;

  const jumpP=clamp01((t-.36)/.60);
  setter.position.y=(sc.jumpSet?.58:.10)*Math.sin(Math.PI*jumpP);

  const raise=clamp01((t-.28)/.50);
  const wristDir=sc.target==="left"?-.35:sc.target==="right"?.35:0;
  const wristLate=smooth(clamp01((t-.72)/.18));
  setSetterArms(raise,wristDir*wristLate);

  if(t>=.48){
    ball.position.x=setter.position.x;
    ball.position.z=setter.position.z-.04;
    ball.position.y=setter.position.y+2.42;
  }

  if(t>=sc.releaseTime && !anim.releaseStarted){
    anim.releaseStarted=true;
    anim.releaseT=t;
    anim.releaseFrom.copy(ball.position);
    anim.phase="postRelease";
    openDecision();
  }
}

function animatePostRelease(sc,t){
  const elapsed=t-anim.releaseT;
  const flight=sc.target==="middle" ? .38 : .62;
  const p=clamp01(elapsed/flight);

  let target;
  if(sc.target==="left") target=oh.userData.attack;
  else if(sc.target==="right") target=opp.userData.attack;
  else target=mb.userData.attack;

  const end=new THREE.Vector3(target.x,sc.target==="middle"?3.20:3.28,target.z);
  const apex=new THREE.Vector3(
    (anim.releaseFrom.x+end.x)/2,
    Math.max(anim.releaseFrom.y,end.y)+(sc.target==="middle"?.42:1.45),
    (anim.releaseFrom.z+end.z)/2
  );
  quadraticBezier(anim.releaseFrom,apex,end,smooth(p),tempVec);
  ball.position.copy(tempVec);

  const hitter=sc.target==="left"?oh:sc.target==="right"?opp:mb;
  const hitJump=clamp01((p-.45)/.55);
  hitter.position.y=Math.max(hitter.position.y,Math.sin(Math.PI*hitJump)*.72);

  if(state.answered){
    const camP=smooth(clamp01(elapsed/.24));
    camera.position.x=lerp(cameraHome.x,anim.commitX,camP);
    camera.lookAt(anim.commitX*.12,2.05,-5.3);
  }
}

let last=performance.now();
function frame(now){
  const dt=Math.min(.033,(now-last)/1000);
  last=now;
  resize();
  anim.t+=dt;
  if(anim.scenario){
    if(anim.phase==="preRelease") animatePreRelease(anim.scenario,anim.t);
    if(anim.phase==="postRelease") animatePostRelease(anim.scenario,anim.t);
  }
  renderer.render(scene,camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function clearTimers(){
  state.timers.forEach(clearTimeout);
  state.timers=[];
}

function weightedTarget(pass){
  const r=Math.random();
  if(pass==="A") return r<.36?"middle":r<.68?"left":"right";
  if(pass==="B") return r<.18?"middle":r<.59?"left":"right";
  return r<.5?"left":"right";
}

function createScenario(){
  const r=Math.random();
  const pass=r<.46?"A":r<.78?"B":"C";
  const target=weightedTarget(pass);
  const quickRoute=["A","B","C"][Math.floor(Math.random()*3)];
  const setterX=pass==="A"?rand(-.30,.30):pass==="B"?rand(-.65,.65):rand(-1.0,1.0);
  const setterZ=pass==="A"?rand(-3.82,-3.48):pass==="B"?rand(-4.15,-3.60):rand(-4.70,-3.85);
  const wrongs=["left","middle","right"].filter(x=>x!==target && !(pass==="C"&&x==="middle"));
  const fake=Math.random()<DECEPTION[deception.value] && wrongs.length
    ? wrongs[Math.floor(Math.random()*wrongs.length)]
    : "none";

  let ohOn=rand(.18,.34), mbOn=rand(.14,.30), oppOn=rand(.18,.34);
  if(fake==="left") ohOn=Math.max(.08,ohOn-.10);
  if(fake==="middle") mbOn=Math.max(.06,mbOn-.10);
  if(fake==="right") oppOn=Math.max(.08,oppOn-.10);
  if(pass==="A" && target!=="middle") mbOn=Math.min(mbOn,.16);

  return {
    pass,target,quickRoute,fake,
    setterX,setterZ,
    setterStartX:setterX+rand(-.50,.50),
    setterStartZ:setterZ+rand(-.35,.45),
    passStartX:rand(-2.3,2.3),
    jumpSet:pass!=="C"||Math.random()<.42,
    ohOn,mbOn,oppOn,
    releaseTime:1.00
  };
}

function updateStats(){
  el("roundStat").textContent=`${state.round} / ${state.total}`;
  el("accuracyStat").textContent=state.round?`${Math.round(state.correct/state.round*100)}%`:"—";
  el("rtStat").textContent=state.rt.length?`${Math.round(state.rt.reduce((a,b)=>a+b,0)/state.rt.length)} ms`:"—";
  el("scoreStat").textContent=state.score;
}

function nextRound(){
  clearTimers();
  if(state.round>=state.total){ finish(); return; }

  state.round++;
  state.answered=false;
  state.decisionOpen=false;
  state.releaseAt=0;
  buttons.forEach(b=>b.disabled=true);

  const sc=createScenario();
  state.scenario=sc;
  state.target=sc.target;

  anim.scenario=sc;
  anim.t=0;
  anim.phase="preRelease";
  anim.releaseStarted=false;
  placeFormation(sc);

  el("passLabel").textContent=sc.pass==="A"?"A｜到位":sc.pass==="B"?"B｜稍離網":"C｜離網";
  el("phaseLabel").textContent="Before release";
  el("windowLabel").textContent="出手後";
  el("centerCue").textContent="先讀，不作答";
  el("feedback").className="feedback";
  el("feedback").textContent="出手前只看資訊：接發、setter 跳舉、攻擊手助跑與相對位置。球離手後才可以作答。";
  el("passThreat").textContent=sc.pass==="A"?"3 點威脅":sc.pass==="B"?"快攻降低":"主要兩側";
  el("setterFake").textContent=sc.fake==="none"?"無明顯假身體":"可能有假身體";
  el("decoyInfo").textContent="每球位置不同";
  updateStats();
}

function submit(choice){
  if(!state.active || state.answered) return;

  if(!state.decisionOpen){
    el("feedback").className="feedback early";
    el("feedback").textContent="還沒出手。這個版本不接受預猜；等球真正離開 setter 手後再判斷。";
    return;
  }

  state.answered=true;
  clearTimers();
  buttons.forEach(b=>b.disabled=true);

  const rt=Math.max(0,Math.round(performance.now()-state.releaseAt));
  state.rt.push(rt);
  const ok=choice===state.target;

  let gain=0;
  if(ok){
    state.correct++;
    if(rt<=260) gain=100;
    else if(rt<=450) gain=90;
    else if(rt<=650) gain=75;
    else gain=55;
    state.score+=gain;
  }

  anim.commitX=choice==="left"?-1.0:choice==="right"?1.0:0;

  const route=state.target==="middle" ? ` · ${state.scenario.quickRoute} 快` : "";
  el("feedback").className=`feedback ${ok?"good":"bad"}`;
  el("feedback").textContent=ok
    ? `判斷正確：${LABELS[state.target]}${route} · 出手後 ${rt} ms · +${gain}`
    : `${choice===null?"時間到":"判斷錯誤"}：正解 ${LABELS[state.target]}${route} · 出手後 ${rt} ms`;

  el("phaseLabel").textContent="Read complete";
  el("centerCue").textContent="繼續看完整球路";
  updateStats();

  state.timers.push(setTimeout(nextRound,850));
}

function finish(){
  state.active=false;
  startBtn.textContent="重新開始";
  buttons.forEach(b=>b.disabled=true);

  const acc=Math.round(state.correct/state.total*100);
  const avg=state.rt.length?Math.round(state.rt.reduce((a,b)=>a+b,0)/state.rt.length):0;
  el("phaseLabel").textContent="Done";
  el("windowLabel").textContent="—";
  el("feedback").className="feedback good";
  el("feedback").textContent=`完成：正確率 ${acc}% · 出手後平均反應 ${avg||"—"} ms · Read score ${state.score}`;

  const box=el("sessionResult");
  box.classList.remove("hidden");
  box.innerHTML=`<strong>Session result</strong><p>Accuracy: ${acc}%<br>Post-release RT: ${avg||"—"} ms<br>Read score: ${state.score}</p>`;
}

function start(){
  clearTimers();
  state={
    active:true,round:0,total:Number(roundCount.value),correct:0,score:0,rt:[],
    target:null,answered:false,decisionOpen:false,releaseAt:0,scenario:null,timers:[]
  };
  startBtn.textContent="重置訓練";
  el("sessionResult").classList.add("hidden");
  updateStats();
  nextRound();
}

startBtn.addEventListener("click",start);
buttons.forEach(b=>b.addEventListener("click",()=>submit(b.dataset.choice)));
document.addEventListener("keydown",e=>{
  if(["INPUT","SELECT","TEXTAREA"].includes(document.activeElement?.tagName)) return;
  const map={ArrowLeft:"left",ArrowDown:"middle",ArrowRight:"right"};
  if(map[e.key]){
    e.preventDefault();
    submit(map[e.key]);
  }
});

buttons.forEach(b=>b.disabled=true);
updateStats();

const DIFFICULTY = {
  beginner: { windowMs: 1800, revealDelay: 650 },
  intermediate: { windowMs: 1100, revealDelay: 480 },
  advanced: { windowMs: 700, revealDelay: 360 }
};

const labels = { left: "4 號位", middle: "中間快攻", right: "2 號位" };
const passProfiles = [
  {name:"A｜到位", options:["left","middle","right"], weights:[0.31,0.38,0.31], cue:"到位球：快攻仍然存在，不要過早放掉中間。"},
  {name:"B｜稍離網", options:["left","middle","right"], weights:[0.40,0.18,0.42], cue:"稍離網：快攻機率下降，但仍需確認舉球員能否舒服出手。"},
  {name:"C｜離網", options:["left","right"], weights:[0.52,0.48], cue:"離網球：優先讀兩側高球，先建立移動方向。"},
  {name:"過頭球", options:["right","middle"], weights:[0.72,0.28], cue:"過頭接發常讓背後球更自然，但仍要讀舉球員是否真的轉身。"}
];

const el = id => document.getElementById(id);
const startBtn=el("startBtn"), difficulty=el("difficulty"), roundCount=el("roundCount"), feedback=el("feedback");
const buttons=[...document.querySelectorAll(".decision-btn")];
let state = {active:false, round:0, total:10, correct:0, streak:0, rt:[], target:null, answered:false, startedAt:0, timeout:null};

function weightedPick(options, weights){
  let r=Math.random(), acc=0;
  for(let i=0;i<options.length;i++){acc+=weights[i]; if(r<=acc)return options[i];}
  return options[options.length-1];
}
function pickScenario(){
  const pass = passProfiles[Math.floor(Math.random()*passProfiles.length)];
  const target = weightedPick(pass.options, pass.weights);
  return {pass,target};
}
function updateStats(){
  el("roundStat").textContent = `${state.round} / ${state.total}`;
  el("accuracyStat").textContent = state.round ? `${Math.round((state.correct/state.round)*100)}%` : "—";
  const avg = state.rt.length ? Math.round(state.rt.reduce((a,b)=>a+b,0)/state.rt.length) : null;
  el("rtStat").textContent = avg ? `${avg} ms` : "—";
  el("streakStat").textContent = state.streak;
}
function resetVisual(){
  el("oh").style.transform="translate(-50%,-50%)";
  el("mb").style.transform="translate(-50%,-50%)";
  el("opp").style.transform="translate(-50%,-50%)";
  el("setter").style.transform="translate(-50%,-50%)";
  el("you").style.left="50%";
  el("ball").style.left="50%"; el("ball").style.top="37%"; el("ball").style.opacity="1";
  el("setCurve").style.opacity="0";
  el("readyOverlay").classList.add("hidden");
}
function animateClues(target){
  const map={
    left:()=>{el("oh").style.transform="translate(-50%,-50%) scale(1.18)"; el("setter").style.transform="translate(-50%,-50%) rotate(-10deg)";},
    middle:()=>{el("mb").style.transform="translate(-50%,-50%) scale(1.2)"; el("setter").style.transform="translate(-50%,-50%) scale(1.05)";},
    right:()=>{el("opp").style.transform="translate(-50%,-50%) scale(1.18)"; el("setter").style.transform="translate(-50%,-50%) rotate(10deg)";}
  };
  map[target]();
}
function revealSet(target){
  const ball=el("ball");
  if(target==="left"){ball.style.left="16%";ball.style.top="18%";}
  if(target==="middle"){ball.style.left="50%";ball.style.top="15%";}
  if(target==="right"){ball.style.left="84%";ball.style.top="18%";}
}
function nextRound(){
  clearTimeout(state.timeout);
  if(state.round>=state.total){finishSession();return;}
  state.answered=false; state.round++; updateStats(); resetVisual();
  buttons.forEach(b=>b.disabled=false);
  feedback.className="feedback"; feedback.textContent="讀取資訊中…不要先猜。";
  const {pass,target}=pickScenario(); state.target=target;
  el("passQuality").textContent=pass.name;
  el("decisionPrompt").textContent="讀 setter + hitter";
  el("coachTitle").textContent="這球先看 Pass";
  el("coachText").textContent=pass.cue;
  const cfg=DIFFICULTY[difficulty.value];
  el("timerText").textContent=`${cfg.windowMs} ms`;
  setTimeout(()=>{ if(!state.active||state.answered)return; animateClues(target); state.startedAt=performance.now(); feedback.textContent="現在判斷：第一步往哪？"; },cfg.revealDelay);
  state.timeout=setTimeout(()=>{ if(!state.answered)submitChoice(null); },cfg.revealDelay+cfg.windowMs);
}
function submitChoice(choice){
  if(!state.active||state.answered)return;
  state.answered=true; clearTimeout(state.timeout); buttons.forEach(b=>b.disabled=true);
  const rt = state.startedAt ? Math.max(0,Math.round(performance.now()-state.startedAt)) : null;
  if(rt) state.rt.push(rt);
  const ok=choice===state.target;
  if(ok){state.correct++;state.streak++;feedback.className="feedback good";feedback.textContent=`✓ 正確：${labels[state.target]} · ${rt??"—"} ms`;}
  else {state.streak=0;feedback.className="feedback bad";feedback.textContent=`${choice===null?"時間到":"✕ 判斷錯誤"}：正解是 ${labels[state.target]} ${rt?`· ${rt} ms`:""}`;}
  if(state.target==="left")el("you").style.left="24%";
  if(state.target==="middle")el("you").style.left="50%";
  if(state.target==="right")el("you").style.left="76%";
  revealSet(state.target);
  updateStats();
  setTimeout(nextRound,850);
}
function finishSession(){
  state.active=false; startBtn.textContent="重新開始"; buttons.forEach(b=>b.disabled=true);
  el("decisionPrompt").textContent="本回合完成"; el("timerText").textContent="—";
  const acc=Math.round((state.correct/state.total)*100);
  const avg=state.rt.length?Math.round(state.rt.reduce((a,b)=>a+b,0)/state.rt.length):0;
  feedback.className="feedback good";feedback.textContent=`完成：${state.correct}/${state.total}，正確率 ${acc}% ，平均反應 ${avg||"—"} ms。`;
  const box=el("sessionResult");box.classList.remove("hidden");
  box.innerHTML=`<strong>Session result</strong><p>Accuracy: ${acc}%<br>Average RT: ${avg||"—"} ms</p><p>${acc>=80?"下一步：提高難度，逼自己更晚做決定。":"先維持目前速度，優先把讀取順序做穩。"} </p>`;
}
function startSession(){
  clearTimeout(state.timeout);
  state={active:true,round:0,total:Number(roundCount.value),correct:0,streak:0,rt:[],target:null,answered:false,startedAt:0,timeout:null};
  startBtn.textContent="重置訓練"; el("sessionResult").classList.add("hidden"); updateStats(); nextRound();
}
startBtn.addEventListener("click",startSession);
buttons.forEach(b=>b.addEventListener("click",()=>submitChoice(b.dataset.choice)));
document.addEventListener("keydown",e=>{
  if(["INPUT","SELECT","TEXTAREA"].includes(document.activeElement?.tagName))return;
  const map={ArrowLeft:"left",ArrowDown:"middle",ArrowRight:"right"};
  if(map[e.key]){e.preventDefault();submitChoice(map[e.key]);}
});
buttons.forEach(b=>b.disabled=true); updateStats();
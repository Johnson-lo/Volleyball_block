# Volleyball Block — Middle Blocker Reading Lab

瀏覽器版排球中間攔網視覺判斷訓練。

## v0.2 — 3D deception mode

這一版從平面提示式 UI 改成 WebGL / Three.js 的 3D 球場視角。

核心改動：

- 第一人稱 / blocker 視角的 3D 球場
- Setter 頭部、肩膀與身體方向可以是假線索
- 非目標攻擊手也會做誘餌助跑
- 到位球時，中間快攻會持續牽制，即使最後舉到兩側
- 太早 commit 即使猜對也只拿低分
- 正確率之外，另外計算 read score 與 reaction time
- 欺騙強度可調

## 操作

- ←：封 4 號位
- ↓：守 Quick
- →：封 2 號位

支援鍵盤與觸控按鈕。

## 技術

- HTML / CSS / JavaScript
- Three.js (ES module CDN)
- GitHub Pages

## 訓練原則

目標不是看到球飛出去才反應，也不是用固定 cue 猜球；而是把 Pass → Setter → Hitter 的資訊整合成較晚、較可靠的攔網決策。

## Roadmap

- [ ] A / B / C quick 的獨立路線
- [ ] Pipe / back-row threat
- [ ] Setter 前後排與攻擊選項限制
- [ ] 攻擊手 approach timing 個體化
- [ ] Setter dump
- [ ] 雙人攔網 closing / seam 判斷
- [ ] 歷史訓練紀錄與弱點統計

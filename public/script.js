const socket = io();

// ... (カード定義 CARDS は変更なしのため中略) ...

let p1 = { id: 'p1', hp: MAX_HP, mp: 150, hand: [] }, p2 = { id: 'p2', hp: MAX_HP, mp: 150, hand: [] };
let myRole = null, turn = p1, phase = "DRAW", currentAttack = null, isProcessing = false;
let destructionResolver = null;

socket.on('assign-role', (role) => { myRole = role; updateUI(); });
socket.on('start-game', () => {
    p1.hand = []; p2.hand = []; p1.hp = MAX_HP; p2.hp = MAX_HP; p1.mp = 150; p2.mp = 150;
    phase = "DRAW"; turn = p1; isProcessing = false; currentAttack = null;
    if(myRole === 'p1') { for(let i=0; i<7; i++) { socket.emit('request-draw', {playerId: 'p1'}); socket.emit('request-draw', {playerId: 'p2'}); } }
    updateUI(); log("GAME START!");
});

// 同期処理の根幹：ここで確実にフェーズとターンを全クライアントで一致させる
socket.on('sync-action', async (data) => {
    isProcessing = true; // 通信・演出中は入力をロック
    const actor = (data.playerId === 'p1') ? p1 : p2;
    
    if (data.type === 'use') {
        await executeCard(actor, data.idx);
    } else if (data.type === 'skip') {
        await executeSkip(actor);
    } else if (data.type === 'phase-draw') {
        if(turn.id === data.playerId) phase = "MAIN";
    }
    
    isProcessing = false; 
    updateUI(); // 演出完了後、ボタンの表示状態を再計算
});

socket.on('sync-draw', (data) => {
    const p = (data.playerId === 'p1') ? p1 : p2;
    const pool = CARDS[data.card.type];
    let card;
    if(data.card.type==='atk') card = {...pool[Math.floor(data.card.seed * pool.length)], type:'atk'};
    else {
        const total = pool.reduce((s, c) => s + c.weight, 0);
        let rw = data.card.seed * total;
        for (const c of pool) { if (rw < c.weight) { card = {...c, type:data.card.type}; break; } rw -= c.weight; }
    }
    p.hand.push(card); 
    updateUI();
});

async function destroyHand(targetPlayer, count) {
    if (targetPlayer.hand.length === 0) return "対象なし";
    document.getElementById('destroy-popup').style.display = 'block';
    await new Promise(resolve => { destructionResolver = resolve; });

    let destroyed = 0;
    for (let i = 0; i < count; i++) {
        if (targetPlayer.hand.length > 0) {
            const idx = Math.floor(Math.random() * targetPlayer.hand.length);
            const handElement = document.getElementById(`${targetPlayer.id}-hand`);
            if(handElement && handElement.children[idx]) {
                handElement.children[idx].classList.add('tearing');
                await new Promise(r => setTimeout(r, 700));
            }
            targetPlayer.hand.splice(idx, 1);
            destroyed++;
            updateUI();
        }
    }
    return `${destroyed}枚破壊`;
}

function confirmDestruction() {
    document.getElementById('destroy-popup').style.display = 'none';
    if (destructionResolver) { destructionResolver(); destructionResolver = null; }
}

function drawCard(p) { socket.emit('request-draw', { playerId: p.id }); }

function manualDraw() {
    if (turn.id === myRole && phase === "DRAW" && !isProcessing) {
        isProcessing = true;
        drawCard(turn);
        socket.emit('player-action', {type:'phase-draw', playerId:myRole});
    }
}

function updateUI() {
    [p1, p2].forEach(p => {
        document.getElementById(`${p.id}-hp`).innerText = Math.max(0, p.hp);
        document.getElementById(`${p.id}-mp`).innerText = p.mp;
        document.getElementById(`${p.id}-hp-bar`).style.width = `${(p.hp / MAX_HP) * 100}%`;
        document.getElementById(`${p.id}-mp-bar`).style.width = `${(p.mp / MAX_MP) * 100}%`;
    });

    document.getElementById('p1-area').classList.toggle("active", turn.id === 'p1');
    document.getElementById('p2-area').classList.toggle("active", turn.id === 'p2');
    
    const dz1 = document.getElementById('p1-draw-zone'), dz2 = document.getElementById('p2-draw-zone');
    if(dz1) dz1.classList.toggle('highlight', turn.id === 'p1' && phase === "DRAW" && myRole === 'p1');
    if(dz2) dz2.classList.toggle('highlight', turn.id === 'p2' && phase === "DRAW" && myRole === 'p2');

    renderHand('p1-hand', p1); renderHand('p2-hand', p2);
    
    // ボタンの表示ロジックを修正
    const sBtn = document.getElementById('skip-btn');
    if (turn.id === myRole && phase !== "DRAW") { 
        sBtn.style.display = "block"; 
        sBtn.innerText = (phase === "DEFENSE") ? "攻撃を受ける" : "終了"; 
        sBtn.disabled = isProcessing; 
    } else { sBtn.style.display = "none"; }
}

function renderHand(id, p) {
    const el = document.getElementById(id); el.innerHTML = "";
    p.hand.forEach((c, i) => {
        const d = document.createElement('div'); d.className = `card ${c.type}`;
        d.innerHTML = `<b>${c.name}</b><br><small>${c.type==='atk'?'攻':c.type==='def'?'防':'援'}:${c.atk||c.def||'-'} MP:${c.mp}</small>`;
        const canUse = (p.id === myRole && turn.id === myRole && !isProcessing && p.mp >= c.mp && ((phase==="MAIN" && c.type!=="def") || (phase==="DEFENSE" && c.type==="def")));
        if (canUse) { d.onclick = () => { isProcessing = true; socket.emit('player-action', {type:'use', playerId:myRole, idx:i}); }; }
        else { d.style.opacity = "0.3"; d.style.cursor = "default"; }
        d.onmouseover = () => { document.getElementById('card-detail').innerText = `${c.name}: ${c.desc}`; };
        el.appendChild(d);
    });
}

async function executeCard(p, i) {
    const c = p.hand[i], target = (p === p1) ? p2 : p1;
    if(!c) return; p.mp -= c.mp;
    if (phase === "MAIN") {
        if (c.type === "atk") {
            currentAttack = c; p.hand.splice(i, 1);
            phase = "DEFENSE"; turn = target; // ここでターゲットにターンを移動
            log(`${p.id.toUpperCase()}の攻撃: ${c.name}`);
        } else {
            const r = c.effect ? await c.effect(p, target) : ""; 
            log(`${p.id.toUpperCase()}の支援: ${c.name} (${r||""})`);
            p.hand.splice(i, 1); changeTurn();
        }
    } else if (phase === "DEFENSE") {
        let dmg = Math.max(0, (currentAttack.calcAtk?currentAttack.calcAtk(c):currentAttack.atk) - (c.calcDef?c.calcDef(currentAttack):(c.def||0)));
        p.hp -= dmg; log(`${p.id.toUpperCase()}の防御: ${c.name} (${dmg}ダメ)`);
        if (currentAttack.effect) await currentAttack.effect(target, p);
        if (c.effect) await c.effect(p);
        p.hand.splice(i, 1); currentAttack = null; changeTurn();
    }
}

function takeAction() { 
    if (turn.id === myRole && !isProcessing) { 
        socket.emit('player-action', {type:'skip', playerId:myRole}); 
    } 
}

async function executeSkip(p) {
    if (phase === "DEFENSE") {
        const attacker = (p === p1) ? p2 : p1;
        p.hp -= currentAttack.atk; log(`${p.id.toUpperCase()}は受弾: ${currentAttack.atk}ダメ`);
        if (currentAttack.effect) await currentAttack.effect(attacker, p);
        currentAttack = null; changeTurn();
    } else changeTurn();
}

function changeTurn() {
    checkWin();
    turn = (turn.id === 'p1') ? p2 : p1;
    phase = "DRAW";
    log(`--- ${turn.id.toUpperCase()}の番 ---`);
}

function log(msg) {
    const l = document.getElementById('log'); if(l) { const p = document.createElement('p'); p.innerText = `> ${msg}`; l.appendChild(p);
    const c = document.getElementById('log-container'); if(c) c.scrollTop = c.scrollHeight; }
}

function checkWin() {
    const p1L = p1.hp <= 0 || (p1.hand.length === 0 && turn.id === 'p1' && phase === "MAIN");
    const p2L = p2.hp <= 0 || (p2.hand.length === 0 && turn.id === 'p2' && phase === "MAIN");
    if (p1L || p2L) { document.getElementById('overlay').style.display = "flex"; document.getElementById('winner-msg').innerText = (p1L ? "PLAYER B" : "PLAYER A") + " WIN!"; }
}

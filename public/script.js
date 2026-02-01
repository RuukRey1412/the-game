const socket = io();
let currentRoom = null;
let selectedCardIdx = null; // スマホ用：現在選択中のカード番号

const START_HP = 100, MAX_HP = 150, MAX_MP = 250;

const CARDS = {
    atk: [
        { name: "あずなさん", atk: 10, mp: 5, sex: "女", desc: "成功時、MPを15回復", effect: async (u) => { u.mp = Math.min(MAX_MP, u.mp + 15); return "MP15回復"; } },
        { name: "上田さん", atk: 5, mp: 5, sex: "女", desc: "成功時、HPを10回復", effect: async (u) => { u.hp = Math.min(MAX_HP, u.hp + 10); return "HP10回復"; } },
        { name: "まゆさん", atk: 5, mp: 5, sex: "女", desc: "標準攻撃" },
        { name: "てぃあな", atk: 15, mp: 5, sex: "女", desc: "成功時、相手手札1枚破棄", effect: async (u, t) => await destroyHand(t, 1) },
        { name: "岡村桜介", atk: 20, mp: 8, sex: "男", desc: "物理一撃" },
        { name: "太田", atk: 1, mp: 10, sex: "男", desc: "相手防御が「女」なら攻撃力25", calcAtk: (target) => (target && target.sex === "女") ? 25 : 1 },
        { name: "かなた", atk: 10, mp: 8, sex: "男", desc: "防御が「女」なら攻撃力0", calcAtk: (target) => (target && target.sex === "女") ? 0 : 10 },
        { name: "ゆうた", atk: 20, mp: 8, sex: "男", desc: "手札を2枚得る", effect: async (u) => { if(u.id === myRole) { drawCard(u); drawCard(u); } return "手札+2"; } }
    ],
    def: [
        { name: "TOIEC400点", def: 4, mp: 4, weight: 12, sex: "無", desc: "標準防御" },
        { name: "TOIEC500点", def: 5, mp: 5, weight: 12, sex: "無", desc: "手札+1", effect: async (u) => { if(u.id === myRole) drawCard(u); return "手札+1"; } },
        { name: "TOIEC700点", def: 7, mp: 7, weight: 7, sex: "無", desc: "MP10回復 & 手札+1", effect: async (u) => { u.mp = Math.min(MAX_MP, u.mp + 10); if(u.id === myRole) drawCard(u); return "MP10回復&手札+1"; } },
        { name: "高橋先生の経験", def: 100, mp: 30, weight: 3, sex: "女", desc: "絶対防御" },
        { name: "まどかさんのやさしさ", def: 10, mp: 10, weight: 8, sex: "女", desc: "対「かなた」防御力100", calcDef: (atk) => (atk && atk.name === "かなた") ? 100 : 10 },
        { name: "学長ゼミ室", def: 1, mp: 10, weight: 9, sex: "無", desc: "HPを50回復する", effect: async (u) => { u.hp = Math.min(MAX_HP, u.hp + 50); return "HP50回復"; } }
    ],
    sup: [
        { name: "きざしのリーダーシップ", mp: 10, weight: 9.8, desc: "HP20回復, MP10回復, 手札+1", effect: async (u) => { u.hp = Math.min(MAX_HP, u.hp + 20); u.mp = Math.min(MAX_MP, u.mp + 10); if(u.id === myRole) drawCard(u); return "HP20&MP10回復, 手札+1"; } },
        { name: "てつやのリーダーシップ", mp: 8, weight: 9.8, desc: "HP10回復, MP10回復", effect: async (u) => { u.hp = Math.min(MAX_HP, u.hp + 10); u.mp = Math.min(MAX_MP, u.mp + 10); return "HP10&MP10回復"; } },
        { name: "和成のリーダーシップ", mp: 7, weight: 9.8, desc: "HP10回復", effect: async (u) => { u.hp = Math.min(MAX_HP, u.hp + 10); return "HP10回復"; } },
        { name: "そうすけの威厳", mp: 30, weight: 9.8, desc: "相手に20ダメージ", effect: async (u, t) => { t.hp -= 20; return "相手に20ダメージ！"; } },
        { name: "ゆうすけの尊厳", mp: 20, weight: 9.8, desc: "手札2枚得る", effect: async (u) => { if(u.id === myRole) { drawCard(u); drawCard(u); } return "手札+2"; } },
        { name: "りりこさんの知見", mp: 25, weight: 9.8, desc: "手札3枚得る", effect: async (u) => { if(u.id === myRole) { drawCard(u); drawCard(u); } return "手札+3"; } },
        { name: "しおりさんの英語力", mp: 10, weight: 9.8, desc: "相手手札をランダムで1枚破壊", effect: async (u, t) => await destroyHand(t, 1) },
        { name: "せいじの大学院進学", mp: 15, weight: 9.8, desc: "相手手札をランダムで2枚破壊", effect: async (u, t) => await destroyHand(t, 2) },
        { name: "みっちーの簿記", mp: 10, weight: 9.8, desc: "手札2枚得る", effect: async (u) => { if(u.id === myRole) { drawCard(u); drawCard(u); } return "手札+2"; } },
        { name: "かいせの発音", mp: 20, weight: 9.8, desc: "手札3枚得る", effect: async (u) => { if(u.id === myRole) { drawCard(u); drawCard(u); } return "手札+3"; } },
        { name: "盛川美優の妄想", mp: 40, weight: 2.0, desc: "利用必須。使用時敗北。", effect: async (u) => { u.hp = 0; return "敗北"; } }
    ]
};

let p1 = { id: 'p1', hp: START_HP, mp: 150, hand: [] }, p2 = { id: 'p2', hp: START_HP, mp: 150, hand: [] };
let myRole = null, turn = p1, phase = "DRAW", currentAttack = null, isProcessing = false;

function joinRoom() {
    const roomID = document.getElementById('room-input').value;
    if (roomID) { currentRoom = roomID; socket.emit('join-room', roomID); document.getElementById('wait-msg').style.display = "block"; }
}

socket.on('assign-role', (role) => { 
    myRole = role; 
    document.getElementById('my-role-label').innerText = role === 'p1' ? 'PLAYER A' : 'PLAYER B';
    document.getElementById('login-overlay').style.display = "none";
    document.getElementById('main-layout').style.display = "flex";
    updateUI(); 
});

socket.on('start-game', () => {
    p1.hand = []; p2.hand = []; p1.hp = START_HP; p2.hp = START_HP; p1.mp = 150; p2.mp = 150;
    phase = "DRAW"; turn = p1; isProcessing = false; currentAttack = null; selectedCardIdx = null;
    if(myRole === 'p1') { for(let i=0; i<7; i++) { drawCard(p1); drawCard(p2); } }
    updateUI(); log("GAME START!");
});

socket.on('sync-action', async (data) => {
    const actor = data.playerId === 'p1' ? p1 : p2;
    if (data.type === 'use') await executeCard(actor, data.idx);
    else if (data.type === 'skip') await executeSkip(actor);
    else if (data.type === 'phase-draw') { if(phase === "DRAW") phase = "MAIN"; }
    isProcessing = false; selectedCardIdx = null; updateUI();
});

socket.on('sync-draw', (data) => {
    const p = data.playerId === 'p1' ? p1 : p2;
    const pool = CARDS[data.card.type];
    let card;
    const total = pool.reduce((s, c) => s + (c.weight || 1), 0);
    let rw = data.card.seed * total;
    for (const c of pool) { if (rw < (c.weight || 1)) { card = {...c, type:data.card.type}; break; } rw -= (c.weight || 1); }
    p.hand.push(card); updateUI();
});

async function destroyHand(targetPlayer, count) {
    for (let i = 0; i < count; i++) {
        if (targetPlayer.hand.length > 0) {
            const idx = Math.floor(Math.random() * targetPlayer.hand.length);
            targetPlayer.hand.splice(idx, 1);
            updateUI();
        }
    }
    return `手札${count}枚破壊`;
}

function drawCard(p) { socket.emit('request-draw', { playerId: p.id, roomID: currentRoom }); }

function manualDraw() {
    if (turn.id === myRole && phase === "DRAW" && !isProcessing) {
        isProcessing = true; drawCard(turn);
        socket.emit('player-action', {type:'phase-draw', playerId:myRole, roomID: currentRoom});
    }
}

function updateUI() {
    const me = (myRole === 'p1' ? p1 : p2);
    const enemy = (myRole === 'p1' ? p2 : p1);
    const hasMorikawa = me.hand.some(c => c.name === "盛川美優の妄想");
    const canUseMorikawa = hasMorikawa && me.mp >= 40;

    renderPlayer('enemy-view', enemy, false);
    renderPlayer('my-view', me, true, canUseMorikawa && turn.id === myRole && phase === "MAIN");

    // 詳細ボタン制御
    const useBtn = document.getElementById('use-confirm-btn');
    const detail = document.getElementById('card-detail');
    
    if (selectedCardIdx !== null) {
        const c = me.hand[selectedCardIdx];
        detail.innerHTML = `<strong>${c.name}</strong><br>${c.desc || ''}`;
        const canUseType = (phase === "MAIN" && (c.type === "atk" || c.type === "sup")) || (phase === "DEFENSE" && c.type === "def");
        const forced = canUseMorikawa && c.name !== "盛川美優の妄想" && phase === "MAIN";
        
        if (turn.id === myRole && canUseType && me.mp >= c.mp && !forced && !isProcessing) {
            useBtn.style.display = "block";
            useBtn.onclick = () => { isProcessing = true; socket.emit('player-action', {type:'use', playerId:myRole, idx:selectedCardIdx, roomID: currentRoom}); };
        } else { useBtn.style.display = "none"; }
    } else {
        detail.innerHTML = `<p class="placeholder">${turn.id === myRole ? "あなたの番です" : "相手の番です"}</p>`;
        useBtn.style.display = "none";
    }

    const sBtn = document.getElementById('skip-btn');
    if (turn.id === myRole && phase !== "DRAW") { 
        sBtn.style.display = "block"; sBtn.innerText = (phase === "DEFENSE") ? "受ける" : "終了"; 
        sBtn.disabled = isProcessing || (canUseMorikawa && phase === "MAIN");
    } else { sBtn.style.display = "none"; }

    const dZone = document.getElementById('draw-zone');
    if(dZone) dZone.classList.toggle('highlight', turn.id === myRole && phase === "DRAW");
}

function renderPlayer(id, p, isMe, forceMorikawa) {
    const el = document.getElementById(id);
    el.innerHTML = `
        <div class="player-box ${turn.id === p.id ? 'active' : ''}">
            <div class="gauge-label"><span>${p.id.toUpperCase()}</span> <span>HP ${Math.max(0,p.hp)}/150</span></div>
            <div class="gauge-bar"><div class="gauge-fill hp" style="width:${(p.hp/MAX_HP)*100}%"></div></div>
            <div class="gauge-label"><span>MP ${p.mp}/250</span></div>
            <div class="gauge-bar"><div class="gauge-fill mp" style="width:${(p.mp/MAX_MP)*100}%"></div></div>
            <div class="hand-container" id="${p.id}-hand-list"></div>
        </div>
    `;
    const list = document.getElementById(`${p.id}-hand-list`);
    p.hand.forEach((c, i) => {
        const d = document.createElement('div');
        d.className = `card ${!isMe ? 'back' : c.type} ${isMe && selectedCardIdx === i ? 'selected' : ''}`;
        if (isMe) {
            d.innerHTML = `<b>${c.name}</b><span>MP:${c.mp}</span>`;
            if (forceMorikawa && c.name !== "盛川美優の妄想") d.style.opacity = "0.3";
            d.onclick = () => { selectedCardIdx = i; updateUI(); };
        }
        list.appendChild(d);
    });
}

function getDamage(atkC, defC) {
    let a = atkC.calcAtk ? atkC.calcAtk(defC) : atkC.atk;
    let d = defC ? (defC.calcDef ? defC.calcDef(atkC) : (defC.def || 0)) : 0;
    return Math.max(0, a - d);
}

async function executeCard(p, i) {
    const c = p.hand[i], target = (p === p1) ? p2 : p1;
    if(!c) return; p.mp -= c.mp;
    if (phase === "MAIN") {
        if (c.type === "atk") { 
            currentAttack = c; p.hand.splice(i, 1); phase = "DEFENSE"; turn = target;
            log(`${p.id.toUpperCase()}: ${c.name}`);
            if (c.effect) await c.effect(p, target);
        } else if (c.type === "sup") { 
            const r = c.effect ? await c.effect(p, target) : ""; 
            log(`${p.id.toUpperCase()}: ${c.name} ${r}`);
            p.hand.splice(i, 1); startNextPlayerTurn(target);
        }
    } else if (phase === "DEFENSE") {
        let dmg = getDamage(currentAttack, c); p.hp -= dmg;
        log(`${p.id.toUpperCase()}防御: ${c.name} (${dmg}点)`);
        if (c.effect) await c.effect(p);
        p.hand.splice(i, 1); startNextPlayerTurn(p);
    }
    updateUI();
}

async function executeSkip(p) {
    if (phase === "DEFENSE") {
        let dmg = getDamage(currentAttack, null); p.hp -= dmg;
        log(`${p.id.toUpperCase()}被弾: ${dmg}点`);
        startNextPlayerTurn(p);
    } else { startNextPlayerTurn((p === p1) ? p2 : p1); }
}

function startNextPlayerTurn(nextPlayer) {
    if (checkWin()) return;
    currentAttack = null; phase = "DRAW"; turn = nextPlayer;
    log(`--- ${turn.id.toUpperCase()} TURN ---`);
    updateUI();
}

function log(msg) {
    const l = document.getElementById('log');
    const p = document.createElement('p'); p.innerText = `> ${msg}`; l.appendChild(p);
    document.getElementById('log-container').scrollTop = 9999;
}

function checkWin() {
    const p1L = p1.hp <= 0, p2L = p2.hp <= 0;
    if (p1L || p2L) {
        document.getElementById('overlay').style.display = "flex";
        document.getElementById('winner-msg').innerText = (p1L ? "PLAYER B" : "PLAYER A") + " WIN!";
        return true;
    }
    return false;
}

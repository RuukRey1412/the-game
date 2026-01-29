const socket = io();
let currentRoom = null;

const START_HP = 100;
const MAX_HP = 150;
const MAX_MP = 250;

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
        { name: "きざしのリーダーシップ", mp: 10, weight: 1.0, desc: "HP20回復, MP10回復, 手札+1", effect: async (u) => { u.hp = Math.min(MAX_HP, u.hp + 20); u.mp = Math.min(MAX_MP, u.mp + 10); if(u.id === myRole) drawCard(u); return "HP20&MP10回復, 手札+1"; } },
        { name: "てつやのリーダーシップ", mp: 8, weight: 9.9, desc: "HP10回復, MP10回復", effect: async (u) => { u.hp = Math.min(MAX_HP, u.hp + 10); u.mp = Math.min(MAX_MP, u.mp + 10); return "HP10&MP10回復"; } },
        { name: "和成のリーダーシップ", mp: 7, weight: 9.9, desc: "HP10回復", effect: async (u) => { u.hp = Math.min(MAX_HP, u.hp + 10); return "HP10回復"; } },
        { name: "そうすけの威厳", mp: 30, weight: 9.9, desc: "相手に20ダメージ", effect: async (u, t) => { t.hp -= 20; return "相手に20ダメージ！"; } },
        { name: "ゆうすけの尊厳", mp: 20, weight: 9.9, desc: "手札2枚得る", effect: async (u) => { if(u.id === myRole) { drawCard(u); drawCard(u); } return "手札+2"; } },
        { name: "りりこさんの知見", mp: 25, weight: 9.9, desc: "手札3枚得る", effect: async (u) => { if(u.id === myRole) { drawCard(u); drawCard(u); drawCard(u); } return "手札+3"; } },
        { name: "しおりさんの英語力", mp: 10, weight: 9.9, desc: "相手手札をランダムで1枚破壊", effect: async (u, t) => await destroyHand(t, 1) },
        { name: "せいじの大学院進学", mp: 15, weight: 9.9, desc: "相手手札をランダムで2枚破壊", effect: async (u, t) => await destroyHand(t, 2) },
        { name: "みっちーの簿記", mp: 10, weight: 9.9, desc: "手札2枚得る", effect: async (u) => { if(u.id === myRole) { drawCard(u); drawCard(u); } return "手札+2"; } },
        { name: "かいせの発音", mp: 20, weight: 9.9, desc: "手札3枚得る", effect: async (u) => { if(u.id === myRole) { drawCard(u); drawCard(u); drawCard(u); } return "手札+3"; } },
        { name: "盛川美優の妄想", mp: 40, weight: 9.9, desc: "※利用可能な場合、必ず利用しなければならない。使用時、敗北する。", effect: async (u) => { u.hp = 0; return "強制敗北！"; } }
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
    phase = "DRAW"; turn = p1; isProcessing = false; currentAttack = null;
    if(myRole === 'p1') { for(let i=0; i<7; i++) { drawCard(p1); drawCard(p2); } }
    updateUI(); log("GAME START!");
});

socket.on('sync-action', async (data) => {
    const actor = data.playerId === 'p1' ? p1 : p2;
    if (data.type === 'use') await executeCard(actor, data.idx);
    else if (data.type === 'skip') await executeSkip(actor);
    else if (data.type === 'phase-draw') { if(phase === "DRAW") phase = "MAIN"; }
    isProcessing = false; updateUI();
});

socket.on('sync-draw', (data) => {
    const p = data.playerId === 'p1' ? p1 : p2;
    const pool = CARDS[data.card.type];
    let card;
    if(data.card.type==='atk') card = {...pool[Math.floor(data.card.seed * pool.length)], type:'atk'};
    else {
        const total = pool.reduce((s, c) => s + c.weight, 0);
        let rw = data.card.seed * total;
        for (const c of pool) { if (rw < c.weight) { card = {...c, type:data.card.type}; break; } rw -= c.weight; }
    }
    p.hand.push(card); updateUI();
});

async function destroyHand(targetPlayer, count) {
    let destroyedCount = 0;
    for (let i = 0; i < count; i++) {
        if (targetPlayer.hand.length > 0) {
            const idx = Math.floor(Math.random() * targetPlayer.hand.length);
            const handId = `${targetPlayer.id}-hand`;
            const cardElement = document.getElementById(handId)?.children[idx];
            if(cardElement) { cardElement.classList.add('tearing'); await new Promise(r => setTimeout(r, 700)); }
            targetPlayer.hand.splice(idx, 1);
            destroyedCount++; updateUI();
        }
    }
    return destroyedCount > 0 ? `相手手札${destroyedCount}枚破壊` : "破壊失敗";
}

function drawCard(p) { socket.emit('request-draw', { playerId: p.id, roomID: currentRoom }); }

function manualDraw() {
    if (turn.id === myRole && phase === "DRAW" && !isProcessing) {
        isProcessing = true;
        drawCard(turn);
        socket.emit('player-action', {type:'phase-draw', playerId:myRole, roomID: currentRoom});
    }
}

function updateUI() {
    const myPlayer = (myRole === 'p1' ? p1 : p2);
    // 強制カードチェック：手札にあり、かつMP40以上
    const hasMorikawa = myPlayer.hand.some(c => c.name === "盛川美優の妄想");
    const canUseMorikawa = hasMorikawa && myPlayer.mp >= 40;

    [p1, p2].forEach(p => {
        document.getElementById(`${p.id}-hp`).innerText = Math.max(0, p.hp);
        document.getElementById(`${p.id}-mp`).innerText = p.mp;
        document.getElementById(`${p.id}-hp-bar`).style.width = `${Math.max(0, (p.hp / MAX_HP) * 100)}%`;
        document.getElementById(`${p.id}-mp-bar`).style.width = `${(p.mp / MAX_MP) * 100}%`;
    });
    document.getElementById('p1-area').classList.toggle("active", turn === p1);
    document.getElementById('p2-area').classList.toggle("active", turn === p2);
    
    // 自プレイヤーがMP40以上の「盛川」を持っている場合、renderHandにフラグを渡す
    renderHand('p1-hand', p1, canUseMorikawa && turn.id === myRole && phase === "MAIN"); 
    renderHand('p2-hand', p2, canUseMorikawa && turn.id === myRole && phase === "MAIN");
    
    const sBtn = document.getElementById('skip-btn');
    if (turn.id === myRole && phase !== "DRAW") { 
        sBtn.style.display = "block"; 
        sBtn.innerText = (phase === "DEFENSE") ? "攻撃を受ける" : "終了"; 
        // メインフェーズかつ盛川使用可能時はスキップ不可
        sBtn.disabled = isProcessing || (canUseMorikawa && phase === "MAIN");
    } else { sBtn.style.display = "none"; }
}

function renderHand(id, p, forceMorikawa) {
    const el = document.getElementById(id); if(!el) return;
    el.innerHTML = "";
    p.hand.forEach((c, i) => {
        const d = document.createElement('div');
        if (p.id !== myRole) {
            d.className = "card back";
        } else {
            d.className = `card ${c.type}`;
            let spec = c.type === 'atk' ? `攻:${c.atk}` : c.type === 'def' ? `防:${c.def}` : `援`;
            d.innerHTML = `<b>${c.name}</b><br><small>${spec} MP:${c.mp}</small>`;
            
            const isMyTurn = (turn.id === myRole);
            const canUseType = (phase === "MAIN" && (c.type === "atk" || c.type === "sup")) || (phase === "DEFENSE" && c.type === "def");
            
            // 使用可能判定
            let isSelectable = isMyTurn && canUseType && p.mp >= c.mp && !isProcessing;
            
            // 【重要】MP40以上かつメインフェーズなら「盛川」以外を選択不可にする
            if (forceMorikawa && c.name !== "盛川美優の妄想") {
                isSelectable = false;
            }

            if (isSelectable) {
                d.onclick = () => { isProcessing = true; socket.emit('player-action', {type:'use', playerId:myRole, idx:i, roomID: currentRoom}); };
            } else { 
                d.style.opacity = "0.3"; // MP不足または強制行動による封鎖時は半透明
            }
            d.onmouseover = () => { document.getElementById('card-detail').innerText = `${c.name}: ${c.desc}`; };
        }
        el.appendChild(d);
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
            log(`${p.id.toUpperCase()}の攻撃: ${c.name}`);
            if (c.effect) await c.effect(p, target);
        } else if (c.type === "sup") { 
            const r = c.effect ? await c.effect(p, target) : ""; 
            log(`${p.id.toUpperCase()}の支援: ${c.name}${r?' ('+r+')':''}`);
            p.hand.splice(i, 1); startNextPlayerTurn(target);
        }
    } else if (phase === "DEFENSE") {
        let dmg = getDamage(currentAttack, c); p.hp -= dmg;
        log(`${p.id.toUpperCase()}の防御: ${c.name} (${dmg}ダメージ)`);
        if (c.effect) await c.effect(p);
        p.hand.splice(i, 1); startNextPlayerTurn(p);
    }
    updateUI();
}

function takeAction() { if (turn.id === myRole && !isProcessing) { isProcessing = true; socket.emit('player-action', {type:'skip', playerId:myRole, roomID: currentRoom}); } }

async function executeSkip(p) {
    if (phase === "DEFENSE") {
        let dmg = getDamage(currentAttack, null); p.hp -= dmg;
        log(`${p.id.toUpperCase()}は攻撃を受けた (${dmg}ダメージ)`);
        startNextPlayerTurn(p);
    } else { startNextPlayerTurn((p === p1) ? p2 : p1); }
}

function startNextPlayerTurn(nextPlayer) {
    if (checkWin()) return;
    currentAttack = null; phase = "DRAW"; turn = nextPlayer;
    log(`--- ${turn.id.toUpperCase()}のターン (ドロー待ち) ---`);
    updateUI();
}

function log(msg) {
    const l = document.getElementById('log'); if(!l) return;
    const p = document.createElement('p'); p.innerText = `> ${msg}`; l.appendChild(p);
    const c = document.getElementById('log-container'); if(c) c.scrollTop = c.scrollHeight;
}

function checkWin() {
    const p1Lost = p1.hp <= 0; const p2Lost = p2.hp <= 0;
    if (p1Lost || p2Lost) {
        isProcessing = true;
        document.getElementById('overlay').style.display = "flex";
        document.getElementById('winner-msg').innerText = (p1Lost ? "PLAYER B" : "PLAYER A") + " WIN!";
        return true;
    }
    return false;
}

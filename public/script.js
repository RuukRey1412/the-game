const socket = io();

// --- ゲーム設定・定数 ---
const MAX_HP = 200;
const MAX_MP = 250;

// カード定義
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
        { name: "きざしのリーダーシップ", mp: 10, weight: 10, desc: "HP20回復, MP10回復, 手札+1", effect: async (u) => { u.hp = Math.min(MAX_HP, u.hp + 20); u.mp = Math.min(MAX_MP, u.mp + 10); if(u.id === myRole) drawCard(u); return "HP20&MP10回復, 手札+1"; } },
        { name: "そうすけの威厳", mp: 30, weight: 5, desc: "相手に20ダメージ", effect: async (u, t) => { t.hp -= 20; return "相手に20ダメージ！"; } },
        { name: "しおりさんの英語力", mp: 10, weight: 10, desc: "相手手札をランダムで1枚破壊", effect: async (u, t) => await destroyHand(t, 1) }
    ]
};

// --- ゲーム状態管理 ---
let p1 = { id: 'p1', hp: MAX_HP, mp: 150, hand: [] };
let p2 = { id: 'p2', hp: MAX_HP, mp: 150, hand: [] };
let myRole = null;    // 'p1' or 'p2'
let myRoom = null;    // 合言葉
let turn = p1;        // 現在のターンプレイヤー
let phase = "DRAW";   // "DRAW", "MAIN", "DEFENSE"
let currentAttack = null;
let isProcessing = false;
let selectedIdx = null; // スマホでの選択中インデックス

// --- 通信・入室ロジック ---
function uiJoinRoom() {
    const val = document.getElementById('room-input').value;
    if(!val) return;
    myRoom = val;
    socket.emit('join-room', val);
    document.getElementById('entrance-screen').style.display = 'none';
    document.getElementById('waiting-screen').style.display = 'flex';
    document.getElementById('room-display-name').innerText = `合言葉: ${val}`;
}

socket.on('assign-role', (role) => {
    myRole = role;
    document.getElementById('role-tag').innerText = role === 'p1' ? 'YOU: PLAYER A (先攻)' : 'YOU: PLAYER B (後攻)';
});

socket.on('start-game', () => {
    p1.hand = []; p2.hand = []; p1.hp = MAX_HP; p2.hp = MAX_HP; p1.mp = 150; p2.mp = 150;
    phase = "DRAW"; turn = p1; isProcessing = false;
    document.getElementById('waiting-screen').style.display = 'none';
    document.getElementById('mobile-game-layout').style.display = 'flex';
    
    // 初期手札配布
    if(myRole === 'p1') {
        for(let i=0; i<5; i++) {
            drawCard(p1);
            drawCard(p2);
        }
    }
    updateUI();
    log("対戦開始！");
});

socket.on('sync-action', async (data) => {
    isProcessing = true;
    const actor = (data.playerId === 'p1') ? p1 : p2;
    
    if (data.type === 'use') {
        await executeCard(actor, data.idx);
    } else if (data.type === 'skip') {
        await executeSkip(actor);
    } else if (data.type === 'phase-draw') {
        phase = "MAIN";
    }
    
    isProcessing = false;
    updateUI();
});

socket.on('sync-draw', (data) => {
    const p = (data.playerId === 'p1') ? p1 : p2;
    const pool = CARDS[data.card.type];
    let card;
    if(data.card.type === 'atk') {
        card = {...pool[Math.floor(data.card.seed * pool.length)], type:'atk'};
    } else {
        const total = pool.reduce((s, c) => s + (c.weight || 10), 0);
        let rw = data.card.seed * total;
        for (const c of pool) {
            if (rw < (c.weight || 10)) { card = {...c, type:data.card.type}; break; }
            rw -= (c.weight || 10);
        }
    }
    p.hand.push(card);
    updateUI();
});

// --- バトルロジック ---
async function executeCard(p, i) {
    const c = p.hand[i];
    const target = (p === p1) ? p2 : p1;
    if (!c) return;

    p.mp -= c.mp;

    if (phase === "MAIN") {
        if (c.type === "atk") {
            currentAttack = c;
            p.hand.splice(i, 1);
            phase = "DEFENSE";
            turn = target; // 防御側に操作権を移す
            log(`${p.id.toUpperCase()}の攻撃: ${c.name}`);
        } else {
            const r = c.effect ? await c.effect(p, target) : "";
            log(`${p.id.toUpperCase()}の支援: ${c.name} ${r ? '(' + r + ')' : ''}`);
            p.hand.splice(i, 1);
            changeTurn(target);
        }
    } else if (phase === "DEFENSE") {
        const atkVal = currentAttack.calcAtk ? currentAttack.calcAtk(c) : currentAttack.atk;
        const defVal = c.calcDef ? c.calcDef(currentAttack) : (c.def || 0);
        const dmg = Math.max(0, atkVal - defVal);
        
        p.hp -= dmg;
        log(`${p.id.toUpperCase()}の防御: ${c.name} (${dmg}ダメージ)`);
        
        if (currentAttack.effect) await currentAttack.effect(target, p);
        if (c.effect) await c.effect(p);
        
        p.hand.splice(i, 1);
        currentAttack = null;
        changeTurn(p); // 防御した側から次のターン（ドロー）開始
    }
}

async function executeSkip(p) {
    if (phase === "DEFENSE") {
        const attacker = (p === p1) ? p2 : p1;
        const dmg = currentAttack.atk;
        p.hp -= dmg;
        log(`${p.id.toUpperCase()}は攻撃を食らった！ (${dmg}ダメージ)`);
        if (currentAttack.effect) await currentAttack.effect(attacker, p);
        currentAttack = null;
        changeTurn(p);
    } else {
        const target = (p === p1) ? p2 : p1;
        changeTurn(target);
    }
}

function changeTurn(nextPlayer) {
    checkWin();
    turn = nextPlayer;
    phase = "DRAW";
    log(`--- ${turn.id.toUpperCase()}のターン ---`);
}

// --- 手札破壊演出 ---
async function destroyHand(targetPlayer, count) {
    let destroyed = 0;
    for (let i = 0; i < count; i++) {
        if (targetPlayer.hand.length > 0) {
            const idx = Math.floor(Math.random() * targetPlayer.hand.length);
            const handEl = document.getElementById(`${targetPlayer.id}-hand`);
            if (handEl && handEl.children[idx]) {
                handEl.children[idx].classList.add('tearing');
                await new Promise(r => setTimeout(r, 600));
            }
            targetPlayer.hand.splice(idx, 1);
            destroyed++;
            updateUI();
        }
    }
    return `${destroyed}枚破壊`;
}

// --- UI操作・更新 ---
function drawCard(p) {
    socket.emit('request-draw', { playerId: p.id, roomName: myRoom });
}

function manualDraw() {
    if (turn.id === myRole && phase === "DRAW" && !isProcessing) {
        isProcessing = true;
        drawCard(turn);
        socket.emit('player-action', { type: 'phase-draw', playerId: myRole, roomName: myRoom });
    }
}

function takeAction() {
    if (turn.id === myRole && !isProcessing) {
        socket.emit('player-action', { type: 'skip', playerId: myRole, roomName: myRoom });
    }
}

function updateUI() {
    [p1, p2].forEach(p => {
        const hpEl = document.getElementById(`${p.id}-hp`);
        const mpEl = document.getElementById(`${p.id}-mp`);
        if(hpEl) hpEl.innerText = Math.max(0, p.hp);
        if(mpEl) mpEl.innerText = p.mp;
        
        const hpBar = document.getElementById(`${p.id}-hp-bar`);
        const mpBar = document.getElementById(`${p.id}-mp-bar`);
        if(hpBar) hpBar.style.width = `${(p.hp / MAX_HP) * 100}%`;
        if(mpBar) mpBar.style.width = `${(p.mp / MAX_MP) * 100}%`;
    });

    document.getElementById('player-side').classList.toggle('active', turn.id === myRole);
    
    const dz = document.getElementById('p1-draw-zone');
    if(dz) dz.classList.toggle('highlight', turn.id === myRole && phase === "DRAW");

    renderHand('p1-hand', p1);
    renderHand('p2-hand', p2);

    const sBtn = document.getElementById('skip-btn');
    if (turn.id === myRole && phase !== "DRAW") {
        sBtn.style.display = "block";
        sBtn.innerText = (phase === "DEFENSE") ? "攻撃を受ける" : "行動終了";
        sBtn.disabled = isProcessing;
    } else {
        sBtn.style.display = "none";
    }
}

function renderHand(id, p) {
    const el = document.getElementById(id);
    if(!el) return;
    el.innerHTML = "";
    
    p.hand.forEach((c, i) => {
        const d = document.createElement('div');
        const isMyHand = (p.id === myRole);
        d.className = `card ${isMyHand ? c.type : 'back'}`;
        
        // スマホ用：選択中のカードに枠線を出す
        if (isMyHand && selectedIdx === i) d.classList.add('selected');

        if (isMyHand) {
            d.innerHTML = `<b>${c.name}</b><br><small>MP:${c.mp}</small>`;
            
            // スマホ向け1タップ選択・2タップ使用
            d.onclick = () => {
                if (selectedIdx === i) {
                    // 使用
                    if (!isProcessing && turn.id === myRole && p.mp >= c.mp) {
                        const canUsePhase = (phase === "MAIN" && c.type !== "def") || (phase === "DEFENSE" && c.type === "def");
                        if(canUsePhase) {
                            isProcessing = true;
                            socket.emit('player-action', { type: 'use', playerId: myRole, idx: i, roomName: myRoom });
                            selectedIdx = null;
                        }
                    }
                } else {
                    // 選択
                    selectedIdx = i;
                    document.getElementById('card-detail').innerText = `${c.name}: ${c.desc}`;
                    updateUI(); // 枠線更新のため
                }
            };
        }
        el.appendChild(d);
    });
}

function log(msg) {
    const l = document.getElementById('log');
    if(!l) return;
    const p = document.createElement('p');
    p.innerText = `> ${msg}`;
    l.appendChild(p);
    const container = document.getElementById('log-wrap');
    if(container) container.scrollTop = container.scrollHeight;
}

function checkWin() {
    const p1L = p1.hp <= 0;
    const p2L = p2.hp <= 0;
    if (p1L || p2L) {
        document.getElementById('overlay').style.display = "flex";
        document.getElementById('winner-msg').innerText = (p1L ? "PLAYER B" : "PLAYER A") + " WIN!";
        isProcessing = true;
    }
}

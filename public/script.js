const socket = io();

// ===== 定数 =====
const MAX_HP = 200;
const MAX_MP = 250;
const MAX_HAND = 10;

// ===== 状態 =====
let p1 = { id: 'p1', hp: MAX_HP, mp: 150, hand: [] };
let p2 = { id: 'p2', hp: MAX_HP, mp: 150, hand: [] };

let myRole = null;
let turn = p1;
let phase = "DRAW";
let currentAttack = null;
let isProcessing = false;

// ===== カード定義 =====
const CARDS = {
    atk: [
        { name: "あずなさん", atk: 10, mp: 5, type: 'atk', sex: "女", desc: "成功時、MPを15回復", effect: (u) => { u.mp = Math.min(MAX_MP, u.mp + 15); return "MP15回復"; } },
        { name: "上田さん", atk: 5, mp: 5, type: 'atk', sex: "女", desc: "成功時、HPを10回復", effect: (u) => { u.hp = Math.min(MAX_HP, u.hp + 10); return "HP10回復"; } },
        { name: "まゆさん", atk: 5, mp: 5, type: 'atk', sex: "女", desc: "標準攻撃" },
        { name: "てぃあな", atk: 15, mp: 5, type: 'atk', sex: "女", desc: "ヒット時、相手手札1枚破棄", effect: (u, t) => destroyHand(t, 1) },
        { name: "岡村桜介", atk: 20, mp: 8, type: 'atk', sex: "男", desc: "物理一撃" },
        { name: "太田", atk: 1, mp: 10, type: 'atk', sex: "男", desc: "相手防御が「女」なら攻撃力25", calcAtk: (target) => (target && target.sex === "女") ? 25 : 1 },
        { name: "かなた", atk: 10, mp: 8, type: 'atk', sex: "男", desc: "防御が「女」なら攻撃力0", calcAtk: (target) => (target && target.sex === "女") ? 0 : 10 },
        { name: "ゆうた", atk: 20, mp: 8, type: 'atk', sex: "男", desc: "手札を2枚得る", effect: (u) => { drawCard(u); drawCard(u); return "手札+2"; } }
    ],
    def: [
        { name: "TOIEC400点", def: 4, mp: 4, weight: 12, type: 'def', sex: "無", desc: "標準防御" },
        { name: "TOIEC500点", def: 5, mp: 5, weight: 12, type: 'def', sex: "無", desc: "手札+1", effect: (u) => { drawCard(u); return "手札+1"; } },
        { name: "TOIEC600点", def: 6, mp: 6, weight: 8, type: 'def', sex: "無", desc: "手札+2", effect: (u) => { drawCard(u); drawCard(u); return "手札+2"; } },
        { name: "TOIEC700点", def: 7, mp: 7, weight: 7, type: 'def', sex: "無", desc: "MP10回復 & 手札+1", effect: (u) => { u.mp = Math.min(MAX_MP, u.mp + 10); drawCard(u); return "MP10回復&手札+1"; } },
        { name: "TOIEC800点", def: 8, mp: 8, weight: 6, type: 'def', sex: "無", desc: "MP10回復 & 手札+2", effect: (u) => { u.mp = Math.min(MAX_MP, u.mp + 10); drawCard(u); drawCard(u); return "MP10回復&手札+2"; } },
        { name: "大石先生の教鞭", def: 10, mp: 10, weight: 5, type: 'def', sex: "男", desc: "標準防御" },
        { name: "高橋先生の経験", def: 100, mp: 30, weight: 3, type: 'def', sex: "女", desc: "絶対防御" },
        { name: "市原君の実力", def: 7, mp: 5, weight: 11, type: 'def', sex: "男", desc: "対「太田」防御力1", calcDef: (atk) => (atk && atk.name === "太田") ? 1 : 7 },
        { name: "鳥塚君の実力", def: 7, mp: 5, weight: 11, type: 'def', sex: "無", desc: "対「太田」防御力1", calcDef: (atk) => (atk && atk.name === "太田") ? 1 : 7 },
        { name: "まどかさんのやさしさ", def: 10, mp: 10, weight: 8, type: 'def', sex: "女", desc: "対「かなた」防御力100", calcDef: (atk) => (atk && atk.name === "かなた") ? 100 : 10 },
        { name: "ゆいこさん", def: 20, mp: 20, weight: 8, type: 'def', sex: "女", desc: "高防御" },
        { name: "学長ゼミ室", def: 1, mp: 10, weight: 9, type: 'def', sex: "無", desc: "HPを50回復する", effect: (u) => { u.hp = Math.min(MAX_HP, u.hp + 50); return "HP50回復"; } }
    ],
    sup: [
        { name: "きざしのリーダーシップ", mp: 10, weight: 10, type: 'sup', desc: "HP20回復, MP10回復, 手札+1", effect: (u) => { u.hp = Math.min(MAX_HP, u.hp + 20); u.mp = Math.min(MAX_MP, u.mp + 10); drawCard(u); return "回復&ドロー"; } },
        { name: "てつやのリーダーシップ", mp: 8, weight: 15, type: 'sup', desc: "HP10回復, MP10回復", effect: (u) => { u.hp = Math.min(MAX_HP, u.hp + 10); u.mp = Math.min(MAX_MP, u.mp + 10); return "HP&MP回復"; } },
        { name: "和成のリーダーシップ", mp: 7, weight: 15, type: 'sup', desc: "HP10回復", effect: (u) => { u.hp = Math.min(MAX_HP, u.hp + 10); return "HP10回復"; } },
        { name: "そうすけの威厳", mp: 30, weight: 5, type: 'sup', desc: "相手に20ダメージ", effect: (u, t) => { t.hp -= 20; return "相手に20ダメージ！"; } },
        { name: "ゆうすけの尊厳", mp: 20, weight: 10, type: 'sup', desc: "手札2枚得る", effect: (u) => { drawCard(u); drawCard(u); return "手札+2"; } },
        { name: "りりこさんの知見", mp: 25, weight: 10, type: 'sup', desc: "手札3枚得る", effect: (u) => { drawCard(u); drawCard(u); drawCard(u); return "手札+3"; } },
        { name: "しおりさんの英語力", mp: 10, weight: 10, type: 'sup', desc: "相手手札を1枚破壊", effect: (u, t) => destroyHand(t, 1) },
        { name: "せいじの大学院進学", mp: 15, weight: 5, type: 'sup', desc: "相手手札を2枚破壊", effect: (u, t) => destroyHand(t, 2) },
        { name: "みっちーの簿記", mp: 10, weight: 10, type: 'sup', desc: "手札2枚得る", effect: (u) => { drawCard(u); drawCard(u); return "手札+2"; } },
        { name: "かいせの発音", mp: 20, weight: 10, type: 'sup', desc: "手札3枚得る", effect: (u) => { drawCard(u); drawCard(u); drawCard(u); return "手札+3"; } }
    ]
};

// ===== Socket Events =====
socket.on('assign-role', role => {
    myRole = role;
    updateUI();
});

socket.on('start-game', () => {
    [p1, p2].forEach(p => {
        p.hp = MAX_HP;
        p.mp = 150;
        p.hand = [];
    });
    turn = p1;
    phase = "DRAW";
    currentAttack = null;
    isProcessing = false;

    if (myRole === 'p1') {
        for (let i = 0; i < 5; i++) {
            drawCard(p1);
            drawCard(p2);
        }
    }
    log("GAME START!");
    updateUI();
});

socket.on('sync-draw', data => {
    const p = data.playerId === 'p1' ? p1 : p2;
    const pool = CARDS[data.card.type];
    let card;

    if (data.card.type === 'atk') {
        card = { ...pool[Math.floor(data.card.seed * pool.length)] };
    } else {
        const total = pool.reduce((s, c) => s + c.weight, 0);
        let rw = data.card.seed * total;
        for (const c of pool) {
            if (rw < c.weight) {
                card = { ...c };
                break;
            }
            rw -= c.weight;
        }
    }
    p.hand.push(card);
    updateUI();
});

socket.on('sync-action', async data => {
    isProcessing = true;
    const actor = data.playerId === 'p1' ? p1 : p2;

    if (data.type === 'use') await executeCard(actor, data.idx);
    if (data.type === 'skip') await executeSkip(actor);
    if (data.type === 'phase-draw') phase = "MAIN";

    isProcessing = false;
    updateUI();
});

// ===== ゲームロジック =====
function drawCard(p) {
    socket.emit('request-draw', { playerId: p.id });
}

function manualDraw() {
    if (turn.id === myRole && phase === "DRAW" && !isProcessing) {
        drawCard(turn);
        socket.emit('player-action', { type: 'phase-draw', playerId: myRole });
    }
}

async function executeCard(p, idx) {
    const c = p.hand[idx];
    if (!c) return;

    const target = (p === p1) ? p2 : p1;
    p.mp -= c.mp;
    p.hand.splice(idx, 1); // 先に手札から引く

    if (phase === "MAIN") {
        if (c.type === "atk") {
            currentAttack = c;
            phase = "DEFENSE";
            turn = target;
            log(`${p.id.toUpperCase()}の攻撃: ${c.name}`);
        } else {
            if (c.effect) c.effect(p, target);
            changeTurn();
        }
    } else if (phase === "DEFENSE") {
        const atkVal = currentAttack.calcAtk ? currentAttack.calcAtk(c) : currentAttack.atk;
        const defVal = c.calcDef ? c.calcDef(currentAttack) : (c.def || 0);
        const dmg = Math.max(0, atkVal - defVal);
        
        p.hp -= dmg;
        log(`${c.name}で防御！ ${dmg}ダメージ受けた`);

        if (currentAttack.effect) currentAttack.effect(target, p);
        if (c.effect) c.effect(p, target);

        currentAttack = null;
        changeTurn();
    }
}

async function executeSkip(p) {
    if (phase === "DEFENSE") {
        const attacker = (p === p1) ? p2 : p1;
        const atkVal = currentAttack.calcAtk ? currentAttack.calcAtk(p) : currentAttack.atk;
        p.hp -= atkVal;
        log(`防御せず ${atkVal}ダメージ受けた`);
        if (currentAttack.effect) currentAttack.effect(attacker, p);
        currentAttack = null;
    }
    changeTurn();
}

function changeTurn() {
    checkWin();
    turn = (turn.id === 'p1') ? p2 : p1;
    phase = "DRAW";
    log(`--- ${turn.id.toUpperCase()}の番 ---`);
}

function destroyHand(target, count) {
    for (let i = 0; i < count && target.hand.length > 0; i++) {
        const rIdx = Math.floor(Math.random() * target.hand.length);
        target.hand.splice(rIdx, 1);
    }
    log(`${target.id.toUpperCase()}の手札が${count}枚破壊された`);
}

// ===== UI制御 =====
function updateUI() {
    [p1, p2].forEach(p => {
        const hpEl = document.getElementById(`${p.id}-hp`);
        const mpEl = document.getElementById(`${p.id}-mp`);
        if(hpEl) hpEl.innerText = Math.max(0, p.hp);
        if(mpEl) mpEl.innerText = p.mp;
        
        const hpBar = document.getElementById(`${p.id}-hp-bar`);
        const mpBar = document.getElementById(`${p.id}-mp-bar`);
        if(hpBar) hpBar.style.width = `${Math.max(0, (p.hp / MAX_HP) * 100)}%`;
        if(mpBar) mpBar.style.width = `${(p.mp / MAX_MP) * 100}%`;
    });

    document.getElementById('p1-area')?.classList.toggle("active", turn.id === 'p1');
    document.getElementById('p2-area')?.classList.toggle("active", turn.id === 'p2');

    renderHand('p1-hand', p1);
    renderHand('p2-hand', p2);

    const btn = document.getElementById('skip-btn');
    if (btn) {
        if (turn.id === myRole && phase !== "DRAW") {
            btn.style.display = "block";
            btn.innerText = phase === "DEFENSE" ? "攻撃を受ける" : "終了";
            btn.disabled = isProcessing;
        } else {
            btn.style.display = "none";
        }
    }
}

function renderHand(id, p) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = "";

    p.hand.forEach((c, i) => {
        const d = document.createElement('div');
        d.className = `card ${c.type}`;
        d.innerHTML = `<b>${c.name}</b><br><small>MP:${c.mp}</small>`;

        const isMyTurn = (turn.id === myRole && p.id === myRole && !isProcessing);
        const canUse = isMyTurn && (
            (phase === "MAIN" && c.type !== "def") ||
            (phase === "DEFENSE" && c.type === "def")
        );

        if (canUse && p.mp >= c.mp) {
            d.onclick = () => socket.emit('player-action', { type: 'use', playerId: myRole, idx: i });
        } else {
            d.style.opacity = "0.4";
            d.style.cursor = "default";
        }
        el.appendChild(d);
    });
}

function log(msg) {
    const l = document.getElementById('log');
    if (!l) return;
    const p = document.createElement('p');
    p.innerText = `> ${msg}`;
    l.appendChild(p);
    l.scrollTop = l.scrollHeight;
}

function checkWin() {
    if (p1.hp <= 0 || p2.hp <= 0) {
        const overlay = document.getElementById('overlay');
        const msg = document.getElementById('winner-msg');
        if(overlay) overlay.style.display = "flex";
        if(msg) msg.innerText = p1.hp <= 0 ? "PLAYER B WIN!" : "PLAYER A WIN!";
    }
}

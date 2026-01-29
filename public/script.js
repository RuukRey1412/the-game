const socket = io();

const CARDS = {
    atk: [
        { name: "あずなさん", atk: 10, mp: 5, sex: "女", desc: "成功時、MPを15回復", effect: (u) => { u.mp = Math.min(200, u.mp + 15); return "MP15回復"; } },
        { name: "上田さん", atk: 5, mp: 5, sex: "女", desc: "成功時、HPを10回復", effect: (u) => { u.hp = Math.min(200, u.hp + 10); return "HP10回復"; } },
        { name: "まゆさん", atk: 5, mp: 5, sex: "女", desc: "標準攻撃" },
        { name: "てぃあな", atk: 15, mp: 5, sex: "女", desc: "相手手札1枚破棄", effect: (u, t) => { if(t.hand.length > 0) { t.hand.splice(Math.floor(Math.random()*t.hand.length),1); return "相手手札1枚破棄"; } return ""; } },
        { name: "岡村桜介", atk: 20, mp: 8, sex: "男", desc: "物理一撃" },
        { name: "太田", atk: 1, mp: 10, sex: "男", desc: "相手防御が「女」なら攻撃力25", calcAtk: (target) => (target && target.sex === "女") ? 25 : 1 },
        { name: "かなた", atk: 10, mp: 8, sex: "男", desc: "防御が「女」なら攻撃力0", calcAtk: (target) => (target && target.sex === "女") ? 0 : 10 },
        { name: "ゆうた", atk: 20, mp: 8, sex: "男", desc: "手札を2枚得る", effect: (u) => { drawCard(u); drawCard(u); return "手札+2"; } }
    ],
    def: [
        { name: "TOIEC400点", def: 4, mp: 4, weight: 12, sex: "無", desc: "標準防御" },
        { name: "TOIEC500点", def: 5, mp: 5, weight: 12, sex: "無", desc: "手札+1", effect: (u) => { drawCard(u); return "手札+1"; } },
        { name: "TOIEC600点", def: 6, mp: 6, weight: 8, sex: "無", desc: "手札+2", effect: (u) => { drawCard(u); drawCard(u); return "手札+2"; } },
        { name: "TOIEC700点", def: 7, mp: 7, weight: 7, sex: "無", desc: "MP10回復 & 手札+1", effect: (u) => { u.mp = Math.min(200, u.mp + 10); drawCard(u); return "MP10回復&手札+1"; } },
        { name: "TOIEC800点", def: 8, mp: 8, weight: 6, sex: "無", desc: "MP10回復 & 手札+2", effect: (u) => { u.mp = Math.min(200, u.mp + 10); drawCard(u); drawCard(u); return "MP10回復&手札+2"; } },
        { name: "大石先生の教鞭", def: 10, mp: 10, weight: 5, sex: "男", desc: "標準防御" },
        { name: "高橋先生の経験", def: 100, mp: 30, weight: 3, sex: "女", desc: "絶対防御" },
        { name: "市原君の実力", def: 7, mp: 5, weight: 11, sex: "男", desc: "対「太田」防御力1", calcDef: (atk) => (atk && atk.name === "太田") ? 1 : 7 },
        { name: "鳥塚君の実力", def: 7, mp: 5, weight: 11, sex: "無", desc: "対「太田」防御力1", calcDef: (atk) => (atk && atk.name === "太田") ? 1 : 7 },
        { name: "まどかさんのやさしさ", def: 10, mp: 10, weight: 8, sex: "女", desc: "対「かなた」防御力100", calcDef: (atk) => (atk && atk.name === "かなた") ? 100 : 10 },
        { name: "ゆいこさん", def: 20, mp: 20, weight: 8, sex: "女", desc: "高防御" },
        { name: "学長ゼミ室", def: 1, mp: 10, weight: 9, sex: "無", desc: "HPを50回復する", effect: (u) => { u.hp = Math.min(200, u.hp + 50); return "HP50回復"; } }
    ],
    sup: [
        { name: "きざしのリーダーシップ", mp: 10, weight: 10, desc: "HP20回復, MP10回復, 手札+1", effect: (u) => { u.hp = Math.min(200, u.hp + 20); u.mp = Math.min(200, u.mp + 10); drawCard(u); return "HP20&MP10回復, 手札+1"; } },
        { name: "てつやのリーダーシップ", mp: 8, weight: 15, desc: "HP10回復, MP10回復", effect: (u) => { u.hp = Math.min(200, u.hp + 10); u.mp = Math.min(200, u.mp + 10); return "HP10&MP10回復"; } },
        { name: "和成のリーダーシップ", mp: 7, weight: 15, desc: "HP10回復", effect: (u) => { u.hp = Math.min(200, u.hp + 10); return "HP10回復"; } },
        { name: "そうすけの威厳", mp: 30, weight: 5, desc: "相手に20ダメージ", effect: (u, t) => { t.hp -= 20; return "相手に20ダメージ！"; } },
        { name: "ゆうすけの尊厳", mp: 20, weight: 10, desc: "手札2枚得る", effect: (u) => { drawCard(u); drawCard(u); return "手札+2"; } },
        { name: "りりこさんの知見", mp: 25, weight: 10, desc: "手札3枚得る", effect: (u) => { drawCard(u); drawCard(u); drawCard(u); return "手札+3"; } },
        { name: "しおりさんの英語力", mp: 10, weight: 10, desc: "相手手札をランダムで1枚破壊", effect: (u, t) => { if(t.hand.length>0) { t.hand.splice(Math.floor(Math.random()*t.hand.length),1); return "相手カード1枚破壊"; } return ""; } },
        { name: "せいじの大学院進学", mp: 15, weight: 5, desc: "相手手札をランダムで2枚破壊", effect: (u, t) => { let c=0; for(let i=0;i<2;i++) if(t.hand.length>0){t.hand.splice(Math.floor(Math.random()*t.hand.length),1); c++;} return `相手手札${c}枚破壊`; } },
        { name: "みっちーの簿記", mp: 10, weight: 10, desc: "手札2枚得る", effect: (u) => { drawCard(u); drawCard(u); return "手札+2"; } },
        { name: "かいせの発音", mp: 20, weight: 10, desc: "手札3枚得る", effect: (u) => { drawCard(u); drawCard(u); drawCard(u); return "手札+3"; } }
    ]
};

let p1 = { id: 'p1', hp: 200, mp: 150, hand: [] }, p2 = { id: 'p2', hp: 200, mp: 150, hand: [] };
let myRole = null, turn = p1, phase = "MAIN", currentAttack = null, isProcessing = false;

socket.on('assign-role', (role) => { myRole = role; updateUI(); });
socket.on('start-game', () => {
    p1.hand = []; p2.hand = []; p1.hp = 200; p2.hp = 200; p1.mp = 150; p2.mp = 150;
    phase = "MAIN"; turn = p1; isProcessing = false; currentAttack = null;
    if(myRole === 'p1') { for(let i=0; i<7; i++) { socket.emit('request-draw', {playerId: 'p1'}); socket.emit('request-draw', {playerId: 'p2'}); } }
    updateUI(); log("GAME START!");
});

socket.on('sync-action', (data) => {
    const actor = data.playerId === 'p1' ? p1 : p2;
    // サーバーから届いたアクションを実行
    if (data.type === 'use') executeCard(actor, data.idx);
    else if (data.type === 'skip') executeSkip(actor);
    isProcessing = false; updateUI();
});

socket.on('sync-draw', (data) => {
    const p = data.playerId === 'p1' ? p1 : p2;
    const pool = CARDS[data.card.type];
    let card;
    if(data.card.type==='atk') { card = {...pool[Math.floor(data.card.seed * pool.length)], type:'atk'}; }
    else {
        const total = pool.reduce((s, c) => s + c.weight, 0);
        let rw = data.card.seed * total;
        for (const c of pool) { if (rw < c.weight) { card = {...c, type:data.card.type}; break; } rw -= c.weight; }
    }
    p.hand.push(card); updateUI();
});

function drawCard(p) { socket.emit('request-draw', { playerId: p.id }); }

function updateUI() {
    [p1, p2].forEach(p => {
        document.getElementById(`${p.id}-hp`).innerText = Math.max(0, p.hp);
        document.getElementById(`${p.id}-mp`).innerText = p.mp;
        document.getElementById(`${p.id}-hp-bar`).style.width = `${(p.hp / 200) * 100}%`;
        document.getElementById(`${p.id}-mp-bar`).style.width = `${(p.mp / 200) * 100}%`;
    });
    document.getElementById('p1-area').classList.toggle("active", turn === p1);
    document.getElementById('p2-area').classList.toggle("active", turn === p2);
    renderHand('p1-hand', p1); renderHand('p2-hand', p2);
    const sBtn = document.getElementById('skip-btn');
    if (turn.id === myRole) { sBtn.style.display = "block"; sBtn.innerText = (phase === "DEFENSE") ? "攻撃を受ける" : "終了"; sBtn.disabled = isProcessing; }
    else { sBtn.style.display = "none"; }
}

function renderHand(id, p) {
    const el = document.getElementById(id); el.innerHTML = "";
    p.hand.forEach((c, i) => {
        const d = document.createElement('div'); d.className = `card ${c.type}`;
        let spec = c.type === 'atk' ? `攻:${c.atk}` : c.type === 'def' ? `防:${c.def}` : `援`;
        d.innerHTML = `<b>${c.name}</b><br><small>${spec} MP:${c.mp}</small>`;
        const isMyTurn = (turn.id === myRole);
        const canUse = (phase === "MAIN" && (c.type === "atk" || c.type === "sup")) || (phase === "DEFENSE" && c.type === "def");
        if (p.id === myRole && isMyTurn && canUse && p.mp >= c.mp && !isProcessing) {
            d.onclick = () => { isProcessing = true; socket.emit('player-action', {type:'use', playerId:myRole, idx:i}); };
        } else { d.style.opacity = "0.3"; }
        d.onmouseover = () => { document.getElementById('card-detail').innerText = `${c.name}: ${c.desc}`; };
        el.appendChild(d);
    });
}

function executeCard(p, i) {
    const c = p.hand[i], target = (p === p1) ? p2 : p1;
    if(!c) return; // 安全策
    p.mp -= c.mp;
    if (phase === "MAIN") {
        if (c.type === "atk") {
            currentAttack = c; // 攻撃情報を保存
            p.hand.splice(i, 1);
            phase = "DEFENSE"; // フェーズを防御に
            turn = target; // ターンを相手に
            log(`${p.id.toUpperCase()}の攻撃: ${c.name}`);
        } else {
            if(c.effect) { const r = c.effect(p, target); log(`${p.id.toUpperCase()}の支援: ${c.name} (${r||""})`); }
            p.hand.splice(i, 1);
            checkWin(); changeTurn();
        }
    } else if (phase === "DEFENSE") {
        // 防御成功時のダメージ計算
        let a = currentAttack ? (currentAttack.calcAtk ? currentAttack.calcAtk(c) : currentAttack.atk) : 0;
        let d = c.calcDef ? c.calcDef(currentAttack) : (c.def || 0);
        let dmg = Math.max(0, a - d);
        p.hp -= dmg;
        log(`${p.id.toUpperCase()}の防御: ${c.name} (${dmg}ダメージ)`);
        if (c.effect) c.effect(p);
        p.hand.splice(i, 1);
        phase = "MAIN"; // メインフェーズに戻す
        currentAttack = null;
        checkWin();
        // ターンは防御した側のまま（自分のターンとして続行）
        drawCard(p);
    }
}

function takeAction() { if (turn.id === myRole && !isProcessing) { isProcessing = true; socket.emit('player-action', {type:'skip', playerId:myRole}); } }

function executeSkip(p) {
    if (phase === "DEFENSE") {
        let dmg = currentAttack ? currentAttack.atk : 0;
        p.hp -= dmg;
        log(`${p.id.toUpperCase()}は防御せず ${dmg} ダメージ受けた`);
        phase = "MAIN";
        currentAttack = null;
        checkWin();
        drawCard(p);
    } else {
        changeTurn();
    }
}

function changeTurn() {
    turn = (turn === p1) ? p2 : p1;
    phase = "MAIN";
    drawCard(turn);
    log(`--- ${turn.id.toUpperCase()}のターン ---`);
}

function log(msg) {
    const l = document.getElementById('log');
    if(l) {
        const p = document.createElement('p'); p.innerText = `> ${msg}`;
        l.appendChild(p);
        const c = document.getElementById('log-container');
        if(c) c.scrollTop = c.scrollHeight;
    }
}

function checkWin() {
    if (p1.hp <= 0 || p2.hp <= 0) {
        document.getElementById('overlay').style.display = "flex";
        document.getElementById('winner-msg').innerText = (p1.hp <= 0 ? "PLAYER B" : "PLAYER A") + " WIN!";
    }
}

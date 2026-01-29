const socket = io();

const CARDS = {
    atk: [
        { name: "あずなさん", atk: 10, mp: 5, sex: "女", desc: "成功時、MPを15回復", effect: (u) => { u.mp = Math.min(100, u.mp + 15); return "MP15回復"; } },
        { name: "上田さん", atk: 5, mp: 5, sex: "女", desc: "成功時、HPを10回復", effect: (u) => { u.hp = Math.min(999, u.hp + 10); return "HP10回復"; } },
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
        { name: "TOIEC700点", def: 7, mp: 7, weight: 7, sex: "無", desc: "MP10回復 & 手札+1", effect: (u) => { u.mp = Math.min(100, u.mp + 10); drawCard(u); return "MP10回復&手札+1"; } },
        { name: "TOIEC800点", def: 8, mp: 8, weight: 6, sex: "無", desc: "MP10回復 & 手札+2", effect: (u) => { u.mp = Math.min(100, u.mp + 10); drawCard(u); drawCard(u); return "MP10回復&手札+2"; } },
        { name: "大石先生の教鞭", def: 10, mp: 10, weight: 5, sex: "男", desc: "標準防御" },
        { name: "高橋先生の経験", def: 100, mp: 30, weight: 3, sex: "女", desc: "絶対防御" },
        { name: "市原君の実力", def: 7, mp: 5, weight: 11, sex: "男", desc: "対「太田」防御力1", calcDef: (atk) => (atk && atk.name === "太田") ? 1 : 7 },
        { name: "鳥塚君の実力", def: 7, mp: 5, weight: 11, sex: "無", desc: "対「太田」防御力1", calcDef: (atk) => (atk && atk.name === "太田") ? 1 : 7 },
        { name: "まどかさんのやさしさ", def: 10, mp: 10, weight: 8, sex: "女", desc: "対「かなた」防御力100", calcDef: (atk) => (atk && atk.name === "かなた") ? 100 : 10 },
        { name: "ゆいこさん", def: 20, mp: 20, weight: 8, sex: "女", desc: "高防御" },
        { name: "学長ゼミ室", def: 1, mp: 10, weight: 9, sex: "無", desc: "HPを50回復する", effect: (u) => { u.hp = Math.min(999, u.hp + 50); return "HP50回復"; } }
    ],
    sup: [
        { name: "きざしのリーダーシップ", mp: 10, weight: 10, desc: "HP20回復, MP10回復, 手札+1", effect: (u) => { u.hp = Math.min(999, u.hp + 20); u.mp = Math.min(100, u.mp + 10); drawCard(u); return "HP20&MP10回復, 手札+1"; } },
        { name: "てつやのリーダーシップ", mp: 8, weight: 15, desc: "HP10回復, MP10回復", effect: (u) => { u.hp = Math.min(999, u.hp + 10); u.mp = Math.min(100, u.mp + 10); return "HP10&MP10回復"; } },
        { name: "和成のリーダーシップ", mp: 7, weight: 15, desc: "HP10回復", effect: (u) => { u.hp = Math.min(999, u.hp + 10); return "HP10回復"; } },
        { name: "そうすけの威厳", mp: 30, weight: 5, desc: "相手に20ダメージ", effect: (u, t) => { t.hp -= 20; return "相手に20ダメージ！"; } },
        { name: "ゆうすけの尊厳", mp: 20, weight: 10, desc: "手札2枚得る", effect: (u) => { drawCard(u); drawCard(u); return "手札+2"; } },
        { name: "りりこさんの知見", mp: 25, weight: 10, desc: "手札3枚得る", effect: (u) => { drawCard(u); drawCard(u); drawCard(u); return "手札+3"; } },
        { name: "しおりさんの英語力", mp: 10, weight: 10, desc: "相手手札をランダムで1枚破壊", effect: (u, t) => { if(t.hand.length>0) { t.hand.splice(Math.floor(Math.random()*t.hand.length),1); return "相手カード1枚破壊"; } return ""; } },
        { name: "せいじの大学院進学", mp: 15, weight: 5, desc: "相手手札をランダムで2枚破壊", effect: (u, t) => { let c=0; for(let i=0;i<2;i++) if(t.hand.length>0){t.hand.splice(Math.floor(Math.random()*t.hand.length),1); c++;} return `相手手札${c}枚破壊`; } },
        { name: "みっちーの簿記", mp: 10, weight: 10, desc: "手札2枚得る", effect: (u) => { drawCard(u); drawCard(u); return "手札+2"; } },
        { name: "かいせの発音", mp: 20, weight: 10, desc: "手札3枚得る", effect: (u) => { drawCard(u); drawCard(u); drawCard(u); return "手札+3"; } }
    ]
};

let p1 = { id: 'p1', hp: 100, mp: 50, hand: [] }, p2 = { id: 'p2', hp: 100, mp: 50, hand: [] };
let myRole = null, turn = p1, phase = "MAIN", currentAttack = null;
let isProcessing = false;

socket.on('assign-role', (role) => { myRole = role; log(`あなたは ${role==='p1'?'PLAYER A':'PLAYER B'} です`, "#f1c40f"); });

socket.on('start-game', () => {
    p1.hand = []; p2.hand = []; p1.hp = 100; p2.hp = 100; p1.mp = 50; p2.mp = 50;
    if(myRole === 'p1') {
        for(let i=0; i<7; i++) {
            socket.emit('request-draw', {playerId: 'p1'});
            socket.emit('request-draw', {playerId: 'p2'});
        }
    }
    updateUI(); log("GAME START!");
});

socket.on('sync-action', (data) => {
    // 同期が届いたら自分の処理中フラグを解除
    isProcessing = false; 
    const actor = data.playerId === 'p1' ? p1 : p2;
    if (data.type === 'use') executeCard(actor, data.idx);
    else if (data.type === 'skip') executeSkip(actor);
    updateUI();
});

socket.on('sync-draw', (data) => {
    const p = data.playerId === 'p1' ? p1 : p2;
    const pool = CARDS[data.card.type];
    let card;
    if(data.card.type==='atk') {
        card = {...pool[Math.floor(data.card.seed * pool.length)], type:'atk'};
    } else {
        const total = pool.reduce((s, c) => s + c.weight, 0);
        let rw = data.card.seed * total;
        for (const c of pool) { if (rw < c.weight) { card = {...c, type:data.card.type}; break; } rw -= c.weight; }
    }
    p.hand.push(card);
    updateUI();
});

function drawCard(p) { if (p.id === myRole) socket.emit('request-draw', { playerId: myRole }); }

function updateUI() {
    [p1, p2].forEach(p => {
        document.getElementById(`${p.id}-hp`).innerText = Math.max(0, p.hp);
        document.getElementById(`${p.id}-mp`).innerText = p.mp;
        document.getElementById(`${p.id}-hp-bar`).style.width = `${Math.min(100, (p.hp / 200) * 100)}%`;
        document.getElementById(`${p.id}-mp-bar`).style.width = `${(p.mp / 100) * 100}%`;
    });
    document.getElementById('p1-area').classList.toggle("active", turn === p1);
    document.getElementById('p2-area').classList.toggle("active", turn === p2);
    renderHand('p1-hand', p1); renderHand('p2-hand', p2);
    const sBtn = document.getElementById('skip-btn');
    
    // 自分のターンの時のみボタンを表示
    if (turn.id === myRole) {
        sBtn.style.display = "block";
        sBtn.innerText = (phase === "DEFENSE") ? "攻撃を受ける" : "終了";
        // 処理中はボタンを無効化
        sBtn.disabled = isProcessing;
        sBtn.style.opacity = isProcessing ? "0.5" : "1";
    } else {
        sBtn.style.display = "none";
    }
}

function renderHand(id, p) {
    const el = document.getElementById(id); el.innerHTML = "";
    p.hand.forEach((c, i) => {
        const d = document.createElement('div'); d.className = `card ${c.type}`;
        let spec = c.type === 'atk' ? `攻:${c.atk}` : c.type === 'def' ? `防:${c.def}` : `援`;
        d.innerHTML = `<b>${c.name}</b><small>${spec} MP:${c.mp}</small>`;
        
        // カードが使える条件
        const isMyTurn = (turn.id === myRole);
        const hasMP = (p.mp >= c.mp);
        const correctPhase = (phase === "MAIN" && (c.type === "atk" || c.type === "sup")) || (phase === "DEFENSE" && c.type === "def");
        
        if (p.id === myRole && isMyTurn && hasMP && correctPhase && !isProcessing) {
            d.onclick = () => {
                isProcessing = true; // 通信開始
                socket.emit('player-action', {type:'use', playerId:myRole, idx:i});
                updateUI(); // 即座にUIを更新してボタン等を無効化
            };
        } else {
            d.style.opacity = "0.3";
            d.style.cursor = "default";
        }
        
        d.onmouseover = () => { document.getElementById('card-detail').innerHTML = `<span class="detail-name">${c.name}</span><div class="detail-effect">${c.desc}<br>性別:${c.sex}</div>`; };
        el.appendChild(d);
    });
}

function executeCard(p, i) {
    const c = p.hand[i], target = (p === p1) ? p2 : p1, name = p.id.toUpperCase();
    p.mp -= c.mp;
    if (phase === "MAIN") {
        if (c.type === "atk") {
            currentAttack = c; p.hand.splice(i, 1); phase = "DEFENSE"; turn = target;
            log(`${name} の攻撃: ${c.name}`, "#ff4757");
        } else {
            const res = c.effect(p, target); p.hand.splice(i, 1);
            log(`${name} の支援: ${c.name}`, "#9b59b6");
            if(res) log(` └ 効果: ${res}`, "#aaa");
            checkWin(); changeTurn();
        }
    } else {
        let finalAtk = currentAttack.calcAtk ? currentAttack.calcAtk(c) : currentAttack.atk;
        let finalDef = c.calcDef ? c.calcDef(currentAttack) : c.def;
        let dmg = Math.max(0, finalAtk - finalDef);
        p.hp -= dmg;
        log(`${name} の防御: ${c.name}`, "#2ecc71");
        log(` └ ${dmg} ダメージを受けた！`, "#ee5253");
        if (c.effect) log(` └ 効果: ${c.effect(p)}`, "#aaa");
        p.hand.splice(i, 1); phase = "MAIN"; currentAttack = null; checkWin(); drawCard(turn);
    }
}

function takeAction() { 
    if (turn.id === myRole && !isProcessing) {
        isProcessing = true;
        socket.emit('player-action', {type:'skip', playerId:myRole});
        updateUI();
    }
}

function executeSkip(p) {
    if (phase === "DEFENSE") {
        p.hp -= currentAttack.atk; log(`${p.id.toUpperCase()} は ${currentAttack.atk}ダメ受けた`, "#ff4757");
        phase = "MAIN"; currentAttack = null; checkWin(); drawCard(turn);
    } else changeTurn();
}

function changeTurn() { 
    turn = (turn === p1) ? p2 : p1; 
    phase = "MAIN"; 
    drawCard(turn); 
    log(`--- ${turn.id.toUpperCase()}のターン ---`, "#f1c40f"); 
}

function log(msg, color = "#fff") {
    const logArea = document.querySelector('.log-section #log');
    const container = document.getElementById('log-container');
    if(logArea) {
        const p = document.createElement('p'); p.style.color = color; p.innerHTML = `> ${msg}`;
        logArea.appendChild(p); if(container) container.scrollTop = container.scrollHeight;
    }
}

function checkWin() {
    if (p1.hp <= 0 || p2.hp <= 0) {
        document.getElementById('overlay').style.display = "flex";
        document.getElementById('winner-msg').innerText = (p1.hp <= 0 ? "PLAYER B" : "PLAYER A") + " WIN!";
    }
}

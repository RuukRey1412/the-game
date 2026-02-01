const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

// ルームごとのロール管理
let rooms = {}; 

io.on('connection', (socket) => {
    console.log('Connected:', socket.id);

    // 合言葉（roomID）による入室処理
    socket.on('join-room', (roomID) => {
        if (!roomID) return;

        if (!rooms[roomID]) rooms[roomID] = {};
        
        const roomPlayers = rooms[roomID];
        const playerCount = Object.keys(roomPlayers).length;

        if (playerCount < 2) {
            // ロールの割り当て
            const role = playerCount === 0 ? 'p1' : 'p2';
            roomPlayers[socket.id] = role;
            
            socket.join(roomID);
            socket.emit('assign-role', role);
            
            console.log(`User [${socket.id}] joined room [${roomID}] as ${role}`);

            // 2人揃ったら開始
            if (Object.keys(roomPlayers).length === 2) {
                io.to(roomID).emit('start-game');
            }
        } else {
            socket.emit('error-msg', 'この部屋は満員です。');
        }
    });

    // アクションの同期
    socket.on('player-action', (data) => {
        // クライアント側から送られる roomID を使用
        const roomID = data.roomID;
        if (roomID) {
            // 自分以外（相手）に同期。スマホ横向きでは即時性が重要なため broadcast を使用
            socket.to(roomID).emit('sync-action', data);
        }
    });

    // ドローリクエスト
    socket.on('request-draw', (data) => {
        const roomID = data.roomID;
        if (roomID) {
            const r = Math.random() * 100;
            // 提供割合: 攻撃40%, 防御30%, サポート30%
            let type = (r < 40) ? "atk" : (r < 70) ? "def" : "sup";
            
            // 部屋の全員にドロー結果を送信（不正防止のためサーバー側で乱数を生成）
            io.to(roomID).emit('sync-draw', { 
                playerId: data.playerId, 
                card: { type: type, seed: Math.random() } 
            });
        }
    });

    // 切断時のクリーンアップ
    socket.on('disconnecting', () => {
        for (const roomID of socket.rooms) {
            if (rooms[roomID] && rooms[roomID][socket.id]) {
                delete rooms[roomID][socket.id];
                console.log(`User [${socket.id}] left [${roomID}]`);
                
                if (Object.keys(rooms[roomID]).length === 0) {
                    delete rooms[roomID];
                } else {
                    socket.to(roomID).emit('log-msg', '相手が切断しました。');
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running: http://localhost:${PORT}`);
});

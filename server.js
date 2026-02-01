const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

// ルームごとのロール管理（再接続や満員判定用）
let rooms = {}; 

io.on('connection', (socket) => {
    console.log('Connected:', socket.id);

    // 合言葉による入室処理
    socket.on('join-room', (roomName) => {
        if (!roomName) return;

        if (!rooms[roomName]) rooms[roomName] = {};
        
        const roomPlayers = rooms[roomName];
        const playerCount = Object.keys(roomPlayers).length;

        if (playerCount < 2) {
            // ロールの割り当て
            const role = playerCount === 0 ? 'p1' : 'p2';
            roomPlayers[socket.id] = role;
            
            socket.join(roomName);
            socket.emit('assign-role', role);
            
            console.log(`User [${socket.id}] joined room [${roomName}] as ${role}`);

            // 2人揃ったら開始
            if (Object.keys(roomPlayers).length === 2) {
                io.to(roomName).emit('start-game');
            }
        } else {
            socket.emit('error-msg', 'この部屋は満員です。');
        }
    });

    // アクションの同期
    // JS側から送られてくる roomName プロパティでフィルタリング
    socket.on('player-action', (data) => {
        if (data.roomName) {
            // 送信者以外（相手）にのみ送信
            socket.to(data.roomName).emit('sync-action', data);
        }
    });

    // ドローリクエスト
    socket.on('request-draw', (data) => {
        if (data.roomName) {
            const r = Math.random() * 100;
            // 提供割合: 攻撃40%, 防御30%, サポート30%
            let type = (r < 40) ? "atk" : (r < 70) ? "def" : "sup";
            
            // 部屋の全員（自分と相手）にカード情報を送る
            io.to(data.roomName).emit('sync-draw', { 
                playerId: data.playerId, 
                card: { type: type, seed: Math.random() } 
            });
        }
    });

    // 切断時のクリーンアップ
    socket.on('disconnecting', () => {
        // socket.roomsには自分のID以外に所属ルームが含まれている
        for (const roomName of socket.rooms) {
            if (rooms[roomName] && rooms[roomName][socket.id]) {
                delete rooms[roomName][socket.id];
                console.log(`User [${socket.id}] left [${roomName}]`);
                
                // 部屋が空なら削除
                if (Object.keys(rooms[roomName]).length === 0) {
                    delete rooms[roomName];
                } else {
                    // 相手が残っているなら通知
                    socket.to(roomName).emit('log-msg', '相手が切断しました。');
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running: http://localhost:${PORT}`);
});

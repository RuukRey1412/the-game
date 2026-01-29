const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

// 部屋ごとのプレイヤー情報を管理
// 構造: { "ルームID": { socketId1: "p1", socketId2: "p2" } }
let rooms = {}; 

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // 合言葉（Room ID）による入室処理
    socket.on('join-room', (roomID) => {
        // 部屋がなければ作成
        if (!rooms[roomID]) {
            rooms[roomID] = {};
        }

        const roomPlayers = rooms[roomID];
        const playerCount = Object.keys(roomPlayers).length;

        if (playerCount < 2) {
            // ロールの割り当て
            const role = playerCount === 0 ? 'p1' : 'p2';
            roomPlayers[socket.id] = role;
            
            // Socket.ioのRoom機能に参加
            socket.join(roomID);
            
            // 本人にロールを通知
            socket.emit('assign-role', role);
            console.log(`User ${socket.id} joined room [${roomID}] as ${role}`);

            // 2人揃ったらその部屋の全員にゲーム開始を通知
            if (Object.keys(roomPlayers).length === 2) {
                io.to(roomID).emit('start-game');
            }
        } else {
            // 満員の場合は通知して切断（またはエラーを返す）
            socket.emit('error-msg', 'この部屋は満員です。');
            console.log(`Room [${roomID}] is full. Rejecting ${socket.id}`);
        }
    });

    // プレイヤーのアクションをその部屋の全員に同期
    socket.on('player-action', (data) => {
        if (data.roomID) {
            io.to(data.roomID).emit('sync-action', data);
        }
    });

    // ドローリクエスト
    socket.on('request-draw', (data) => {
        if (data.roomID) {
            const r = Math.random() * 100;
            // 提供割合: 攻撃40%, 防御30%, サポート30%
            let type = (r < 40) ? "atk" : (r < 70) ? "def" : "sup";
            
            io.to(data.roomID).emit('sync-draw', { 
                playerId: data.playerId, 
                card: { type: type, seed: Math.random() } 
            });
        }
    });

    // 切断時の処理
    socket.on('disconnect', () => {
        // すべての部屋を回って切断したユーザーを探して削除
        for (const roomID in rooms) {
            if (rooms[roomID][socket.id]) {
                const role = rooms[roomID][socket.id];
                delete rooms[roomID][socket.id];
                console.log(`User ${socket.id} (${role}) left room [${roomID}]`);
                
                // 部屋が空になったら削除
                if (Object.keys(rooms[roomID]).length === 0) {
                    delete rooms[roomID];
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running: http://localhost:${PORT}`);
});

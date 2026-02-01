const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

// ルーム情報を管理するオブジェクト
let rooms = {}; 

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // --- 1. ルーム入室処理 ---
    socket.on('join-room', (roomID) => {
        if (!roomID) return;

        // ルームがなければ作成
        if (!rooms[roomID]) {
            rooms[roomID] = {
                players: {} // socket.id -> role ('p1' or 'p2')
            };
        }

        const room = rooms[roomID];
        const playerCount = Object.keys(room.players).length;

        if (playerCount < 2) {
            // ロール割り当て（空いている方を割り振る）
            const assignedRoles = Object.values(room.players);
            const role = assignedRoles.includes('p1') ? 'p2' : 'p1';
            
            room.players[socket.id] = role;
            socket.join(roomID);
            
            console.log(`Socket ${socket.id} joined room ${roomID} as ${role}`);
            socket.emit('assign-role', role);
            
            // 2人揃ったらゲーム開始
            if (Object.keys(room.players).length === 2) {
                io.to(roomID).emit('start-game');
            }
        } else { 
            socket.emit('error-msg', 'このルームは満員です'); 
        }
    });

    // --- 2. カード使用・スキップの同期 ---
    socket.on('player-action', (data) => {
        if (data.roomID) {
            // 自分を含むルーム全員にアクションを通知
            io.to(data.roomID).emit('sync-action', data);
        }
    });

    // --- 3. ドロー処理（サーバーサイドでカード種別を確定） ---
    socket.on('request-draw', (data) => {
        if (data.roomID) {
            // 抽選ロジック：ATK 40%, DEF 30%, SUP 30%
            const r = Math.random() * 100;
            const type = (r < 40) ? "atk" : (r < 70) ? "def" : "sup";
            
            // 全員に「誰がどの種別を引いたか」を通知
            // seed値を送ることで、全クライアントで同じカードが選ばれるようにする
            io.to(data.roomID).emit('sync-draw', { 
                playerId: data.playerId, 
                card: { 
                    type: type, 
                    seed: Math.random() 
                } 
            });
        }
    });

    // --- 4. 切断時の処理 ---
    socket.on('disconnecting', () => {
        // 所属しているすべてのルームを確認
        socket.rooms.forEach(roomID => {
            if (rooms[roomID] && rooms[roomID].players[socket.id]) {
                const role = rooms[roomID].players[socket.id];
                delete rooms[roomID].players[socket.id];
                
                console.log(`User ${socket.id} (${role}) left room ${roomID}`);

                // 相手が残っている場合は通知（必要に応じてフロントで「相手が切断しました」と表示可能）
                socket.to(roomID).emit('opponent-disconnected', { role: role });

                // ルームが空になったら削除
                if (Object.keys(rooms[roomID].players).length === 0) {
                    delete rooms[roomID];
                }
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => { 
    console.log(`Server running on port ${PORT}`); 
});

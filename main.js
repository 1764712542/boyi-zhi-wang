/* main.js — Electron 主进程 · 博弈之王 v3.0
   含：WebSocket 服务器 + UDP 房间广播 + 房间密码 + 端口自动释放 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const WebSocket = require('ws');
const dgram = require('dgram');
const os = require('os');
const { execSync } = require('child_process');

let mainWindow = null;
let wsServer = null;
let hostClient = null; // 主机自己的 WebSocket 连接
const PORT = 8081;
const DISCOVERY_PORT = 8082; // UDP 发现端口

/* 杀死占用指定端口的进程（跨平台） */
function killPortOccupier(port){
  try{
    if(process.platform==='win32'){
      // Windows: netstat + taskkill
      try{
        const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {encoding:'utf8'});
        const pids = new Set();
        out.split('\n').forEach(line=>{
          const parts = line.trim().split(/\s+/);
          if(parts.length>=5) pids.add(parts[parts.length-1]);
        });
        pids.forEach(pid=>{ try{ execSync(`taskkill /F /PID ${pid}`); }catch(e){} });
      }catch(e){}
    } else {
      // macOS / Linux: lsof + kill
      try{
        const out = execSync(`lsof -ti:${port}`, {encoding:'utf8'});
        out.split('\n').filter(Boolean).forEach(pid=>{
          try{ execSync(`kill -9 ${pid}`); }catch(e){}
        });
      }catch(e){}
    }
  }catch(e){}
}

let roomPassword = ''; // 房间密码（空 = 无密码）
let roomName = '博弈之王房间'; // 房间名称
let udpSocket = null; // UDP 广播 socket
let udpListener = null; // UDP 监听 socket（客户端用）
let discoveryTimer = null;
let foundRooms = []; // 客户端发现的房间列表

/* 获取本机局域网 IP */
function getLocalIP(){
  const ifaces = os.networkInterfaces();
  for(const name of Object.keys(ifaces)){
    for(const iface of ifaces[name]){
      if(iface.family==='IPv4' && !iface.internal){
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

/* 获取本机所在子网（用于客户端扫描） */
function getSubnetBase(){
  const ip = getLocalIP();
  const parts = ip.split('.');
  if(parts.length===4) return parts.slice(0,3).join('.')+'.';
  return '192.168.1.';
}

/* 创建 WebSocket 服务器（主机模式） + UDP 广播 */
function createWsServer(password, name){
  return new Promise((resolve, reject)=>{
    if(wsServer){
      resolve({ ip:getLocalIP(), port:PORT });
      return;
    }
    roomPassword = password || '';
    roomName = name || '博弈之王房间';
    // 先杀死占用端口的进程，再创建服务器
    killPortOccupier(PORT);
    killPortOccupier(DISCOVERY_PORT);
    wsServer = new WebSocket.Server({ port:PORT }, ()=>{
      // 启动 UDP 房间广播
      startRoomBroadcast();
      resolve({ ip:getLocalIP(), port:PORT, hasPassword: !!roomPassword });
    });
    wsServer.on('connection', (ws, req)=>{
      // 密码校验：客户端首条消息必须是 {type:'auth', password:'...'}
      let authenticated = !roomPassword; // 无密码则直接通过
      ws.on('message', (data)=>{
        let msg;
        try{ msg = JSON.parse(data.toString()); }catch(e){ return; }
        // 鉴权阶段
        if(!authenticated){
          if(msg.type==='auth'){
            if(msg.password===roomPassword){
              authenticated = true;
              ws.send(JSON.stringify({ type:'auth-ok' }));
              // 通知主机有客户端加入
              if(mainWindow && !mainWindow.isDestroyed()){
                mainWindow.webContents.send('net:client-join');
              }
            } else {
              ws.send(JSON.stringify({ type:'auth-fail', reason:'密码错误' }));
              ws.close();
            }
          } else {
            ws.send(JSON.stringify({ type:'auth-fail', reason:'需要密码' }));
            ws.close();
          }
          return;
        }
        // 已鉴权：转发给除发送者外的所有连接
        wsServer.clients.forEach((client)=>{
          if(client!==ws && client.readyState===WebSocket.OPEN){
            client.send(data.toString());
          }
        });
      });
      ws.on('close', ()=>{
        if(authenticated && mainWindow && !mainWindow.isDestroyed()){
          mainWindow.webContents.send('net:client-leave');
        }
      });
    });
    wsServer.on('error', (err)=>{
      if(err.code==='EADDRINUSE'){
        // 端口被占用，强杀后重试一次
        killPortOccupier(PORT);
        setTimeout(()=>{
          try{ wsServer.close(); }catch(e){}
          wsServer = new WebSocket.Server({ port:PORT }, ()=>{
            startRoomBroadcast();
            resolve({ ip:getLocalIP(), port:PORT, hasPassword: !!roomPassword });
          });
          wsServer.on('error', (e)=>reject(e));
        }, 500);
      } else {
        reject(err);
      }
    });
  });
}

/* UDP 房间广播（主机端） */
function startRoomBroadcast(){
  stopRoomBroadcast();
  udpSocket = dgram.createSocket({ type:'udp4', reuseAddr:true });
  const announce = JSON.stringify({
    type:'room',
    ip:getLocalIP(),
    port:PORT,
    name:roomName,
    hasPassword:!!roomPassword
  });
  discoveryTimer = setInterval(()=>{
    if(udpSocket){
      udpSocket.send(announce, DISCOVERY_PORT, '255.255.255.255', (err)=>{
        if(err){ /* 忽略广播错误 */ }
      });
    }
  }, 1500);
}

function stopRoomBroadcast(){
  if(discoveryTimer){ clearInterval(discoveryTimer); discoveryTimer=null; }
  if(udpSocket){ try{ udpSocket.close(); }catch(e){} udpSocket=null; }
}

/* UDP 房间监听（客户端端） */
function startDiscovery(){
  return new Promise((resolve)=>{
    stopDiscovery();
    foundRooms = [];
    udpListener = dgram.createSocket({ type:'udp4', reuseAddr:true });
    udpListener.on('message', (buf)=>{
      try{
        const msg = JSON.parse(buf.toString());
        if(msg.type==='room'){
          // 去重
          const exists = foundRooms.find(r=>r.ip===msg.ip);
          if(!exists){
            foundRooms.push({ ip:msg.ip, port:msg.port, name:msg.name, hasPassword:msg.hasPassword });
            if(mainWindow && !mainWindow.isDestroyed()){
              mainWindow.webContents.send('net:room-found', { rooms: foundRooms.slice() });
            }
          }
        }
      }catch(e){}
    });
    udpListener.on('error', ()=>{});
    udpListener.bind(DISCOVERY_PORT, ()=>{
      udpListener.setBroadcast(true);
      resolve({ ok:true });
    });
  });
}

function stopDiscovery(){
  if(udpListener){ try{ udpListener.close(); }catch(e){} udpListener=null; }
  foundRooms = [];
}

function closeWsServer(){
  stopRoomBroadcast();
  if(wsServer){
    // 关闭所有连接
    wsServer.clients.forEach((client)=>{
      if(client.readyState===WebSocket.OPEN) client.close();
    });
    wsServer.close();
    wsServer = null;
  }
  roomPassword = '';
}

function createWindow(){
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1100,
    minHeight: 720,
    title: '博弈之王 · 避其锋芒',
    backgroundColor: '#f0e6d2',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.on('closed', ()=>{
    mainWindow = null;
    closeWsServer();
    stopDiscovery();
  });
}

/* ===== IPC 处理 ===== */
ipcMain.handle('net:create-host', async (event, opts={})=>{
  try{
    const info = await createWsServer(opts.password||'', opts.name||'');
    return info;
  }catch(err){
    return { error: err.message };
  }
});

ipcMain.handle('net:close-host', async ()=>{
  closeWsServer();
  return { ok:true };
});

/* 客户端：开始搜索房间 */
ipcMain.handle('net:start-discovery', async ()=>{
  try{
    await startDiscovery();
    return { ok:true };
  }catch(err){
    return { error: err.message };
  }
});

/* 客户端：停止搜索 */
ipcMain.handle('net:stop-discovery', async ()=>{
  stopDiscovery();
  return { ok:true };
});

/* 客户端：获取当前发现的房间列表 */
ipcMain.handle('net:get-rooms', async ()=>{
  return { rooms: foundRooms.slice() };
});

ipcMain.handle('app:version', ()=>{
  return app.getVersion();
});

/* 应用生命周期 */
app.whenReady().then(()=>{
  createWindow();
  app.on('activate', ()=>{
    if(BrowserWindow.getAllWindows().length===0) createWindow();
  });
});

app.on('window-all-closed', ()=>{
  closeWsServer();
  stopDiscovery();
  if(process.platform!=='darwin') app.quit();
});

app.on('before-quit', ()=>{
  closeWsServer();
  stopDiscovery();
});

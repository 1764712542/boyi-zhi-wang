/* preload.js — 暴露局域网联机 API 给渲染进程 v2.0
   含：房间密码 + UDP 房间搜索 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('netAPI', {
  /* 创建主机：启动 WebSocket 服务器 + UDP 广播
     opts: { password?:string, name?:string } → 返回 {ip, port, hasPassword} */
  createHost: (opts) => ipcRenderer.invoke('net:create-host', opts||{}),
  /* 关闭主机服务器 */
  closeHost: () => ipcRenderer.invoke('net:close-host'),
  /* 监听客户端加入/离开事件 */
  onClientJoin: (cb) => ipcRenderer.on('net:client-join', () => cb()),
  onClientLeave: (cb) => ipcRenderer.on('net:client-leave', () => cb()),
  /* 客户端：开始 UDP 搜索房间 */
  startDiscovery: () => ipcRenderer.invoke('net:start-discovery'),
  /* 客户端：停止搜索 */
  stopDiscovery: () => ipcRenderer.invoke('net:stop-discovery'),
  /* 客户端：监听发现的新房间 */
  onRoomFound: (cb) => ipcRenderer.on('net:room-found', (e, data) => cb(data)),
  /* 客户端：获取已发现的房间列表 */
  getRooms: () => ipcRenderer.invoke('net:get-rooms'),
  /* 应用版本号 */
  getVersion: () => ipcRenderer.invoke('app:version')
});

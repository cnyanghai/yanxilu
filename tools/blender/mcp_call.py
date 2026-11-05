# 往研习录专用的 Blender 窗口（blender-mcp 插件，端口默认 9877）发命令。和三维版的 9876 那扇窗口分开，免得两个会话撞同一个场景。
# 用法：python3 tools/blender/mcp_call.py exec <a.py> [b.py ...]   把脚本拼成一段在窗口里执行
#       python3 tools/blender/mcp_call.py shot <Windows 路径.png>   截视口
#       python3 tools/blender/mcp_call.py info                       场景概况
# 端口：环境变量 BLENDER_MCP_PORT，或 --port 9877
# 开窗口：powershell.exe Start-Process 'D:\齐河OnLine\tools\blender\blender.exe' -ArgumentList '--python','C:\Users\cnyan\blender_mcp\yanxilu\start_mcp_9877.py'
import socket, json, sys, os

args = sys.argv[1:]
port = int(os.environ.get("BLENDER_MCP_PORT", "9877"))
if "--port" in args:
    i = args.index("--port"); port = int(args[i + 1]); del args[i:i + 2]

def call(t, params, timeout=int(os.environ.get("BLENDER_MCP_TIMEOUT", "900"))):
    s = socket.create_connection(("127.0.0.1", port), timeout=timeout)
    s.sendall(json.dumps({"type": t, "params": params}).encode()); buf = b""
    while True:
        c = s.recv(1 << 20)
        if not c: break
        buf += c
        try: return json.loads(buf)
        except json.JSONDecodeError: pass
    return json.loads(buf)

cmd = args[0] if args else "info"
if cmd == "exec":
    r = call("execute_code", {"code": "\n".join(open(f, encoding="utf-8").read() for f in args[1:])})
    print(json.dumps(r, ensure_ascii=False)[:2000])
elif cmd == "shot":
    r = call("get_viewport_screenshot", {"max_size": 1400, "filepath": args[1], "format": "png"})
    print(json.dumps(r)[:300])
else:
    print(json.dumps(call("get_scene_info", {}), ensure_ascii=False)[:2000])

/* 渲染层：硬件分档（design/studio/proposals/05 第五条）。按能力探测，不按设备型号；可用 ?tier= 或工坊面板覆盖。
   0 档：烘焙壳 + 固定物件 + 角色，无实时阴影，无后期，贴图 1024 封顶
   1 档：加一盏带阴影的聚光、接触阴影、暗角与调色
   2 档：全部局部光投影、后期全开、2048 贴图 */
export function detectTier(renderer, { isMobile } = {}) {
  const q = new URLSearchParams(location.search).get("tier");
  if (q !== null && /^[012]$/.test(q)) return +q;
  const gl = renderer.getContext(), caps = renderer.capabilities;
  const maxTex = caps.maxTextureSize || 2048, dpr = devicePixelRatio || 1;
  let info = "";
  try { const ext = gl.getExtension("WEBGL_debug_renderer_info"); if (ext) info = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || ""); } catch (e) {}
  const software = /swiftshader|llvmpipe|software/i.test(info);
  if (software) return 0;
  if (isMobile) return maxTex >= 8192 && dpr <= 3 ? 1 : 0;
  if (/intel|uhd|iris/i.test(info) && !/arc/i.test(info)) return 1;
  return maxTex >= 8192 ? 2 : 1;
}

export const TIER_BUDGET = [
  { drawCalls: 80, tris: 150000, texMB: 48, post: false, shadows: 0, maxTex: 1024 },
  { drawCalls: 120, tris: 300000, texMB: 96, post: true, shadows: 1, maxTex: 2048 },
  { drawCalls: 300, tris: 800000, texMB: 256, post: true, shadows: 3, maxTex: 2048 },
];

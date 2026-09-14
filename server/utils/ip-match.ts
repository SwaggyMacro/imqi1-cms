/**
 * IP 解析与网段匹配工具。
 *
 * 两个使用方：
 * - `client-ip.ts` 的受信代理白名单（TRUSTED_PROXY，支持单个 IP 或 CIDR）
 * - `urlGuard.ts` 的 SSRF 私有段判定（复用其中的 IPv6 展开）
 *
 * 全程按字节比对而非字符串前缀：Node 的 WHATWG URL 与 IPv6 socket 会把 IPv4 映射地址
 * 规范化成 `::ffff:a.b.c.d` 或十六进制 `::ffff:a9fe:a9fe`，只按点分十进制 / 字符串前缀
 * 匹配会漏判（SSRF 绕过，或白名单填了却不生效）。
 */

import { isIP } from "node:net";

/**
 * 展开 IPv6 为 8 组 16 位数字，便于按 CIDR 前缀判定。解析失败返回空数组。
 * 调用前须确保入参不带点分十进制尾巴（见 parseIpBytes 对 `::ffff:a.b.c.d` 的处理）。
 */
export function expandIpv6(ip: string): number[] {
  const lower = ip.toLowerCase();
  const halves = lower.split("::");
  if (halves.length > 2) return [];
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0) return [];
  const all = head.concat(Array(missing).fill("0")).concat(tail);
  if (all.length !== 8) return [];
  return all.map(g => parseInt(g || "0", 16));
}

/**
 * 解析 IP 为字节数组：IPv4 返回 4 字节，IPv6 返回 16 字节；解析失败返回 null。
 * IPv4 映射形式（`::ffff:a.b.c.d` 及其十六进制写法）归一成 4 字节——否则对端
 * `::ffff:172.26.0.1` 永远匹配不上 IPv4 网段 `172.16.0.0/12`。
 */
export function parseIpBytes(ip: string): number[] | null {
  const trimmed = ip.trim().toLowerCase();
  const family = isIP(trimmed);

  if (family === 4) {
    return trimmed.split(".").map(Number);
  }

  if (family === 6) {
    // 尾部是点分十进制的映射写法（::ffff:172.26.0.1）：直接取尾部四段当 IPv4
    const mapped = trimmed.match(/^(?:::ffff:|::)(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (mapped) {
      const bytes = mapped[1]!.split(".").map(Number);
      return bytes.every(b => b >= 0 && b <= 255) ? bytes : null;
    }

    const groups = expandIpv6(trimmed);
    if (groups.length !== 8) return null;
    const bytes: number[] = [];
    for (const group of groups) {
      bytes.push((group >> 8) & 0xff, group & 0xff);
    }
    // 十六进制写法的映射地址（::ffff:a9fe:a9fe）同样归一成 4 字节
    const isMapped = bytes.slice(0, 10).every(b => b === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
    return isMapped ? bytes.slice(12) : bytes;
  }

  return null;
}

/**
 * 判断 `ip` 是否匹配 `pattern`：
 * - pattern 含 `/` → 按 CIDR 网段比对（`172.16.0.0/12`、`fe80::/10`）
 * - 否则 → 精确地址比对（两侧都先归一，故 `172.26.0.1` 能匹配对端 `::ffff:172.26.0.1`）
 *
 * 任一侧解析失败、或两侧地址族不同（IPv4 对 IPv6）时返回 false。
 */
export function matchIpPattern(ip: string, pattern: string): boolean {
  const slash = pattern.lastIndexOf("/");

  if (slash === -1) {
    const a = parseIpBytes(ip);
    const b = parseIpBytes(pattern);
    return !!a && !!b && a.length === b.length && a.every((byte, i) => byte === b[i]);
  }

  const base = parseIpBytes(pattern.slice(0, slash));
  const target = parseIpBytes(ip);
  if (!base || !target || base.length !== target.length) return false;

  const prefix = Number(pattern.slice(slash + 1));
  const totalBits = base.length * 8;
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > totalBits) return false;

  const fullBytes = Math.floor(prefix / 8);
  for (let i = 0; i < fullBytes; i++) {
    if (target[i] !== base[i]) return false;
  }

  const restBits = prefix % 8;
  if (restBits > 0) {
    const mask = (0xff << (8 - restBits)) & 0xff;
    if (((target[fullBytes] ?? 0) & mask) !== ((base[fullBytes] ?? 0) & mask)) return false;
  }

  return true;
}

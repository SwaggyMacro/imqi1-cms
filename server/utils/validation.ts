/**
 * 数据验证工具函数
 * 根据 Prisma schema 中定义的字段长度限制进行验证
 */

import type { H3Event } from "h3";

import { isChangelogType } from "#shared/changelog";

/**
 * 验证字符串长度
 * @param value 要验证的值
 * @param maxLength 最大长度
 * @param fieldName 字段名称（用于错误提示）
 * @throws {Error} 如果超过最大长度
 */
export function validateMaxLength(value: string | null | undefined, maxLength: number, fieldName: string): void {
  if (value && value.length > maxLength) {
    throw createError({
      statusCode: 400,
      message: `${fieldName}不能超过${maxLength}个字符`,
    });
  }
}

/**
 * 长度提示：超出只随响应头带回给前端 toast，不拦截保存。
 * 用于写进 TEXT 列的字段 —— 那些列没有硬上限，下面的数只是经验值。
 */
export interface LengthWarning {
  field: string;
  length: number;
  limit: number;
}

function warnIfTooLong(warnings: LengthWarning[], value: string | null | undefined, limit: number, field: string): void {
  if (value && value.length > limit) {
    warnings.push({ field, length: value.length, limit });
  }
}

/**
 * 把长度提示挂到响应头，由前端全局拦截器统一 toast。
 * 走响应头而不塞进响应体：各接口的返回结构不统一，有的是 { success, data }，有的直接返回整行。
 */
export function setLengthWarnings(event: H3Event, warnings: LengthWarning[]): void {
  if (warnings.length) {
    setHeader(event, "X-Length-Warnings", encodeURIComponent(JSON.stringify(warnings)));
  }
}

/**
 * 验证评论数据
 */
export function validateCommentData(data: {
  name?: string;
  mail?: string | null;
  link?: string | null;
}): void {
  if (data.name) {
    validateMaxLength(data.name, 255, "昵称");
  }
  if (data.mail) {
    validateMaxLength(data.mail, 255, "邮箱");
  }
  if (data.link) {
    validateMaxLength(data.link, 500, "链接");
  }
}

/**
 * 验证文章数据
 */
export function validateContentData(data: {
  title?: string;
  slug?: string | null;
}): void {
  if (data.title) {
    validateMaxLength(data.title, 255, "标题");
  }
  if (data.slug) {
    validateMaxLength(data.slug, 255, "标识");
  }
}

/**
 * 收集用户数据的长度提示
 */
export function validateUserData(data: {
  name?: string;
  mail?: string;
  nickname?: string | null;
  avatar?: string | null;
}): LengthWarning[] {
  const warnings: LengthWarning[] = [];
  warnIfTooLong(warnings, data.name, 100, "用户名");
  warnIfTooLong(warnings, data.mail, 191, "邮箱");
  warnIfTooLong(warnings, data.nickname, 100, "昵称");
  warnIfTooLong(warnings, data.avatar, 191, "头像");
  return warnings;
}

/**
 * 收集分类/标签数据的长度提示
 */
export function validateMetaData(data: {
  name?: string;
  slug?: string | null;
  desc?: string | null;
}): LengthWarning[] {
  const warnings: LengthWarning[] = [];
  warnIfTooLong(warnings, data.name, 100, "名称");
  warnIfTooLong(warnings, data.slug, 100, "标识");
  warnIfTooLong(warnings, data.desc, 191, "描述");
  return warnings;
}

/**
 * 收集友情链接数据的长度提示
 */
export function validateLinkData(data: {
  name?: string;
  desc?: string | null;
  link?: string;
  avatar?: string | null;
}): LengthWarning[] {
  const warnings: LengthWarning[] = [];
  warnIfTooLong(warnings, data.name, 100, "名称");
  warnIfTooLong(warnings, data.desc, 191, "描述");
  warnIfTooLong(warnings, data.link, 191, "链接");
  warnIfTooLong(warnings, data.avatar, 191, "头像");
  return warnings;
}

/**
 * 收集订阅源数据的长度提示
 */
export function validateSubscribeData(data: {
  name?: string;
  url?: string;
  avatar?: string | null;
}): LengthWarning[] {
  const warnings: LengthWarning[] = [];
  warnIfTooLong(warnings, data.name, 100, "名称");
  warnIfTooLong(warnings, data.url, 191, "链接");
  warnIfTooLong(warnings, data.avatar, 191, "头像");
  return warnings;
}

/**
 * 收集附件数据的长度提示
 */
export function validateAttachmentData(data: {
  type?: string;
  title?: string;
  url?: string;
}): LengthWarning[] {
  const warnings: LengthWarning[] = [];
  warnIfTooLong(warnings, data.type, 50, "类型");
  warnIfTooLong(warnings, data.title, 191, "标题");
  warnIfTooLong(warnings, data.url, 191, "链接");
  return warnings;
}

/**
 * 收集系统设置项的长度提示
 */
export function validateSettingsData(data: Record<string, string | null | undefined>): LengthWarning[] {
  const w: LengthWarning[] = [];
  // 站点基本信息
  warnIfTooLong(w, data.siteName, 100, "站点名称");
  warnIfTooLong(w, data.siteUrl, 191, "站点URL");
  warnIfTooLong(w, data.siteDesc, 191, "站点描述");
  warnIfTooLong(w, data.siteIcp, 100, "ICP备案号");

  // 评论设置
  warnIfTooLong(w, data.commentAvatarService, 50, "评论头像服务");

  // 邮件设置
  warnIfTooLong(w, data.smtpHost, 191, "SMTP主机");
  warnIfTooLong(w, data.smtpUser, 191, "SMTP用户名");
  warnIfTooLong(w, data.smtpAddress, 191, "SMTP发件地址");
  warnIfTooLong(w, data.smtpFromName, 100, "SMTP发件人名称");
  warnIfTooLong(w, data.adminEmail, 191, "管理员邮箱");

  // 上传设置
  warnIfTooLong(w, data.uploadLocation, 50, "上传位置");

  // 腾讯云COS设置
  warnIfTooLong(w, data.cosSecretId, 191, "COS SecretId");
  warnIfTooLong(w, data.cosSecretKey, 191, "COS SecretKey");
  warnIfTooLong(w, data.cosBucket, 191, "COS存储桶名称");
  warnIfTooLong(w, data.cosRegion, 100, "COS地域");
  warnIfTooLong(w, data.cosSourceDomain, 191, "COS源站域名");
  warnIfTooLong(w, data.cosCdnDomain, 191, "COS CDN域名");

  // 百度审核设置
  warnIfTooLong(w, data.baiduApiKey, 191, "百度API Key");
  warnIfTooLong(w, data.baiduSecretKey, 191, "百度Secret Key");

  // 其他设置
  warnIfTooLong(w, data.musicPlaylistId, 191, "音乐播放列表ID");
  warnIfTooLong(w, data.photoCategorySlug, 100, "相册分类标识");
  warnIfTooLong(w, data.messageContentId, 50, "留言板文章ID");
  warnIfTooLong(w, data.homeCustomText, 191, "首页自定义文本");
  return w;
}

/**
 * 校验更新日志条目数组（content）
 *
 * - 至少 1 条、最多 MAX 条
 * - 每条 type 必须是合法类别
 * - 每条 value 非空；超过 VALUE_MAX 只提示，不拦截（content 是 TEXT 列）
 */
export function validateChangelogData(entries: unknown): LengthWarning[] {
  const MAX = 50;
  const VALUE_MAX = 20000;
  const warnings: LengthWarning[] = [];

  if (!Array.isArray(entries)) {
    throw createError({
      statusCode: 400,
      message: "更新内容格式错误",
    });
  }
  if (entries.length === 0) {
    throw createError({
      statusCode: 400,
      message: "内容不能为空",
    });
  }
  if (entries.length > MAX) {
    throw createError({
      statusCode: 400,
      message: `最多 ${MAX} 条更新`,
    });
  }

  for (const item of entries) {
    if (!item || typeof item !== "object") {
      throw createError({
        statusCode: 400,
        message: "更新内容格式错误",
      });
    }
    const obj = item as Record<string, unknown>;
    if (!isChangelogType(obj.type)) {
      throw createError({
        statusCode: 400,
        message: "更新类型不合法",
      });
    }
    const value = typeof obj.value === "string" ? obj.value.trim() : "";
    if (!value) {
      throw createError({
        statusCode: 400,
        message: "内容不能为空",
      });
    }
    warnIfTooLong(warnings, obj.value as string, VALUE_MAX, "更新内容");
  }
  return warnings;
}

/**
 * 校验旅行地点数据：名称与封面有列级硬上限，描述写 TEXT 列，只提示
 */
export function validateTravelData(data: {
  name?: string;
  desc?: string | null;
  cover?: string | null;
}): LengthWarning[] {
  const warnings: LengthWarning[] = [];
  if (data.name) {
    validateMaxLength(data.name, 255, "名称");
  }
  warnIfTooLong(warnings, data.desc, 20000, "描述");
  if (data.cover) {
    validateMaxLength(data.cover, 500, "封面图");
  }
  return warnings;
}

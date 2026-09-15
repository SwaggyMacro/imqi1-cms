/**
 * 数据验证工具函数
 * 根据 Prisma schema 中定义的字段长度限制进行验证
 */

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
 * 验证用户数据
 */
export function validateUserData(data: {
  name?: string;
  mail?: string;
  nickname?: string | null;
  avatar?: string | null;
}): void {
  // Prisma String 在 PG 默认 TEXT（无 191 上限）；校验上限保守取小于列长，避免超长写入时 DB 报错
  if (data.name) {
    validateMaxLength(data.name, 100, "用户名");
  }
  if (data.mail) {
    validateMaxLength(data.mail, 191, "邮箱");
  }
  if (data.nickname) {
    validateMaxLength(data.nickname, 100, "昵称");
  }
  if (data.avatar) {
    validateMaxLength(data.avatar, 191, "头像");
  }
}

/**
 * 验证分类/标签数据
 */
export function validateMetaData(data: {
  name?: string;
  slug?: string | null;
  desc?: string | null;
}): void {
  if (data.name) {
    validateMaxLength(data.name, 100, "名称");
  }
  if (data.slug) {
    validateMaxLength(data.slug, 100, "标识");
  }
  if (data.desc) {
    validateMaxLength(data.desc, 191, "描述");
  }
}

/**
 * 验证友情链接数据
 */
export function validateLinkData(data: {
  name?: string;
  desc?: string | null;
  link?: string;
  avatar?: string | null;
}): void {
  if (data.name) {
    validateMaxLength(data.name, 100, "名称");
  }
  if (data.desc) {
    validateMaxLength(data.desc, 191, "描述");
  }
  if (data.link) {
    validateMaxLength(data.link, 191, "链接");
  }
  if (data.avatar) {
    validateMaxLength(data.avatar, 191, "头像");
  }
}

/**
 * 验证订阅源数据
 */
export function validateSubscribeData(data: {
  name?: string;
  url?: string;
  avatar?: string | null;
}): void {
  if (data.name) {
    validateMaxLength(data.name, 100, "名称");
  }
  if (data.url) {
    validateMaxLength(data.url, 191, "链接");
  }
  if (data.avatar) {
    validateMaxLength(data.avatar, 191, "头像");
  }
}

/**
 * 验证附件数据
 */
export function validateAttachmentData(data: {
  type?: string;
  title?: string;
  url?: string;
}): void {
  if (data.type) {
    validateMaxLength(data.type, 50, "类型");
  }
  if (data.title) {
    validateMaxLength(data.title, 191, "标题");
  }
  if (data.url) {
    validateMaxLength(data.url, 191, "链接");
  }
}

/**
 * 验证更新日志条目数组（content）
 *
 * - 至少 1 条、最多 MAX 条
 * - 每条 type 必须是合法类别
 * - 每条 value 非空、长度上限 VALUE_MAX
 */
export function validateChangelogData(entries: unknown): void {
  const MAX = 50;
  const VALUE_MAX = 20000;

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
    validateMaxLength(obj.value as string, VALUE_MAX, "内容");
  }
}

/**
 * 验证旅行地点数据
 */
export function validateTravelData(data: {
  name?: string;
  desc?: string | null;
  cover?: string | null;
}): void {
  if (data.name) {
    validateMaxLength(data.name, 255, "名称");
  }
  if (data.desc) {
    validateMaxLength(data.desc, 20000, "描述");
  }
  if (data.cover) {
    validateMaxLength(data.cover, 500, "封面图");
  }
}

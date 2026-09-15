import type { MiniComment, MiniCommentsResponse } from "#server/types/apis/mini";
import { commentAvatarUrl } from "#server/utils/comment-avatar";
import { formatRelativeTime } from "#server/utils/mini";
import { prisma } from "#server/utils/prisma";
import { getSiteSettings } from "#server/utils/siteSettings";

// 头像走共享 util（与主站同一份拼装逻辑），端上 <image> 直连；
// 需在小程序合法域名白名单里加入所用镜像站域名（gravatar/cravatar/weavatar）。

export default defineEventHandler(async event => {
  setHeader(event, "Cache-Control", "public, max-age=300, s-maxage=300");

  // 评论总开关跟随主站后台设置（informations.commentEnabled），不再有独立的小程序开关。
  // 关闭时返回空列表并标记 commentEnabled=false，端上据此整个评论区（含输入框）不渲染。
  const settings = await getSiteSettings();
  if (!settings.commentEnabled) {
    return {
      success: true,
      data: [],
      total: 0,
      requireMail: settings.commentRequireMail,
      requireLink: settings.commentRequireLink,
      commentEnabled: false,
    } satisfies MiniCommentsResponse;
  }

  const query = getQuery(event);
  const cid = Number(query.cid);

  if (!cid || !Number.isInteger(cid) || cid <= 0) {
    throw createError({
      statusCode: 400,
      message: "缺少或非法的文章 id",
    });
  }

  try {
    // 表单必填项、头像服务都跟随主站后台设置，与上方总开关同一次读取。
    const { commentRequireMail: requireMail, commentRequireLink: requireLink, commentAvatarService } = settings;

    // 仅取审核通过（status: 1）的评论，按时间正序，端上再自行构建树。
    const rows = await prisma.comments.findMany({
      where: { cid, status: 1 },
      orderBy: { create_time: "asc" },
      select: {
        coid: true,
        name: true,
        mail: true,
        content: true,
        create_time: true,
        parent_id: true,
      },
    });

    // 构建评论树：先建节点映射，再按 parent_id 挂到父节点 children 下。
    const nodeMap = new Map<number, MiniComment>();
    const roots: MiniComment[] = [];

    for (const row of rows) {
      nodeMap.set(row.coid, {
        id: row.coid,
        name: row.name,
        content: row.content,
        avatar: commentAvatarUrl(row.mail, commentAvatarService),
        publishedAt: formatRelativeTime(row.create_time),
        created: row.create_time.toISOString(),
        parentName: null,
        children: [],
      });
    }

    for (const row of rows) {
      const node = nodeMap.get(row.coid);
      if (!node) continue;

      if (row.parent_id) {
        const parent = nodeMap.get(row.parent_id);
        // 父评论存在（未被删除/未过审）时挂为子级，否则降级为根评论。
        if (parent) {
          node.parentName = parent.name;
          parent.children.push(node);
          continue;
        }
      }

      roots.push(node);
    }

    // 根评论按时间倒序（最新在前）；子回复保持 asc 的阅读顺序不变。
    roots.reverse();

    return {
      success: true,
      data: roots,
      total: rows.length,
      requireMail,
      requireLink,
      commentEnabled: true,
    } satisfies MiniCommentsResponse;
  } catch (error) {
    console.error(error);
    throw createError({
      statusCode: 500,
      message: "获取小程序评论列表失败",
    });
  }
});

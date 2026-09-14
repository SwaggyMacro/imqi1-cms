import type { GridItem } from "~/types/apis";

/** 首页「样式主题」说明卡片：grid 类展示格子列表，content 类展示正文 */
export interface ThemeCardItem {
  title: string;
  type: "grid" | "content";
  grids?: GridItem[];
  content?: string;
}

/** 首页「样式主题」右侧展示格，每项对应 index.vue 模板里的一条 v-if/v-else-if 分支 */
export interface ThemeRightItem {
  type: "fonts" | "layout" | "music" | "article";
}

---
name: validation-length-caps
description: validateXxxData 的长度上限要按 schema 列的实际列长定——PG 下裸 String 是 TEXT(无上限)、显式 @db.VarChar(n) 按 n；191 只是沿用的保守值,不是列长
metadata:
  node_type: memory
  type: project
---

`server/utils/validation.ts` 的长度上限（`validateMaxLength`）当前分布：**191 × 28、100 × 11、50 × 5、255 × 5、500 × 3**。

**⚠️ 关于 191（2026-09-14 订正）**：本条早先写「Prisma **MySQL** 裸 `String` 默认 VARCHAR(**191**)」——那是 MySQL 的行为，**已随迁移到 PostgreSQL 失效**。现在 `prisma/schema.prisma` 是 `provider = "postgresql"`，**裸 `String` 映射为 `TEXT`、没有长度上限**（schema 里目前还有 21 个裸 `String` 字段）。所以那 28 处 191 **不是列长，只是沿用 MySQL 时代数值的保守应用层上限**。`validation.ts:67` 的注释已是新说法（「Prisma String 在 PG 默认 TEXT（无 191 上限）；校验上限保守取小于列长」）。

**上限该怎么定（真正要记的）**：
- **显式 `@db.VarChar(n)` 的列**（schema 里 13 处）→ 上限必须 **≤ n**，否则「过校验 → 写库溢出 → 500」而非友好的 400。validation.ts 里那 5 处 255 与 3 处 500 正对应 `@db.VarChar(255/500)` 的列（`users.name`/`mail`/`link` 等），是对的。
- **裸 `String`（TEXT）的列** → 没有硬上限，191 只是保守值，可沿用也可放宽；但**别把它当成"列长"去卡**。
- 加/改校验器**先查 schema 对应字段的实际列长**，别照搬 191、也别超过显式列长。

**Why:** 校验层上限只防应用层、不换列类型；超过真实列长时校验形同虚设，最终被 Prisma 打挂成 500。反过来说，TEXT 列上写死 191 只是保守、不会出错。

**改 schema 列本身是另一回事**（那才是真「改列长」，走 db execute 幂等脚本，**禁用 migrate dev/reset**）。关联 [[db-migration-disconnected]]。

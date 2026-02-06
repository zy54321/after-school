# AI_CHANGELOG

> 目的：记录每次 AI/人工改动，防止上下文漂移。
> 规则：每次改动追加一段，包含：日期、目标、涉及文件、验收。

## Template

- Date: YYYY-MM-DD
- Goal: ...
- Files:
  - ...
- Notes: ...
- Acceptance:
  - ...

## Log

- Date: 2026-02-06
- Goal: 初始化 AI 记忆锚点（AI_CONTEXT / AI_INDEX / AI_CHANGELOG）
- Files:
  - AI_CONTEXT.md
  - AI_INDEX.json
  - AI_CHANGELOG.md
- Acceptance:
  - 后续每次变更，AI 先读 3 个文件即可恢复上下文


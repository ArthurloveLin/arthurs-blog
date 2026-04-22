    1. dashboard.json 职责过重

    它同时承担了三个角色：
    - /spotify 页面的数据源
    - 快速同步时 library 数据的继承来源
    - archiveMeta 状态信息的载体

    结果是：每次快速同步都要读整个大 blob（可能 2-5MB），只是为了把 library 部分复制过去，然后再把整个 blob 写回去。如果未来页面结构变了，这个文件的 schema
    就牵一发动全身。

    更干净的做法是把 library 单独存一个 latest/library.json，快速同步只读/写这一个小文件。但这是重构，不是 bug。

    2. 跨月边界问题（已有，非本次引入）

    const yearMonth = getYearMonth(new Date(syncedAt))  // 基于同步时间

    1 月 1 日凌晨 00:05 同步，after 游标返回了 12 月 31 日晚听的歌，这些歌的 playedAt 是 12 月，但被写入了 1 月的分片。跨月时会发生一批数据放错桶的问题。

    修法是按 track 的 playedAt 分组再写入对应月份的分片，但会增加复杂度。

    3. rankings.json 没有裁剪策略

    它只追加，从不删。三个时间范围 × 每天一条快照，一年后有 1000+ 条记录。对于个人项目问题不大，但值得知道它会一直长。

    4. collection 文件只取预览，但 total 字段记录全量数量

    saved-tracks.json 里存的 items 只有 24 条（SAVED_TRACKS_PREVIEW_LIMIT），但 total 是你实际收藏的全部歌曲数量。文件内容和 total 不一致，页面展示"收藏了 2000
    首，显示 24 首"是对的，但如果有人误以为这个文件是全量的，会困惑。这是命名/注释问题，不是 bug。 
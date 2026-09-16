# 账本 实现进度

**更新时间**: 2026-09-16 11:55 HKT  
**粗估完成度**: ~95%

## 里程碑
- [x] UI shell：毛玻璃 + 蓝主题 + pill 按钮 + 状态色进度条
- [x] MVP 功能：预算桶、日计划、周六模式、会员入账、特例、收入、仪表盘建议
- [x] PWA：manifest / SW / 图标；`npm run build` 通过
- [x] OCR 入账主流程：多图上传 → Tesseract（chi_sim+eng）→ 可编辑复核 → 确认写入
- [x] 支付方式：八达通 / 微信 / 支付宝 / 银行卡 / 信用卡 / 其他（手动+OCR+流水筛选）
- [x] 八达通充值默认不计预算；八达通截图默认 HKD

## 可选跟进
- 真机截图调优 OCR 解析规则
- 部署 HTTPS 后验证「添加到主屏幕」
- 推送到 https://github.com/haytham-fu/zhangben

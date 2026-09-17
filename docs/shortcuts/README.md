# 账本入账 · 苹果快捷指令

## 文件
- `账本入账.shortcut`：取最新屏幕快照 → OCR → 打开 https://haytham-fu.github.io/zhangben/ 预填金额

## 为什么可能还要签名
iOS 15+ 通常只接受**已签名**的 `.shortcut`。本文件在 Linux 上生成，若为未签名，需要在 **Mac** 上签一次：

```bash
shortcuts sign --mode anyone --input 账本入账.shortcut --output 账本入账-已签名.shortcut
```

然后把 `账本入账-已签名.shortcut` AirDrop / 隔空投送到 iPhone，用「快捷指令」打开导入。

## iPhone 导入后
再做一个自动化：相册「屏幕快照」有新照片时 → 运行「账本入账」。音量下+侧边键仍是系统截图，无法直接绑到快捷指令。

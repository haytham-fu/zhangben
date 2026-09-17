#!/usr/bin/env python3
"""Rebuild 账本入账.shortcut (unsigned). Requires shortcutkit."""
from pathlib import Path

from shortcutkit import Shortcut, ref, text

HERE = Path(__file__).resolve().parent

COMMENT = (
    "【账本入账】硬性说明（请先读）\n"
    "\n"
    "Apple 不允许把「音量下 + 侧边/电源键」直接绑定到快捷指令。\n"
    "唯一能用这对按键触发记账的官方路径是：\n"
    "1) 按 音量下 + 侧边键 → 系统截屏\n"
    "2) 截图进入「屏幕快照 / Screenshots」相册\n"
    "3) 个人自动化「照片加入相册 → 屏幕快照」立刻运行本快捷指令\n"
    "   （必须关闭「运行前询问」）\n"
    "\n"
    "本指令流程：获取最新屏幕快照 → OCR 提取文字 → URL 编码 → 打开账本网页预填。\n"
    "网站：https://haytham-fu.github.io/zhangben/\n"
    "详细步骤见同目录「自动化设置.md」与「README.md」。"
)

BASE = "https://haytham-fu.github.io/zhangben/?action=add&text="


def build() -> Path:
    s = Shortcut("账本入账", color="Teal")
    s.action("is.workflow.actions.comment", WFCommentActionText=COMMENT)
    latest = s.action(
        "is.workflow.actions.getlastscreenshot",
        WFGetLatestPhotoCount=1,
    )
    ocr = s.action(
        "is.workflow.actions.extracttextfromimage",
        imageFile=ref(latest),
    )
    encoded = s.action(
        "is.workflow.actions.urlencode",
        WFEncodeMode="Encode",
        WFInput=ref(ocr),
    )
    url = s.action(
        "is.workflow.actions.url",
        WFURLActionURL=text(BASE, ref(encoded)),
    )
    s.action(
        "is.workflow.actions.notification",
        WFNotificationActionTitle="账本入账",
        WFNotificationActionBody="正在打开账本…",
        WFNotificationActionSound=False,
    )
    s.action("is.workflow.actions.openurl", WFInput=ref(url))
    path = HERE / "账本入账.shortcut"
    s.write(path)
    print(f"wrote {path} ({len(s.actions)} actions, unsigned)")
    print("Mac sign: shortcuts sign --mode anyone --input 账本入账.shortcut --output 账本入账-已签名.shortcut")
    return path


if __name__ == "__main__":
    build()

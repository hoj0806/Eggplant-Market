"""public/og-image.png를 만든다.

카카오톡이나 슬랙에 주소를 붙이면 뜨는 카드의 그림이다. 1200 x 630 (1.91:1) —
수집기들이 모두 이 비율로 자른다.

가지는 `generateFavicon.py`의 래스터라이저를 그대로 쓴다. **표식을 또 그리지 않으려는
것**이고, 그래서 `public/favicon.svg`가 여기서도 유일한 원본이다.

쓰는 법
-------
    python scripts/generateOgImage.py

Pillow가 필요하다(`pip install pillow`). 이름이나 표식이 바뀔 때만 돌리면 된다.
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))

from generateFavicon import render  # noqa: E402  (경로를 먼저 잡아야 import된다)

PUBLIC_DIR = Path(__file__).resolve().parent.parent / 'public'
TARGET_PNG = PUBLIC_DIR / 'og-image.png'

WIDTH = 1200
HEIGHT = 630

# src/shared/ui/siteMeta.ts와 같아야 한다. siteMeta.test.ts가 지킨다.
SITE_NAME = '가지마켓'
SITE_TAGLINE = '동네 이웃과 중고거래'

BACKGROUND = '#FFFFFF'
# 아주 옅은 보라. 흰 배경에 카드가 묻히지 않을 만큼만 띄운다.
PANEL = '#F5F3FF'
TITLE_COLOR = '#18181B'
TAGLINE_COLOR = '#52525B'
RULE_COLOR = '#7C3AED'

MARK_SIZE = 240
TITLE_SIZE = 108
TAGLINE_SIZE = 46
GAP = 56

BOLD_FONT = Path('C:/Windows/Fonts/malgunbd.ttf')
REGULAR_FONT = Path('C:/Windows/Fonts/malgun.ttf')


def load_font(path, size):
    if not path.exists():
        raise SystemExit(f'글꼴이 없다: {path}')
    return ImageFont.truetype(str(path), size)


def text_size(pen, text, font):
    left, top, right, bottom = pen.textbbox((0, 0), text, font=font)
    return right - left, bottom - top, left, top


def main():
    canvas = Image.new('RGB', (WIDTH, HEIGHT), BACKGROUND)
    pen = ImageDraw.Draw(canvas)

    # 옅은 판을 깔아 그림의 경계를 만든다. 흰 배경 그대로면 카카오톡 흰 말풍선 위에서
    # 카드가 어디서 시작하는지 안 보인다.
    pen.rounded_rectangle([48, 48, WIDTH - 48, HEIGHT - 48], radius=40, fill=PANEL)

    title_font = load_font(BOLD_FONT, TITLE_SIZE)
    tagline_font = load_font(REGULAR_FONT, TAGLINE_SIZE)

    title_width, title_height, title_left, title_top = text_size(pen, SITE_NAME, title_font)
    tagline_width, tagline_height, tagline_left, tagline_top = text_size(
        pen, SITE_TAGLINE, tagline_font
    )

    mark = render(MARK_SIZE)

    # 가로로 가운데. [표식] [간격] [제목 / 밑줄 / 부제] 한 덩어리로 놓는다.
    text_width = max(title_width, tagline_width)
    block_width = MARK_SIZE + GAP + text_width
    block_left = (WIDTH - block_width) // 2

    text_left = block_left + MARK_SIZE + GAP
    rule_gap = 34
    text_height = title_height + rule_gap + 6 + rule_gap + tagline_height
    text_top = (HEIGHT - text_height) // 2

    canvas.paste(mark, (block_left, (HEIGHT - MARK_SIZE) // 2), mark)

    pen.text((text_left - title_left, text_top - title_top), SITE_NAME, font=title_font,
             fill=TITLE_COLOR)

    rule_top = text_top + title_height + rule_gap
    pen.rounded_rectangle(
        [text_left, rule_top, text_left + 96, rule_top + 6], radius=3, fill=RULE_COLOR
    )

    tagline_top_y = rule_top + 6 + rule_gap
    pen.text((text_left - tagline_left, tagline_top_y - tagline_top), SITE_TAGLINE,
             font=tagline_font, fill=TAGLINE_COLOR)

    canvas.save(TARGET_PNG, format='PNG', optimize=True)
    print(f'{TARGET_PNG} · {WIDTH}x{HEIGHT} · {TARGET_PNG.stat().st_size // 1024} kB')


if __name__ == '__main__':
    main()

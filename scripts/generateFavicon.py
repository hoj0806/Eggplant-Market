"""public/favicon.ico를 public/favicon.svg에서 만든다.

왜 스크립트인가
---------------
브라우저는 링크가 없어도 `/favicon.ico`를 찔러 본다. SVG만 두면 그 요청에 SPA 폴백이
`index.html`을 돌려준다 — 지금 고치려는 바로 그 증상이다. 그래서 .ico도 있어야 한다.

.ico는 바이너리라 손으로 못 쓴다. 저장소에 SVG 래스터라이저가 없어서(ImageMagick도
sharp도 없다) 여기서 **경로를 직접 훑어 채운다.** 가지 도형은 베지어 몇 개뿐이라
전용 도구를 들일 무게가 아니다.

**가지를 두 번 그리지 않으려고** 경로 문자열은 favicon.svg에서 읽어 온다.
favicon.svg가 src/shared/ui/brandMarkShape.ts와 같은지는 Jest가 지킨다.

쓰는 법
-------
    python scripts/generateFavicon.py

Pillow가 필요하다(`pip install pillow`). 표식이 바뀔 때만 돌리면 된다.
"""

import re
import struct
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw

PUBLIC_DIR = Path(__file__).resolve().parent.parent / 'public'
SOURCE_SVG = PUBLIC_DIR / 'favicon.svg'
TARGET_ICO = PUBLIC_DIR / 'favicon.ico'

ICON_SIZES = (16, 32, 48)
SUPERSAMPLE = 8

NUMBER = re.compile(r'-?\d*\.?\d+(?:[eE][-+]?\d+)?')
COMMAND = re.compile(r'[MmLlHhVvCcSsZz]')


def parse_numbers(chunk):
    return [float(value) for value in NUMBER.findall(chunk)]


def split_commands(path_data):
    """'M12 6.2c4.1 0 …' → [('M', [12, 6.2]), ('c', [4.1, 0, …]), …]"""
    tokens = []
    for match in COMMAND.finditer(path_data):
        start = match.end()
        end = len(path_data)
        following = COMMAND.search(path_data, start)
        if following is not None:
            end = following.start()
        tokens.append((match.group(), parse_numbers(path_data[start:end])))
    return tokens


def cubic_points(start, control_one, control_two, end, steps=48):
    """베지어 한 도막을 선분으로 편다. 8배 확대해 그리므로 48도막이면 계단이 안 보인다."""
    points = []
    for index in range(1, steps + 1):
        t = index / steps
        u = 1.0 - t
        x = (
            u * u * u * start[0]
            + 3 * u * u * t * control_one[0]
            + 3 * u * t * t * control_two[0]
            + t * t * t * end[0]
        )
        y = (
            u * u * u * start[1]
            + 3 * u * u * t * control_one[1]
            + 3 * u * t * t * control_two[1]
            + t * t * t * end[1]
        )
        points.append((x, y))
    return points


def flatten_path(path_data):
    """경로를 점 목록들로 편다. 부분경로마다 목록 하나."""
    subpaths = []
    current = []
    cursor = (0.0, 0.0)
    start_point = (0.0, 0.0)
    previous_control = None

    for command, values in split_commands(path_data):
        relative = command.islower()
        letter = command.upper()

        if letter == 'Z':
            if current:
                subpaths.append(current)
                current = []
            cursor = start_point
            previous_control = None
            continue

        step = {'M': 2, 'L': 2, 'H': 1, 'V': 1, 'C': 6, 'S': 4}[letter]
        for offset in range(0, len(values), step):
            args = values[offset:offset + step]
            if len(args) < step:
                break

            if letter == 'M':
                if current:
                    subpaths.append(current)
                cursor = _shift(cursor, args, relative)
                start_point = cursor
                current = [cursor]
                previous_control = None
                # SVG 규칙: M 뒤에 좌표가 더 오면 그것은 L이다.
                letter = 'L'
                continue

            if letter == 'L':
                cursor = _shift(cursor, args, relative)
                current.append(cursor)
            elif letter == 'H':
                x = cursor[0] + args[0] if relative else args[0]
                cursor = (x, cursor[1])
                current.append(cursor)
            elif letter == 'V':
                y = cursor[1] + args[0] if relative else args[0]
                cursor = (cursor[0], y)
                current.append(cursor)
            else:
                if letter == 'C':
                    control_one = _shift(cursor, args[0:2], relative)
                    control_two = _shift(cursor, args[2:4], relative)
                    end = _shift(cursor, args[4:6], relative)
                else:
                    # S: 앞 제어점을 현재점 기준으로 뒤집은 것이 첫 제어점이다.
                    if previous_control is None:
                        control_one = cursor
                    else:
                        control_one = (
                            2 * cursor[0] - previous_control[0],
                            2 * cursor[1] - previous_control[1],
                        )
                    control_two = _shift(cursor, args[0:2], relative)
                    end = _shift(cursor, args[2:4], relative)

                current.extend(cubic_points(cursor, control_one, control_two, end))
                previous_control = control_two
                cursor = end
                continue

            previous_control = None

    if current:
        subpaths.append(current)
    return subpaths


def _shift(cursor, pair, relative):
    if relative:
        return (cursor[0] + pair[0], cursor[1] + pair[1])
    return (pair[0], pair[1])


def read_shapes():
    """favicon.svg에서 뷰박스와 채우기·선 경로를 뽑는다."""
    markup = SOURCE_SVG.read_text(encoding='utf-8')
    view_box = [float(value) for value in re.search(r'viewBox="([^"]+)"', markup).group(1).split()]
    fills = []
    strokes = []

    for element in re.findall(r'<path\b[^>]*/>', markup):
        data = re.search(r'\sd="([^"]+)"', element).group(1)
        fill = re.search(r'\sfill="([^"]+)"', element)
        stroke = re.search(r'\sstroke="([^"]+)"', element)

        if fill is not None:
            fills.append((fill.group(1), data))
        elif stroke is not None:
            width = re.search(r'\sstroke-width="([^"]+)"', element)
            strokes.append((stroke.group(1), data, float(width.group(1))))

    if not fills:
        raise SystemExit(f'{SOURCE_SVG.name}에서 채울 경로를 못 찾았다')
    return view_box, fills, strokes


def render(size):
    """한 변이 size인 RGBA 이미지를 그린다. SUPERSAMPLE배로 그린 뒤 줄여 가장자리를 눕힌다."""
    view_box, fills, strokes = read_shapes()
    min_x, min_y, box_width, box_height = view_box
    scale = size * SUPERSAMPLE / max(box_width, box_height)

    def place(point):
        return ((point[0] - min_x) * scale, (point[1] - min_y) * scale)

    canvas = Image.new('RGBA', (size * SUPERSAMPLE, size * SUPERSAMPLE), (0, 0, 0, 0))
    pen = ImageDraw.Draw(canvas)

    for color, data in fills:
        for subpath in flatten_path(data):
            if len(subpath) >= 3:
                pen.polygon([place(point) for point in subpath], fill=color)

    for color, data, width in strokes:
        thickness = max(1, round(width * scale))
        for subpath in flatten_path(data):
            points = [place(point) for point in subpath]
            if len(points) < 2:
                continue
            pen.line(points, fill=color, width=thickness)
            # stroke-linecap="round" — Pillow의 line은 끝이 각지므로 원을 얹는다.
            radius = thickness / 2
            for x, y in (points[0], points[-1]):
                pen.ellipse([x - radius, y - radius, x + radius, y + radius], fill=color)

    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def build_ico(images):
    """PNG를 담은 ICO를 손으로 쓴다.

    Pillow의 ICO 저장은 한 장을 받아 알아서 줄이는데, 그러면 16px이 뭉갠 32px이 된다.
    크기마다 따로 그린 것을 넣으려고 컨테이너를 직접 만든다.
    """
    payloads = []
    for image in images:
        buffer = BytesIO()
        image.save(buffer, format='PNG')
        payloads.append(buffer.getvalue())

    header = struct.pack('<HHH', 0, 1, len(payloads))
    offset = len(header) + 16 * len(payloads)
    directory = b''

    for image, payload in zip(images, payloads):
        directory += struct.pack(
            '<BBBBHHII',
            image.width if image.width < 256 else 0,
            image.height if image.height < 256 else 0,
            0,  # 팔레트 색 수. 32비트라 0.
            0,  # 예약.
            1,  # 색 평면.
            32,  # 픽셀당 비트.
            len(payload),
            offset,
        )
        offset += len(payload)

    return header + directory + b''.join(payloads)


def main():
    images = [render(size) for size in ICON_SIZES]
    TARGET_ICO.write_bytes(build_ico(images))
    print(f'{TARGET_ICO} · {", ".join(f"{size}px" for size in ICON_SIZES)}')


if __name__ == '__main__':
    main()

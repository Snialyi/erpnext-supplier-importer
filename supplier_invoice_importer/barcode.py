from html import escape


PATTERNS = (
    "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
    "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
    "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
    "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
    "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
    "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
    "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
    "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
    "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
    "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
    "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
)


def code128_svg(value, height=30):
    """Return a self-contained Code 128B SVG for print formats."""
    text = str(value or "").strip()
    if not text:
        return ""

    values = []
    for character in text:
        code = ord(character)
        values.append(code - 32 if 32 <= code <= 126 else ord("?") - 32)

    checksum = (104 + sum((index + 1) * code for index, code in enumerate(values))) % 103
    encoded = [104, *values, checksum, 106]
    quiet = 10
    x = quiet
    bars = []
    for code in encoded:
        pattern = PATTERNS[code]
        for index, width_text in enumerate(pattern):
            width = int(width_text)
            if index % 2 == 0:
                bars.append(f'<rect x="{x}" y="0" width="{width}" height="{height}"/>')
            x += width

    total_width = x + quiet
    safe_text = escape(text)
    return (
        f'<svg class="code128" xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {total_width} {height + 12}" preserveAspectRatio="none">'
        f'<g fill="#000">{"".join(bars)}</g>'
        f'<text x="{total_width / 2}" y="{height + 10}" text-anchor="middle" '
        f'font-family="Arial, sans-serif" font-size="9">{safe_text}</text></svg>'
    )

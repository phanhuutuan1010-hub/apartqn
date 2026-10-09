# Noto Sans (subset)

`NotoSans-subset.woff2` is built from Google Fonts' `NotoSans[wdth,wght].ttf` (SIL OFL 1.1, see `OFL.txt`):

- instanced to `wdth=100`, `wght=400–800` (variable)
- subset to Basic Latin + Latin-1, Vietnamese (incl. ₫ and combining marks), general punctuation, arrows, ▴▾▸

It replaces `next/font/google`, whose CSS makes Vietnamese pages download the 168 KB `latin-ext` file
(its unicode-range also covers đ/₫ and is declared after `vietnamese`). One 50 KB file serves vi/en (Cyrillic was dropped with the Russian locale; Cyrillic typed into search falls back to the system font).

Rebuild (Python + fonttools + brotli):

```
python -m fontTools varLib.instancer "NotoSans[wdth,wght].ttf" wdth=100 wght=400:800 -o NotoSans-w.ttf
python -m fontTools subset NotoSans-w.ttf --layout-features='*' --flavor=woff2 --output-file=NotoSans-subset.woff2 \
  --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0309,U+0323,U+0329,U+1EA0-1EF9,U+2000-206F,U+20AB,U+20AC,U+2116,U+2122,U+2190-2193,U+2212,U+2215,U+2248,U+2264-2265,U+25B4-25BF,U+FEFF,U+FFFD"
```

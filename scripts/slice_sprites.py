#!/usr/bin/env python3
"""
Sprite Sheet Slicer - Python version with proper image processing
Extracts individual fruit sprites from balls_sheet.jpg using:
- Border-connected light background removal
- Connected components analysis
- Largest component per grid cell
- Special handling for star sparkles
- Fill holes, crop to bbox, center on square canvas
"""

import numpy as np
from PIL import Image
from scipy import ndimage

src = Image.open('art/balls_sheet.jpg').convert('RGB')
a = np.asarray(src).astype(int)
H, W, _ = a.shape
light = (a.min(axis=2) > 225) & ((a.max(axis=2) - a.min(axis=2)) < 30)
lab, _ = ndimage.label(light)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:,0], lab[:,-1]]))) - {0}
fg = ~np.isin(lab, list(border))
fg = ndimage.binary_opening(fg, iterations=2)
comp, n = ndimage.label(fg)
sizes = ndimage.sum(fg, comp, range(1, n+1))
cents = ndimage.center_of_mass(fg, comp, range(1, n+1))
names = ['blueberry', 'cherry', 'strawberry', 'lime', 'orange', 'peach', 'apple', 'coconut', 'watermelon', 'star']
cw, ch = W/5, H/2
out = []
for i, nm in enumerate(names):
  r, c = divmod(i, 5)
  cand = sorted([(sizes[k], k+1) for k, (y, x) in enumerate(cents) if int(x//cw) == c and int(y//ch) == r], reverse=True)
  mask = comp == cand[0][1]
  ys, xs = np.nonzero(mask)
  y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
  if nm == 'star':
    for s, k in cand[1:]:
      m = comp == k
      yy, xx = np.nonzero(m)
      if yy.min() > y0-40 and yy.max() < y1+40 and xx.min() > x0-40 and xx.max() < x1+40:
        mask |= m
  mask = ndimage.binary_fill_holes(mask)
  ys, xs = np.nonzero(mask)
  y0, y1, x0, x1 = ys.min(), ys.max()+1, xs.min(), xs.max()+1
  rgba = np.dstack([a, np.where(mask, 255, 0)]).astype(np.uint8)[y0:y1, x0:x1]
  h, w = rgba.shape[:2]
  s = max(h, w)
  pad = int(s * 0.02)
  S = s + 2*pad
  canvas = np.zeros((S, S, 4), np.uint8)
  oy, ox = (S-h)//2, (S-w)//2
  canvas[oy:oy+h, ox:ox+w] = rgba
  im = Image.fromarray(canvas).resize((256, 256), Image.LANCZOS)
  im.save(f'assets/sprites/ball_{i+1}_{nm}.png')
  out.append(im)
  print(nm, (w, h), im.split()[3].getbbox())

sheet = Image.new('RGBA', (256*5, 512), (255, 0, 255, 255))
for i, im in enumerate(out):
  sheet.alpha_composite(im, ((i%5)*256, (i//5)*256))
sheet.save('art/sprites_preview.png')

# Putting the game on the Scoggverse site

The game lives at https://five-nights-at-scoggies.vercel.app/game/ (the site around it, the Scoggverse, is at the root URL, with the game on its Play page). To show the game on another page, paste this where it should go:

```html
<div style="position:relative;width:100%;aspect-ratio:16/9;background:#000">
  <iframe src="https://five-nights-at-scoggies.vercel.app/game/" title="Five Nights at Scoggy's"
          allow="autoplay; fullscreen; gamepad" allowfullscreen loading="lazy"
          style="position:absolute;inset:0;width:100%;height:100%;border:0"></iframe>
</div>
<p style="font-size:0.85rem;color:#888">
  Click the game, then use the mouse and keys (A/D doors, Q/E lights, Space cameras, F full screen). Best on a laptop or desktop.
  <a href="https://five-nights-at-scoggies.vercel.app/game/" target="_blank" rel="noopener">Open it on its own page</a>.<br>
  A free, non-commercial fan parody of <i>Five Nights at Freddy's</i> by Scott Cawthon. Not affiliated with or endorsed by him.
</p>
```

- A working example is the embed page itself: https://five-nights-at-scoggies.vercel.app/embed.html (redirects to `/game/embed.html`, from `web/embed.html`).
- The frame keeps 16:9 at any width. Give it at least ~800 px of width so the buttons and captions stay readable.
- `allow="autoplay; fullscreen"` lets the game play sound after the first click and go full screen. Without it the game still runs, silently until clicked.
- The site serves no framing restrictions, so any site can embed it. Nothing is needed on our side.
- Phones see a "Best on a laptop" notice inside the frame before the 53 MB download starts, with "Play anyway".
- Website builders that only allow a link (no HTML): link to the game URL instead.

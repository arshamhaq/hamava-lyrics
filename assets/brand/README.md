# Approved Hamava identity

The owner approved the ivory calligraphic loop with lavender inset on indigo.
`hamava-master.png` is the production asset prepared from that approved concept
using the image-generation tool; it is not a new logo direction. Keep it outside
`public` so the full-resolution source is not downloaded by the PWA.

Run `npm run icons` to reproduce the smaller header, favicon, Apple touch, and
manifest assets. The source fills the square, with the mark inside the central
safe area. The OS applies its home-screen corner shape. New asset names help
avoid old-icon URL caches; an existing iOS shortcut may still need removing and
adding again after deployment.

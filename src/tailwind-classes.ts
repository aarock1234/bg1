/*
Tailwind only generates the classes it finds written out in the source. The
ones below are built at run time, so they are listed here to keep them.

Park and land colors, which Theme (src/api/resort.ts) builds as bg-<color> and
text-<color>-d. They all resolve to neutral tokens now (see src/bg1.css), so
they only need to exist until no component uses them anymore:
bg-blue text-blue-d
bg-cyan text-cyan-d
bg-fuchsia text-fuchsia-d
bg-gray text-gray-d
bg-green text-green-d
bg-orange text-orange-d text-orange
bg-purple text-purple-d
bg-red text-red-d
bg-gold text-gold-d
*/

# BG1 app design guide

This is the guide to how BG1's screens are designed and built: the tokens, the
base styles, the shared components, and the patterns every screen follows. The
two screens to read first are the Lightning Lane home in
`src/components/ll/screens/Home*` and the booking screen in
`src/components/ll/screens/BookExperience*`; this guide explains what you will
see there.

## The look in one paragraph

Black and white, dark only. A near-black page, slightly lighter surfaces
outlined by hairlines, light text, and muted gray for anything secondary. The
one white thing on a screen is its primary button. There are no park colors, no
gradients, and no shadows except under things that float (sheets and toasts).
State is shown with weight, an icon, or an outlined badge. Three accents color
numbers by how good they are at a glance: green for a short wait or a return
time coming up soon, amber for middling, red for a long wait (red also marks
errors). Color always sits on the number itself, never in place of it.

## Tokens

All tokens are defined in the `@theme` block of `src/bg1.css`, so each one is a
Tailwind class.

| Token         | Value     | Classes                    | Use it for                                      |
| ------------- | --------- | -------------------------- | ----------------------------------------------- |
| `canvas`      | `#0a0a0a` | `bg-canvas`, `text-canvas` | The page. Text on a white button.               |
| `surface`     | `#111111` | `bg-surface`               | Lists, cards, sheets.                           |
| `pressed`     | `#1a1a1a` | `bg-pressed`               | Pressed rows, controls that sit on a surface.   |
| `line`        | `#242424` | `border-line`              | Hairline borders and dividers.                  |
| `line-strong` | `#3d3d3d` | `border-line-strong`       | Outlines that must be seen: inputs, alerts.     |
| `ink`         | `#ededed` | `text-ink`, `bg-ink`       | Text. The primary button.                       |
| `muted`       | `#8f8f8f` | `text-muted`               | Secondary text, captions, quiet icons.          |
| `faint`       | `#5c5c5c` | `text-faint`               | Placeholders and "off" icons only.              |
| `danger`      | `#ff6369` | `text-danger`              | Errors, destructive actions, the longest waits. |
| `good`        | `#4ade80` | `text-good`                | Short waits and return times coming up soon.    |
| `warn`        | `#fbbf24` | `text-warn`                | Middling waits and return times a while away.   |

Other tokens: `rounded-control` (8px, buttons and inputs), `rounded-card`
(12px, lists and cards), `rounded-sheet` (16px, bottom sheets), `font-sans`
(the system font stack), and the `xs` breakpoint (360px).

Type: the body is 16px. Use `text-[15px]` or `text-sm` for supporting text,
`text-[13px]` for captions and small buttons, and weights 500 (`font-medium`)
and 600 (`font-semibold`) for emphasis. Headings get tight tracking
automatically. `<time>` elements use tabular digits automatically; add
`tabular-nums` to any other number that changes or lines up in a column.

**There are no park colors.** Screens are not themed by park, and nothing
hands out color class names. Use only the tokens above, never Tailwind's own
palette (`bg-white`, `text-black`, `text-gray-500`, `bg-yellow-100`, and so
on).

## What the stylesheet already does for you

You don't need to add any of this to a screen:

- Inputs, selects, and textareas are never smaller than 16px, so iOS doesn't
  zoom when one is focused. No utility class can undo this.
- No tap highlight, no double-tap zoom, no text selection on buttons and
  labels, and no rubber-banding of the page behind overlays.
- Checkboxes and radio buttons are drawn in the theme. Use a plain
  `<input type="checkbox">`.
- `:focus-visible` shows a white outline for keyboard users.
- Animations and transitions switch off under `prefers-reduced-motion`.
- `h2`, `h3`, `p`, `a`, and `b` have sensible defaults. Override margins with
  utilities (`mt-0`, `mb-0`) where a heading sits inside a card or a row.

The viewport (`viewport-fit=cover`), the theme color, and the document title
are set by `site/app.html` on BG1's own site. `src/bg1.tsx` sets them again
for the userscript, which starts from an empty document on Disney's pages.

## Building blocks

Layout pieces are CSS classes from `src/bg1.css`. Anything with behavior is a
React component in `src/components/`. The page `?app=kit` in the preview shows
all of them.

### Screen

```tsx
<Screen
  title="Lightning Lane"
  buttons={<RefreshButton name="Offer" onClick={refresh} />}
  subhead={<BookingDate />}
>
  …content…
</Screen>
```

- `title` is the `h1`. Keep it short; it is cut off with an ellipsis.
- `buttons` are the actions at the right of the header. Every `Button` placed
  there is drawn quietly (no border, no background), so use icons or one short
  word. Keep it to two or three.
- `subhead` stays in view under the title. Use it for a toolbar of selects or
  one line of context, such as the date. It is muted and small by default.
- `footer` is pinned to the bottom, above the safe area.
- The body has 16px gutters, scrolls on its own, and fades in when the screen
  appears. The Back button is added automatically on every screen but the
  first.

`Tab` is a `Screen` whose footer is the bottom navigation. `withTabs` takes
the tabs and a `footer`, which is rendered as the last item of the navigation
bar: give it elements with the `tab` class, as
`src/components/ll/screens/Home/SettingsButton.tsx` does.

### Button

```tsx
<Button variant="primary" type="full" onClick={book}>Book Lightning Lane</Button>
<Button onClick={refresh}>Try Again</Button>
<Button type="small" onClick={change}>Change</Button>
<Button variant="danger" onClick={cancel}>Cancel Reservation</Button>
```

- `variant`: `secondary` (the default: surface with a hairline), `primary`
  (white; one per screen at most), `quiet` (no chrome; for headers and
  low-key actions), `danger` (red text with a red outline; destructive
  actions).
- `type` is the size: `normal` (40px tall), `small` (32px; for a button inside
  a row), `full` (48px tall, full width).
- Every size has a tap target of at least 44px, whatever it looks like.

### FloatingButton

The screen's primary action, in a bar pinned to the bottom edge:

```tsx
<FloatingButton onClick={book}>Book Lightning Lane</FloatingButton>
```

It is a primary button by default and reserves its own scroll space. Use it
once per screen, for the thing the guest came to do. Don't put one on a
screen that has bottom navigation.

### Grouped list and rows

One bordered, rounded container with hairlines between its children. This is
the default way to show a set of anything.

```tsx
<ul className="list">
  <li className="row">
    <span className="row-title">Mickey Mouse</span>
    <span className="text-sm text-muted">Detail</span>
  </li>
  <li>
    <button className="row" onClick={open}>
      <span className="row-title">Party Selection</span>
      <ChevronRightIcon className="text-muted" />
    </button>
  </li>
</ul>
```

- `list` goes on the container; its direct children are divided by hairlines.
- `row` is a 52px-tall flex row with 14px side padding. Put it on the `li`, or
  on a `button`, `a`, or `label` inside the `li` when the whole row is
  tappable; those get a pressed background.
- `row-title` takes the free space. Make a detail beside it small and muted
  (`text-sm text-muted`).
- A row with more than one line doesn't need `row`: give the `li` padding
  (`px-3.5 py-3`) and lay it out yourself, as `ExperienceItem` in
  `MultiPassList.tsx` does.
- For a table inside a list, wrap the table: `<div className="list"><table
className="w-full">…`, and put `border-t border-line` on the rows.

### Section title, card, note

```tsx
<h2 className="section-title">Experienced or Expired</h2>

<div className="card">
  <h3 className="mt-0">No Reservations Available</h3>
  <p className="note mb-0">There aren't enough reservation slots…</p>
</div>
```

- `section-title`: a small muted heading above a list or card.
- `card`: a surface with padding for one self-contained block.
- `note`: small muted text for descriptions, hints, and footnotes.

### Badge

```tsx
<span className="badge">Default</span>
<span className="badge badge-solid">next</span>
<span className="badge badge-muted">past</span>
<span className="badge badge-danger">down</span>
```

A small outlined pill for a status. `badge-solid` is the strongest (white),
`badge-danger` is for things that are wrong. Put an icon inside for a state
that matters, so it doesn't depend on the outline color.

### Alert

```tsx
<Alert title="Return Time Changed" />
<Alert title="Party Size Restricted">
  <p>Lightning Lane reservations are limited to 20 guests…</p>
</Alert>
```

An outlined block with a warning icon, for something the guest must not miss.
It is not red: reserve `danger` for real errors.

### Form controls

```tsx
<label className="field">
  <span className="field-label">Earliest</span>
  <Select options={options} selected={time} onChange={setTime} title="Earliest Return Time" className="w-full" />
</label>

<input className="input" placeholder="Email" />
```

- `field` stacks a `field-label` above a control.
- `Select` (and `MenuButton`) is a button that opens a bottom sheet of
  options. Without an option `icon` the button shows the selected option's
  text; add `className="w-full"` to fill a field, or `min-w-0 flex-1 shrink`
  to take the free space of a toolbar and truncate.
- `input` styles a text field. It is 44px tall and 16px text.
- Checkboxes and radios need no class. In a menu of options, give the radio
  the `menu-check` class to show it as a checkmark (see `SelectMenu`).

### Overlay and sheet

```tsx
<Overlay position="bottom" onClick={closeOnOutsideClick} data-testid="shade">
  <div className="sheet">
    <h3 className="sheet-title">Sort By</h3>
    <div className="sheet-body">…rows…</div>
  </div>
</Overlay>
```

`Overlay` dims the screen. `position="bottom"` places a `sheet` against the
bottom edge, where a thumb reaches it; the default centers its content.
`sheet-body` scrolls when the sheet is taller than the screen.

### Feedback: Flash, Spinner, empty states

- `useFlash` / `useDataLoader` show a `Flash`: a toast above the bottom bar,
  with an info icon, or a red warning icon for `'error'`.
- `Spinner` (shown by `useDataLoader`'s `loaderElem`) covers the screen and
  blocks taps while something loads. For progress inside a card, use
  `<div className="spinner size-4" />` next to text, as the auto-booking
  panel does.
- `empty-state` is a centered muted paragraph for "nothing here".

### GuestList, TimeBoard, LandLine, Time, Day

These keep their props. `GuestList` is a grouped list with avatars, optional
checkboxes, and a red caption for a guest's conflict. `TimeBoard` is a
two-row list with large tabular times. `LandLine` is the muted "Land • Park"
line under an experience's name.

### Icons

`src/icons/*` are outline icons on a 24px grid, drawn in the current text
color. The default size is 18px; set another with a width class
(`className="w-5"`). `filled` fills the shape, for the "on" state of a toggle
(a favorite's star).

## Patterns every screen follows

### How a screen is laid out

Top to bottom:

1. **Header**: title, and at most two or three quiet actions (refresh, a
   shortcut).
2. **Subhead** (optional): a toolbar of selects in one row (`flex gap-2`), the
   widest one first with `min-w-0 flex-1 shrink`, then one line of context.
3. **Body**: what the screen is about (`h2` with the name, then `LandLine`),
   then blocks separated by `mt-4` to `mt-6`: a card, a titled list, an alert.
4. **Primary action**: one `FloatingButton`.

See `BookExperience.tsx`: experience name, return time in a card, "Your Party"
with its list, the auto-booking card, and "Book Lightning Lane" pinned at the
bottom.

### How a list row is built

Simple rows use `row`. A richer row (see `ExperienceItem` in
`MultiPassList.tsx`) is two lines inside one `li`:

- Line 1: the name (`h3`, `font-medium`), then small icon buttons at the right
  (status markers, the favorite star). Each icon button is 40px tall so it is
  easy to hit.
- Line 2: a caption and value at the left ("Standby 45 min", through
  `LabeledItem`), and the row's action at the right (a secondary `Button`
  showing the return time, with a chevron because it opens a screen).

Values are `font-medium`; their captions and units are muted and smaller.

### Where actions go

- The one thing the guest came to do: `FloatingButton` (primary).
- A second, optional action on the same screen: a full-width secondary button
  inside its own card ("Start Auto Booking").
- An action on one item: a small secondary button at the right end of that
  item's row or section heading ("Change", "Modify Party", "Info").
- Refresh and shortcuts: quiet icon buttons in the header.
- Destructive or stopping actions: `variant="danger"`.

A section heading with an action is a flex row:

```tsx
<div className="mt-6 flex items-center justify-between gap-3">
  <h3 className="mt-0">Your Party</h3>
  <Button type="small" onClick={modify}>
    Modify Party
  </Button>
</div>
```

### Status

- A neutral value is plain text in `font-medium`.
- Something wrong ("down") is a `badge badge-danger`.
- The current or next item is a `badge badge-solid`.
- Something past or unavailable is `text-muted` or `badge-muted`, with a
  strikethrough when it is a time that has passed.
- On and off (a favorite) is a filled icon in `ink` against an outline in
  `faint`.

### Empty, loading, and error states

- **Loading**: render `loaderElem` from `useDataLoader` at the end of the
  screen. Don't show an empty state while it is loading.
- **Empty**: a short `empty-state` paragraph that says what is missing and
  what to do (see `NoExperiences` in `MultiPassList.tsx`). When there is an
  action to take, use a card with a muted icon, a heading, `note` text, and a
  `FloatingButton` (see `NoGuestsFound.tsx`). Keep it calm: an empty state is
  not an error.
- **Blocked**: a heading, a `note` explaining why, and the list of what is in
  the way (see `NoEligibleGuests.tsx`).
- **Failed request**: `useDataLoader` already shows the error toast. Make sure
  the screen behind it still makes sense, usually with the empty state.

## The preview

The real app needs a Disney login and talks to Disney. The preview renders
the real screens with fake clients in any browser. It is development-only: it lives in
`src/preview/` and `src/preview.html`, is not a build input, and its class
names are excluded from the stylesheet (so inside `src/preview/` only use
classes the app already uses, or inline styles).

Run it:

```sh
pnpm start
```

Then open `https://localhost:3000/bg1/preview.html` (accept the self-signed
certificate). Without options it lists everything it can show. The options
are query parameters:

| Option     | Values                                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app`      | `ll` (Lightning Lane), `vq` (virtual queue), `kit` (building blocks), `login`, `disclaimer`, `news`                                                                                        |
| `tab`      | With `app=ll`: `LL`, `Times`, `Plans`                                                                                                                                                      |
| `screen`   | With `app=ll`: `book`, `booking`, `new-booking`, `your-day`, `party`, `modify-party`, `return-time`, `change-time`, `new-return-time`, `cancel`, `das`, `das-experiences`, `das-selection` |
|            | With `app=vq`: `party`, `join`, `result`, `no-result`                                                                                                                                      |
| `id`       | Which item the screen is for: an experience ID (`book`), a plan ID or type `LL`, `DAS`, `BG`, `RES` (`booking`), or a queue ID `open-queue`, `upcoming-queue`, `closed-queue`              |
| `scenario` | `default`, `empty` (nothing to show), `sold-out` (no return times), `ineligible` (nobody can book), `error` (requests fail), `loading` (requests never finish)                             |
| `park`     | A park's name, such as `park=EPCOT`                                                                                                                                                        |
| `resort`   | `WDW` (default) or `DLR`, which has no advance booking and no return time selection                                                                                                        |
| `time`     | The time of day to pretend it is, such as `time=14:30`. The default is `10:05`, so screenshots don't depend on when they are taken.                                                        |
| `tap`      | The title, label, or text of a control to tap after loading. Repeat it to tap several in order: `tap=Sort%20By` opens the sort menu.                                                       |

Examples:

- `?app=ll`: the Lightning Lane list
- `?app=ll&tab=Times`: the times guide
- `?app=ll&screen=book`: the booking screen
- `?app=ll&screen=book&scenario=sold-out&tap=Start%20Auto%20Booking`: auto
  booking while it searches
- `?app=ll&screen=booking&id=DAS`: the details of a DAS return time
- `?app=vq&screen=join&id=upcoming-queue`: joining a queue that opens later

Every load starts from the same state: saved settings are reset, and bookings
made in the preview last until the page reloads.

To add a screen, add an entry to `LL_SCREENS` in `src/preview/ll-screens.tsx`
or `VQ_SCREENS` in `src/preview/VirtualQueuePreview.tsx`, and a link in
`src/preview/PreviewIndex.tsx`. To change the fake data, see
`src/preview/data/` and `src/preview/clients.ts`.

### Screenshots

Headless Chrome, at phone width (500px is Chrome's minimum window width):

```sh
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu \
  --hide-scrollbars --ignore-certificate-errors --window-size=500,1000 \
  --virtual-time-budget=5000 \
  --screenshot="C:/Users/Abdel/AppData/Local/Temp/opencode/preview.png" \
  "https://localhost:3000/bg1/preview.html?app=ll"
```

A toast disappears after three seconds; to catch one, lower
`--virtual-time-budget` to `3000`. A sheet opened with `tap` may be caught
mid-animation; that is the headless clock, not a bug.

Look at the result as a stranger would. Is the most important thing the
largest? Is there exactly one white button? Could anything be removed?

## Do and don't

Do:

- Keep every string, `aria-label`, `title`, `role`, and form control. The
  tests find elements by them, and some by structure: check the test file
  next to the component before moving text between elements.
- Use the tokens and the building blocks. If you write the same long class
  string three times, it probably wants to be a class in `src/bg1.css`
  (tell the owner of that file) or a small component in your file.
- Keep tap targets at 44px or more, and rows at 52px or more.
- Give every screen one obvious primary action, or none.
- Check your screen at the default width and in the `empty` and `error`
  scenarios.

Don't:

- Don't use Tailwind's color palette. No `bg-white` blocks, no yellow alerts,
  no park-colored headings.
- Don't add gradients, shadows, or colors beyond the three accents. If a
  state seems to need a color, try weight, an icon, or a badge first.
- Don't use `uppercase` for headings or labels. Sentence case, muted, small.
- Don't use `100vh`; screens are already sized. Don't add horizontal padding
  to the screen body; it has the gutters.
- Don't put `transform` on anything that contains an overlay, a toast, or a
  `FloatingButton`: they are `position: fixed` and would be trapped inside.
- Don't set a font size below 16px on an input. (You can't, but don't try.)
- Don't use emoji as icons in new chrome; they bring their own colors.

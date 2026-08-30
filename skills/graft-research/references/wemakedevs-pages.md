# WeMakeDevs pages, and the two slugs

## The page map

WeMakeDevs is uniform. Four pages per hackathon, all beside each other:

    /hackathons                   index — take the slug AND the host from the card
    /hackathons/<slug>            overview: sponsors, tracks, judging, project ideas
    /hackathons/<slug>/rules      rules, submission requirements
    /hackathons/<slug>/schedule   dates, deadline
    /hackathons/<slug>/resources  documentation and links, per sponsor

## The host is the state

`www.wemakedevs.org` while the hackathon runs. Once results are declared it moves to
`archive.wemakedevs.org` on the same path. Take the host from the index card rather
than assuming one; a live-host fetch of an archived hackathon 404s and looks like the
hackathon does not exist.

Some hackathons are hosted on luma.com instead. Same event, same sections — the
challenge, the tracks and their prizes, the rules — laid out differently. Read it the
way you would read a wemakedevs.org page and store it the same way; `sourceUrl` is
just the luma page. The two-slug rule below still applies: the key comes from the
title, not from whatever the luma URL happens to be.

## Two slugs, and they are not the same

**The URL slug** locates the page and is not derivable from the title. "Into the
Scrape-Verse" lives at `scrape-verse`. Read it off the index card.

**The `hackathon` key** you send to the server is its own thing, slugified from the
**title**, short: drop a leading "the", drop punctuation, stop at the distinctive part.

| title | `hackathon` |
|---|---|
| Agents of SigNoz | `agents-of-signoz` |
| The Hangover Part AI: Where's My Context? | `hangover-part-ai` |

Do not reuse the URL slug as the key. WeMakeDevs names its paths after the sponsor, so
reusing one files the event under the product and overwrites it the next time that
sponsor runs something.

Product slugs are formed from the product name the same way — `falkordb`, `trueforge` —
so a hackathon and its sponsor never collide.

## save_hackathon field shapes

The page sections map one to one onto the fields, in page order:

    challenge      { title, description }
    tracks         { name, prize, criteria }
    judging        { title, description }
    projectIdeas   { title, description }
    bestPractices  { title, description }
    rules          { title, description }
    requirements   { title, description }

`tracks` holds **every** prize category — judged tracks and open prizes alike. There is
no separate prizes list.

Send an empty array where the page genuinely has no such section. Omit the field
entirely if you did not look — on a write, omitted leaves the stored value alone and
`[]` replaces it with nothing.

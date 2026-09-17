# Personal homepage architecture

## Goals

This repository publishes a modern, restrained academic homepage through GitHub Pages.

The core principles are:

1. Keep the public site static and dependency-light.
2. Keep profile and publication content in structured sources of truth.
3. Prefer small, explicit scripts over a frontend framework.
4. Make common updates local: adding a publication should not require editing layout code.
5. Keep the first release independent of the future academic CV pipeline.

## First release

The first release is a single responsive page with:

- a compact identity and research-introduction section;
- a portrait image that can be replaced without changing layout;
- a reverse-chronological publication list;
- optional per-publication links;
- contact information and a link to the manually maintained resume.

The page uses semantic HTML, one CSS file, no client-side JavaScript, and no external font or analytics dependency.

## Build flow

```text
data/profile.json
          +
data/publications.json
          +
site.template.html
          |
          v
 scripts/build.mjs
          |
          v
      index.html
```

`index.html` is generated and committed because GitHub Pages can then serve the repository root directly. Run `npm run build` after changing profile data, publication data, or the template.

The build script uses only Node.js built-ins. It validates profile and publication fields, rejects duplicate IDs and unsafe links, sorts entries by `issued`, escapes generated HTML, and highlights the profile owner in author lists.

## Profile data

`data/profile.json` is the single source of truth for personal content: name, page description, position, institution, email, introduction paragraphs, profile links, portrait path, and footer metadata. A profile link without a `url` is rendered as a visible placeholder; adding a safe HTTPS or local URL turns it into a link.

Introduction paragraphs support inline links in the form `[label](https://example.com)`. The build validates link URLs, escapes the remaining text, and adds safe external-link attributes.

`site.template.html` should only be edited when the page structure changes. Routine content updates should not require HTML edits.

## Publication data

`data/publications.json` is a compact, site-owned JSON array. A future CV adapter can translate it into CSL-JSON, BibTeX, or LaTeX without making the source data harder to edit:

- `id`: stable publication identifier using all authors' family-name initials, the two-digit year, and the first word of the title, such as `FGY26-Entrywise`;
- `type`: publication type;
- `title`;
- `authors`: author names as an ordered string array;
- `issued.date-parts`;
- `container-title`;
- `event-title`;
- `page`;
- `DOI`;
- `URL`.

The build sorts publications by `issued.date-parts` in descending order. Conference papers use the conference start date; arXiv-only preprints use their first public submission date. The page displays only the year, while the complete date keeps entries within the same year in chronological order.

The site adds one namespaced extension:

```json
"_links": [
  { "label": "arXiv", "url": "https://arxiv.org/abs/..." },
  { "label": "Talk slides", "url": "/assets/slides/talk.pdf" }
]
```

`_links` is optional. It may contain arXiv, DOI, PDF, slides, video, code, or other HTTPS/local links. Missing links produce no empty UI.

## Static research files

Talk slides may be committed as PDF files under `assets/slides/` and referenced from `_links`. Prefer PDF over editable presentation formats, and use external hosting for large videos.

The current portrait lives at `assets/junzhao_yang_headshot_CMU.png`. Its path is set in `data/profile.json`.

## Resume and future CV

The public resume is maintained manually in `cv/industry_resume.tex` and served
from `output/pdf/junzhao-yang-resume.pdf`. It is not generated from the
publication data. The academic CV is intentionally absent from the first public
release; a future CV pipeline may reuse `data/publications.json` without changing
the site build.

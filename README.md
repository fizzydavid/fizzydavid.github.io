# Junzhao Yang — academic homepage

A small static academic homepage published at `https://fizzydavid.github.io/` with GitHub Pages.

## Update the site

Edit personal text and links in `data/profile.json`, or publications in `data/publications.json`, then run:

```bash
npm run build
```

Commit the generated `index.html` together with the edited source files. The site also needs `styles.css` and the referenced files under `assets/` and `output/pdf/`.

The current document link is a manually maintained resume. Its source is `cv/industry_resume.tex`; the public PDF is `output/pdf/junzhao-yang-resume.pdf`. Recompile and visually check the PDF after changing the TeX, then replace the public PDF. The academic CV is deferred and is not linked from this release.

See `docs/ARCHITECTURE.md` for the site data format and build flow.

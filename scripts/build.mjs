import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const ROOT = new URL('../', import.meta.url)
const PUBLICATIONS_MARKER = '<!-- PUBLICATIONS -->'
const INTRODUCTION_MARKER = '<!-- INTRODUCTION -->'
const PROFILE_LINKS_MARKER = '<!-- PROFILE_LINKS -->'

const [template, profileSource, publicationSource, styleSource] = await Promise.all([
  readFile(new URL('site.template.html', ROOT), 'utf8'),
  readFile(new URL('data/profile.json', ROOT), 'utf8'),
  readFile(new URL('data/publications.json', ROOT), 'utf8'),
  readFile(new URL('styles.css', ROOT), 'utf8'),
])

const profile = JSON.parse(profileSource)
const publications = JSON.parse(publicationSource)
validateProfile(profile)
validatePublications(publications)

for (const marker of [INTRODUCTION_MARKER, PROFILE_LINKS_MARKER, PUBLICATIONS_MARKER]) {
  if (!template.includes(marker)) {
    throw new Error(`Template is missing ${marker}.`)
  }
}

const renderedPublications = [...publications]
  .sort(comparePublications)
  .map(renderPublication)
  .join('\n')

const renderedIntroduction = profile.introduction
  .map((paragraph) => `            <p>${renderInlineLinks(paragraph)}</p>`)
  .join('\n')
const renderedProfileLinks = profile.links.map(renderProfileLink).join('\n')

let output = template
  .replace(INTRODUCTION_MARKER, renderedIntroduction)
  .replace(PROFILE_LINKS_MARKER, renderedProfileLinks)
  .replace(PUBLICATIONS_MARKER, renderedPublications)

const replacements = {
  NAME: profile.name,
  META_DESCRIPTION: profile.metaDescription,
  POSITION: profile.position,
  INSTITUTION: profile.institution,
  EMAIL: profile.email,
  AUTHOR_ORDER_NOTE: profile.authorOrderNote,
  PORTRAIT: profile.portrait,
  PORTRAIT_ALT: profile.portraitAlt,
  COPYRIGHT_YEAR: String(profile.copyrightYear),
  LAST_UPDATED: profile.lastUpdated,
  STYLES_VERSION: createHash('sha256').update(styleSource).digest('hex').slice(0, 12),
}

for (const [key, value] of Object.entries(replacements)) {
  output = output.replaceAll(`{{${key}}}`, escapeHtml(value))
}

const unresolvedToken = output.match(/{{[A-Z_]+}}/)
if (unresolvedToken) {
  throw new Error(`Template contains unresolved token ${unresolvedToken[0]}.`)
}

await writeFile(new URL('index.html', ROOT), output)

console.log(`Built index.html with ${publications.length} publication(s).`)

function validateProfile(profile) {
  for (const field of [
    'name',
    'metaDescription',
    'position',
    'institution',
    'email',
    'authorOrderNote',
    'portrait',
    'portraitAlt',
    'lastUpdated',
  ]) {
    requireString(profile[field], `Profile ${field}`)
  }

  if (!Number.isInteger(profile.copyrightYear)) {
    throw new Error('Profile copyrightYear must be an integer.')
  }

  if (!Array.isArray(profile.introduction) || profile.introduction.length === 0) {
    throw new Error('Profile introduction must contain at least one paragraph.')
  }
  profile.introduction.forEach((paragraph) => requireString(paragraph, 'Profile introduction paragraph'))

  if (!Array.isArray(profile.links)) {
    throw new Error('Profile links must be an array.')
  }

  for (const link of profile.links) {
    requireString(link.label, 'Profile link label')
    if (link.url !== undefined && !isSafeUrl(link.url)) {
      throw new Error(`Profile has an unsupported link URL: ${link.url}`)
    }
  }

  if (!isSafeUrl(profile.portrait)) {
    throw new Error(`Profile has an unsupported portrait URL: ${profile.portrait}`)
  }
}

function validatePublications(items) {
  if (!Array.isArray(items)) {
    throw new Error('data/publications.json must contain a JSON array.')
  }

  const ids = new Set()

  for (const [index, publication] of items.entries()) {
    const label = `Publication ${index + 1}`

    requireString(publication.id, `${label} id`)
    requireString(publication.type, `${label} type`)
    requireString(publication.title, `${label} title`)

    if (ids.has(publication.id)) {
      throw new Error(`Duplicate publication id: ${publication.id}`)
    }
    ids.add(publication.id)

    if (!Array.isArray(publication.authors) || publication.authors.length === 0) {
      throw new Error(`${label} must have at least one author.`)
    }

    for (const author of publication.authors) {
      requireString(author, `${label} author`)
    }

    const dateParts = getDateParts(publication)
    if (!dateParts.every(Number.isInteger) || dateParts[0] < 1900) {
      throw new Error(`${label} has an invalid issued date.`)
    }

    if (publication.status !== undefined) {
      requireString(publication.status, `${label} status`)
    }

    if (publication._links !== undefined) {
      if (!Array.isArray(publication._links)) {
        throw new Error(`${label} _links must be an array.`)
      }

      for (const link of publication._links) {
        requireString(link.label, `${label} link label`)
        requireString(link.url, `${label} link URL`)

        if (!isSafeUrl(link.url)) {
          throw new Error(`${label} has an unsupported link URL: ${link.url}`)
        }
      }
    }
  }
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string.`)
  }
}

function getDateParts(publication) {
  const dateParts = publication.issued?.['date-parts']?.[0]
  if (!Array.isArray(dateParts) || dateParts.length === 0) {
    throw new Error(`Publication ${publication.id} is missing issued.date-parts.`)
  }
  return dateParts
}

function comparePublications(left, right) {
  const leftDate = sortableDate(getDateParts(left))
  const rightDate = sortableDate(getDateParts(right))

  return rightDate - leftDate || left.title.localeCompare(right.title)
}

function sortableDate([year, month = 1, day = 1]) {
  return year * 10_000 + month * 100 + day
}

function renderPublication(publication) {
  const [year] = getDateParts(publication)
  const authors = publication.authors.map(renderAuthor).join(', ')
  const venue = publication['container-title']
  const venueHighlight = publication['event-title']
    ? ` <span class="publication-venue-highlight">(${escapeHtml(publication['event-title'])} ${year})</span>`
    : ''
  const status = publication.status
    ? ` <span class="publication-status">(${escapeHtml(publication.status)})</span>`
    : ''

  const links = (publication._links ?? []).map(renderLink).join('\n')
  const linksBlock = links
    ? `\n            <div class="publication-links" aria-label="Links for ${escapeHtml(publication.title)}">\n${links}\n            </div>`
    : ''

  return `        <article class="publication">
          <div class="publication-year-column">${year}</div>
          <div class="publication-details">
            <h3>${escapeHtml(publication.title)}</h3>
            <p class="publication-authors">${authors}</p>
            <p class="publication-venue"><span class="publication-venue-name">${escapeHtml(venue)}</span>${venueHighlight}${status}</p>${linksBlock}
          </div>
        </article>`
}

function renderAuthor(author) {
  return author === profile.name ? `<strong>${escapeHtml(author)}</strong>` : escapeHtml(author)
}

function renderProfileLink(link) {
  if (!link.url) {
    return `            <span>${escapeHtml(link.label)}</span>`
  }

  const externalAttributes = link.url.startsWith('https://') ? ' target="_blank" rel="noreferrer"' : ''
  return `            <a href="${escapeHtml(link.url)}"${externalAttributes}>${escapeHtml(link.label)}</a>`
}

function renderInlineLinks(value) {
  const linkPattern = /\[([^\]]+)\]\(([^)\s]+)\)/g
  let output = ''
  let cursor = 0

  for (const match of value.matchAll(linkPattern)) {
    output += escapeHtml(value.slice(cursor, match.index))

    const [, label, url] = match
    if (!isSafeUrl(url)) {
      throw new Error(`Profile introduction has an unsupported link URL: ${url}`)
    }

    const externalAttributes = url.startsWith('https://') ? ' target="_blank" rel="noreferrer"' : ''
    output += `<a href="${escapeHtml(url)}"${externalAttributes}>${escapeHtml(label)}</a>`
    cursor = match.index + match[0].length
  }

  return output + escapeHtml(value.slice(cursor))
}

function renderLink(link) {
  const externalAttributes = link.url.startsWith('https://') ? ' target="_blank" rel="noreferrer"' : ''
  return `              <a href="${escapeHtml(link.url)}"${externalAttributes}>${escapeHtml(link.label)} <span aria-hidden="true">↗</span></a>`
}

function isSafeUrl(url) {
  return url.startsWith('https://') || url.startsWith('/') || url.startsWith('./') || url.startsWith('../')
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

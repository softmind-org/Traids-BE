# Profile Overview — Subcontractor API Reference

All endpoints: `Authorization: Bearer <token>`, `userType: subcontractor`.

---

## Endpoints

| Method | Path | Used on |
|---|---|---|
| GET | `/subcontractor/profile-overview` | Profile Overview, left panel on every screen |
| POST | `/subcontractor/portfolio` | Upload New Work |
| GET | `/subcontractor/portfolio/:id` | Portfolio detail |

---

## Screen 1 — Profile Overview

`GET /subcontractor/profile-overview`

**200**
```json
{
  "message": "Profile overview retrieved successfully",
  "data": {
    "profile": {
      "_id": "string",
      "fullName": "Michael Chen",
      "email": "michaelchen@gmail.com",
      "profileImage": "https://... | null",
      "primaryTrade": "electrician",
      "hourlyRate": 12,
      "availability": true,
      "professionalBio": "string | null",
      "yearsOfExperience": 8,
      "cityLocation": "Manchester",
      "averageRating": 4.7,
      "totalRatings": 3,
      "topRated": true
    },
    "certificates": {
      "insurance":     { "documents": ["https://..."], "expiresAt": "ISO date | null", "status": "valid" },
      "tickets":       { "documents": ["https://..."], "expiresAt": "ISO date | null", "status": "expiring_soon" },
      "certification": { "documents": [],              "expiresAt": null,              "status": "missing" }
    },
    "portfolio": [ /* PortfolioItem[] — drafts included, newest first */ ],
    "reviews": {
      "averageRating": 4.7,
      "totalRatings": 3,
      "ratings": [
        {
          "_id": "string",
          "rating": 4,
          "comment": "string",
          "createdAt": "ISO date",
          "company": { "_id": "string", "companyName": "Apex Development Group", "profileImage": "https://..." },
          "job": { "_id": "string", "jobTitle": "Office Rewire", "trade": "electrician" }
        }
      ]
    }
  }
}
```

### Design → field

| Design element | Field |
|---|---|
| Photo | `profile.profileImage` |
| Name / email | `profile.fullName` / `profile.email` |
| "Top Rated" badge | `profile.topRated` |
| Stars | `profile.averageRating` |
| Trade chip ("Electrician") | `profile.primaryTrade` |
| Availability | `profile.availability` |
| Hourly Rate | `profile.hourlyRate` |
| About | `profile.professionalBio` |
| Public Liability Insurance | `certificates.insurance` |
| Site Tickets | `certificates.tickets` |
| Trade Certifications | `certificates.certification` |
| Expiry Date | `certificates.*.expiresAt` |
| Download Copy | `certificates.*.documents[0]` (open URL, no API) |
| Portfolio card image / title / text | `portfolio[].photos[0]` / `title` / `briefOverview` |
| Review avatar / name | `reviews.ratings[].company.profileImage` / `companyName` |
| Review stars / text | `reviews.ratings[].rating` / `comment` |
| "2h ago" | `reviews.ratings[].createdAt` |

### Certificate `status`

| Value | UI |
|---|---|
| `valid` | Green tick, show expiry date |
| `no_expiry` | Green tick, "Valid (No Expiry)" |
| `expiring_soon` | Green tick, "Expiring soon…" (within 30 days) |
| `expired` | Red cross |
| `missing` | Red cross, hide Download Copy |

### Portfolio drafts

`portfolio` includes drafts. Show a Draft badge when `status: "draft"`.

---

## Screen 2 — Portfolio detail

`GET /subcontractor/portfolio/:id`

**200**
```json
{ "message": "Portfolio item retrieved successfully", "data": { /* PortfolioItem */ } }
```

Left panel (profile, availability, compliance): use `profile-overview` data.

### Design → field

| Design element | Field |
|---|---|
| Breadcrumb / title | `title` |
| Chip | `trade` |
| Main image | `photos[0]` |
| Project Overview & Scope | `description` |
| Hiring Client | `clientName` |
| Location | `location` |
| Project Duration | `duration` |
| Estimated Cost | `costRange` |
| Completion Date | `completionDate` |
| Gallery | `photos` |

---

## Screen 3 — Upload New Work

`POST /subcontractor/portfolio` — `multipart/form-data`

Left panel: use `profile-overview` data.

| Form label | Field | Type |
|---|---|---|
| Save as Draft / Submit for Review | `status` | `draft` \| `published` (default `draft`) |
| Project Title | `title` | string, max 150 |
| Specialty Category | `trade` | `electrician` \| `plumber` \| `carpenter` \| `masonry` |
| Brief Overview | `briefOverview` | string, max 300 |
| Client / Company Name | `clientName` | string, max 150 |
| Project Location | `location` | string, max 150 |
| Duration (Days/Weeks) | `duration` | string, max 50 |
| Cost Range (£) | `costRange` | string, max 50 |
| Completion Date | `completionDate` | `YYYY-MM-DD` |
| Detailed Project Description | `description` | string, max 5000 |
| Project Photos & Media | `photos` | file(s) |

- **Photos:** JPG / PNG / WEBP, max 5 MB each, max 10. Repeat the `photos` field per file.
- **Save as Draft:** all fields optional.
- **Submit for Review:** requires `title`, `trade`, `briefOverview`, at least 1 photo. Publishes immediately (no review step).
- **Specialty Category:** dropdown labels must send the enum value (e.g. "Electrical Installations" → `electrician`).
- **Completion Date:** form shows `DD/MM/YYYY`; send `YYYY-MM-DD`.
- **Work Type:** do not send — unknown fields return 400.

**201**
```json
{ "message": "Portfolio item published successfully", "data": { /* PortfolioItem */ } }
```
Draft message: `"Portfolio item saved as draft"`.

**400** — Submit with missing fields
```json
{
  "message": "Cannot publish — missing required fields: trade, photos",
  "missingFields": ["trade", "photos"],
  "statusCode": 400
}
```
Possible values: `title`, `trade`, `briefOverview`, `photos`.

---

## PortfolioItem object

```json
{
  "_id": "string",
  "subcontractor": "string",
  "status": "draft | published",
  "title": "string?",
  "trade": "electrician | plumber | carpenter | masonry",
  "briefOverview": "string?",
  "clientName": "string?",
  "location": "string?",
  "duration": "string?",
  "costRange": "string?",
  "completionDate": "ISO date?",
  "photos": ["https://..."],
  "description": "string?",
  "publishedAt": "ISO date?",
  "createdAt": "ISO date",
  "updatedAt": "ISO date"
}
```

Fields marked `?` can be missing on drafts.

---

## In the design but not in the API — hide these

| Screen | Element |
|---|---|
| Profile Overview | Job Success % |
| Profile Overview | Blue verified badge on profile photo |
| Portfolio detail | "Industrial / Commercial" chip (Work Type) — show `trade` instead |
| Portfolio detail | "★ 5.0 (Verified Project)" |
| Portfolio detail | Compliance Status "PASSED (Verified)" |
| Portfolio detail | Verified Client Review section |
| Upload New Work | Work Type dropdown |

---

## Errors

| Code | When |
|---|---|
| 400 | Missing fields on Submit, invalid value, unknown field, wrong photo type, more than 10 photos |
| 403 | Not a subcontractor token, or portfolio item belongs to another subcontractor |
| 404 | Portfolio item not found |
| 413 | Photo larger than 5 MB |

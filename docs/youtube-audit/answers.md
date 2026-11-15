# YouTube API Services audit: answers for Vieews

Form: https://support.google.com/youtube/contact/yt_api_form
Request type: **Complete a compliance audit to request for additional quota** (new app; passing the audit also lifts the "uploads stay private" lock).

## Section 2: Organization and contact (from you)

- Applying as: _individual / organization_ (ASK)
- Full legal name: (ASK)
- Organization legal name: "self" if individual (ASK)
- Website: https://www.vieews.dev
- Address: country, street, city, state/province, postal code (ASK)
- Category: Software / SaaS tool for creators
- Organization size: Independent Developer/Sole Proprietor (unless you say otherwise)
- Primary contact: your name, zazabusiness23@gmail.com; technical and business contact: same as primary

## Section 3: Business model

**Describe your organization's work as it relates to YouTube**

> Vieews (https://www.vieews.dev) is a web app for creators and small businesses who publish the same short-form video to several platforms. A user uploads one vertical video to Vieews, writes a title, description and tags for each platform, and publishes it to their own YouTube channel, Instagram and TikTok at once or at a scheduled time. For YouTube, the user connects their own channel with Google OAuth (scopes youtube.upload and youtube.readonly). Vieews then calls channels.list (part=snippet, mine=true) once to show which channel is connected, and calls videos.insert (resumable upload) only when the user clicks Publish or a post they scheduled comes due, uploading exactly the file and metadata the user chose (title, description, tags, privacy status, made-for-kids, altered-content disclosure). Vieews does not read, edit or delete any other YouTube content, comments, playlists or analytics, does not display YouTube content to other users, and does not use YouTube data for advertising or AI training. OAuth tokens are encrypted at rest (AES-256-GCM); users can disconnect in Vieews, which deletes the tokens, or revoke access in their Google Account. The value to the YouTube ecosystem: creators publish Shorts to YouTube as part of their normal workflow instead of skipping YouTube when they post elsewhere, with YouTube's metadata and disclosure settings filled in correctly.

- Target audience: Individual Content Creators; Brands and Advertisers (small businesses); Marketing Agencies
- Monetization: (ASK) Recurring Subscriptions and/or Freemium
- Google representative: No
- Learned about the API: Google search / documentation

## Section 4: API client

- API Client name: Vieews (does not contain "YouTube")
- Primary access URL: https://www.vieews.dev
- Privacy policy: https://www.vieews.dev/privacy
- Terms of service: https://www.vieews.dev/terms
- Publicly accessible: Yes

## Section 5: Project #1

- Project number: 595645002382 (project ID vieews-514607)
- Use case: Video Uploading & Account Management; Tools for Creators
- Users sign in with Google (OAuth 2.0): Yes
- Endpoints: channels.list, videos.insert
- Quota: (ASK) expected uploads per day. videos.insert costs about 1,600 units per upload, so the default 10,000 units/day allows about 6 uploads per day for the whole app.

### Evidence files (this folder)

| Form field | File |
|---|---|
| Privacy policy screenshots | `privacy-policy-youtube-sections.png` |
| Homepage screenshot with privacy link | `homepage-with-privacy-link.png` |
| Terms of service | `terms-of-service.pdf` |
| Conditional evidence (OAuth flow) | `oauth-flow-consent-scopes-revocation.png` |
| Conditional evidence (upload interface) | `upload-interface-to-live-video.png` + screencast https://youtu.be/EFEZtPxpT_g |
| Architecture diagram | `architecture-diagram.png` |
| User flow diagram | `user-flow-diagram.png` |

## Section 7: Attestations

All checkboxes are required. They accept the YouTube API Services Terms of Service, the Developer Policies and the accuracy of the answers on your behalf.

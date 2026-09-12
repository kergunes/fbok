# fbok Privacy Policy

**Last updated:** September 13, 2026

fbok is a Facebook-specific browser extension that filters unwanted Facebook content in the user's browser.

## Data processed

fbok reads and processes Facebook page content locally in the browser only as needed to identify and hide:

- Sponsored / Sponsorlu / Ad feed posts;
- the Facebook right-rail Sponsored module;
- suggested or recommended posts when the user enables that option.

This processing may include page text, links, accessibility metadata, DOM structure, and other rendered-page metadata required for classification.

## Data collection and transmission

fbok does **not** transmit Facebook page content, browsing data, personal information, or usage data to the developer or to third parties.

fbok does not use:

- analytics or telemetry;
- advertising SDKs;
- tracking pixels;
- remote servers for content analysis;
- remote code execution;
- data brokers or data-sale services.

All Facebook content classification is performed locally in the user's browser.

## Stored preferences

fbok currently stores the user's **Hide suggested posts** preference using Chrome's `storage.sync` API.

This preference may be synchronized by the browser through the user's browser profile. fbok does not operate or receive data from that synchronization service.

## Host access

fbok requests access only to:

- `https://facebook.com/*`
- `https://www.facebook.com/*`

This access is required so the extension can inspect and filter Facebook page content. fbok does not request access to unrelated websites.

## Data use

fbok does not sell user data or transfer user data for advertising, profiling, creditworthiness, lending, or purposes unrelated to the extension's stated content-filtering functionality.

## Changes to this policy

If fbok's data practices change, this privacy policy will be updated before or alongside the affected release.

## Contact

For privacy questions or issues, use the project's public GitHub repository:

https://github.com/kergunes/fbok

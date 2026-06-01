# SendPulse IREM Contacts Normalization

## Source

- `Leads DB (smartsender).xlsx`

## Goal

- Prepare a clean SendPulse import file for IREM email promo.
- Add a ready-to-use dynamic promo link per contact.

## Normalization Contract

- Source file is a SmartSender export without a top header row.
- Export contains one embedded header row repeated as data; it is removed.
- Final dataset keeps only rows with a valid email.
- Emails are trimmed and normalized to lowercase.
- Duplicate emails are deduped by keeping the latest `last_seen_at`.
- `promo_link` is precomputed as:
  - `https://irem.centerway.net.ua/go/irem?email=<email>&campaign=launch_may_2026_email&source=sendpulse&utm_source=sendpulse`

## Final Columns

- `email`
- `first_name`
- `last_name`
- `full_name`
- `phone`
- `promo_link`
- `campaign`
- `source`
- `recipient_key`
- `smartsender_user_id`
- `tg_username`
- `created_at`
- `last_seen_at`
- `tags`

## Compact SendPulse Import

For the current email send, the minimal import shape is:

- `email`
- `first_name`
- `full_name`

These are exported as:

- `outputs/sendpulse_irem_20260526/sendpulse_irem_contacts_compact.csv`
- `outputs/sendpulse_irem_20260526/sendpulse_irem_contacts_compact.xlsx`

## Expected SendPulse Use

- Import `sendpulse_irem_contacts.csv` or `sendpulse_irem_contacts.xlsx` into the mailing list.
- In the email template either:
  - link the CTA directly to `{{promo_link}}`, or
  - use the same field in a button URL.

## Notes

- Current campaign slug: `launch_may_2026_email`
- Current source tag: `sendpulse`
